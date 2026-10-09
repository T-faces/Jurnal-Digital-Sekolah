/**
 * Jurnal Digital Sekolah - Google Apps Script Backend
 * Database: Google Sheets
 * Authentication: username + SHA-256 password hash + short-lived session token.
 *
 * 1. Create a Google Spreadsheet.
 * 2. Copy its ID into CONFIG.SPREADSHEET_ID.
 * 3. Deploy this project as a Web App.
 * 4. Run setupDatabase() once from the Apps Script editor.
 *
 * IMPORTANT:
 * - Change the seeded admin password immediately after first login.
 * - Never store plain-text passwords in Sheets.
 */

const CONFIG = {
  SPREADSHEET_ID: '12SfYIYrzggSYSg3lRaiRa5PbMqhFyul9o7kFokj_yOI',
  SESSION_SECONDS: 21600,
  APP_NAME: 'Jurnal Digital Sekolah'
};

const SHEETS = {
  Users: ['id','username','name','role','passwordHash','active','createdAt','updatedAt'],
  Settings: ['key','value','updatedAt'],
  Teachers: ['id','name','subject','role','status','createdAt','updatedAt'],
  Students: ['id','name','nis','className','status','createdAt','updatedAt'],
  Classes: ['id','name','teacher','room','students','createdAt','updatedAt'],
  Journals: ['id','date','teacher','className','subject','hours','topic','objective','activities','reflection','created','updatedAt'],
  Attendance: ['id','date','className','teacher','present','sick','permission','absent','createdAt','updatedAt'],
  Plans: ['id','date','subject','className','topic','objective','createdAt','updatedAt'],
  Schedules: ['id','day','time','subject','className','teacher','createdAt','updatedAt'],
  AuditLog: ['timestamp','username','action','collection','recordId','detail']
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    if (action === 'ping') return json_({ok:true,app:CONFIG.APP_NAME,time:new Date().toISOString()});
    if (action === 'jsonp') {
      const result = handleAction_(e.parameter);
      const callback = safeCallback_(e.parameter.callback);
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return json_({ok:false,error:'GET tidak mendukung aksi ini. Gunakan POST.'});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    return json_(handleAction_(body));
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function handleAction_(p) {
  // Normalize action names so older frontend/deployment variants remain compatible.
  const rawAction = String(p.action || '').trim();
  const action = rawAction.toLowerCase();
  if (action === 'ping') return {ok:true,app:CONFIG.APP_NAME,time:new Date().toISOString()};
  if (action === 'login') return login_(String(p.username||''),String(p.passwordHash||''));
  if (action === 'logout') return logout_(String(p.token||''));
  if (action === 'bootstrap') return bootstrap_(String(p.token||''));
  if (action === 'saveall') return saveAll_(String(p.token||''), p.data);
  if (action === 'saveschoolsettings') return saveSchoolSettings_(String(p.token||''), p.data || {});
  if (action === 'saverecord') return saveRecord_(String(p.token||''), String(p.collection||''), p.data || {});
  if (action === 'deleterecord') return deleteRecord_(String(p.token||''), String(p.collection||''), String(p.id||''));
  if (action === 'changepassword') return changePassword_(String(p.token||''),String(p.currentHash||''),String(p.newHash||''));
  if (action === 'generatejournalai') return generateJournalAI_(String(p.token||''), p.context || {});
  if (action === 'listjournals') return listJournals_(String(p.token||''));
  if (action === 'createjournal') return createJournal_(String(p.token||''), p.data || {});
  if (action === 'updatejournal') return updateJournal_(String(p.token||''), String(p.id||''), p.data || {});
  if (action === 'deletejournal') return deleteJournal_(String(p.token||''), String(p.id||''));
  if (action === 'health') return health_();
  throw new Error('Aksi tidak dikenal: ' + action);
}

function generateJournalAI_(token, context) {
  const session=requireSession_(token);
  if (!['admin','kepala_sekolah','guru','wali_kelas'].includes(normalizeRole_(session.role))) throw new Error('Akses ditolak.');
  const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY belum dikonfigurasi di Script Properties Apps Script.');

  const configuredModel=String(PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || '').trim();
  const prompt='Anda adalah asisten guru Indonesia. Buat isi jurnal mengajar yang praktis, formal, singkat, sesuai Kurikulum Merdeka/Deep Learning bila relevan. Data: '+JSON.stringify(context)+'\\nKembalikan HANYA JSON valid dengan tiga properti: objective, activities, reflection. objective berisi 1-3 tujuan pembelajaran terukur. activities berisi langkah pendahuluan, inti, penutup dalam paragraf ringkas. reflection berisi hasil/refleksi dan tindak lanjut. Jangan gunakan markdown.';

  const models=listGeminiModels_(key);
  const candidates=[];
  if (configuredModel) candidates.push(normalizeGeminiModel_(configuredModel));
  ['gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-2.5-flash','gemini-2.5-flash-lite']
    .forEach(m=>{ if (candidates.indexOf(m)<0) candidates.push(m); });
  models.forEach(m=>{ if (candidates.indexOf(m)<0) candidates.push(m); });

  let lastError='';
  for (let i=0;i<candidates.length;i++) {
    const model=candidates[i];
    if (models.length && model===normalizeGeminiModel_(configuredModel) && models.indexOf(model)<0) {
      lastError='Model GEMINI_MODEL "'+model+'" tidak tersedia atau tidak mendukung generateContent.';
      continue;
    }
    if (models.length && models.indexOf(model)<0) continue;
    const result=callGeminiGenerate_(key,model,prompt);
    if (result.ok) {
      audit_(session.username,'AI_GENERATE','Journals','', 'Generate tujuan, kegiatan, refleksi dengan model '+model);
      return {ok:true,result:{objective:String(result.data.objective||''),activities:String(result.data.activities||''),reflection:String(result.data.reflection||''),model:model}};
    }
    lastError=result.error;
    if (result.code!==404 && result.code!==400) break;
  }
  throw new Error(lastError || 'Gemini tidak menemukan model yang dapat digunakan untuk generateContent.');
}

function normalizeGeminiModel_(model) {
  return String(model||'').replace(/^models\//,'').trim();
}

function listGeminiModels_(key) {
  const cache=CacheService.getScriptCache();
  const cached=cache.get('gemini_models');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const res=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models',{
    method:'get',
    headers:{'x-goog-api-key':key},
    muteHttpExceptions:true
  });
  const code=res.getResponseCode(), body=res.getContentText();
  if (code<200 || code>=300) {
    let detail=body;
    try { const e=JSON.parse(body); detail=e.error && e.error.message ? e.error.message : body; } catch (_) {}
    throw new Error('Gagal membaca daftar model Gemini ('+code+'): '+String(detail).slice(0,300));
  }
  let data;
  try { data=JSON.parse(body); } catch (_) { throw new Error('Respons daftar model Gemini tidak valid.'); }
  const models=(data.models||[])
    .filter(m=>Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.indexOf('generateContent')>=0)
    .map(m=>normalizeGeminiModel_(m.name))
    .filter(Boolean);
  cache.put('gemini_models',JSON.stringify(models),600);
  return models;
}

function callGeminiGenerate_(key,model,prompt) {
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  const headers={'x-goog-api-key':key};
  const basePayload={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.35,responseMimeType:'application/json'}};
  const fallbackPayload={contents:basePayload.contents,generationConfig:{temperature:0.35}};
  const maxRetries=2;

  for (let attempt=0; attempt<=maxRetries; attempt++) {
    let res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:headers,payload:JSON.stringify(attempt===0?basePayload:fallbackPayload),muteHttpExceptions:true});
    let code=res.getResponseCode(), body=res.getContentText();

    if (code===400 && attempt===0) {
      res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:headers,payload:JSON.stringify(fallbackPayload),muteHttpExceptions:true});
      code=res.getResponseCode();
      body=res.getContentText();
    }

    if(code>=200 && code<300) {
      let parsed;
      try { parsed=JSON.parse(body); } catch(e){ return {ok:false,code:500,error:'Respons AI tidak valid.'}; }
      const text=parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts && parsed.candidates[0].content.parts[0] && parsed.candidates[0].content.parts[0].text;
      if(!text) return {ok:false,code:500,error:'AI tidak menghasilkan konten.'};

      let data;
      try { data=JSON.parse(text); } catch(e) {
        const match=String(text).match(/\\{[\\s\\S]*\\}/);
        if (!match) return {ok:false,code:500,error:'Format hasil AI tidak valid.'};
        try { data=JSON.parse(match[0]); } catch (_) { return {ok:false,code:500,error:'Format hasil AI tidak valid.'}; }
      }
      return {ok:true,data:data};
    }

    let errorCode='', detail=body;
    try {
      const parsedError=JSON.parse(body);
      errorCode=String(parsedError.error && (parsedError.error.status || parsedError.error.code || parsedError.error.message) || '').toLowerCase();
      detail=parsedError.error && parsedError.error.message ? parsedError.error.message : body;
    } catch (_) {}

    const detailText=errorCode+' '+detail;
    const dailyQuota=/quota_exceeded|daily quota|quota.*day/i.test(detailText);

    if (code===429 && dailyQuota) {
      return {ok:false,code:429,error:'Kuota harian Gemini API sedang habis. Tunggu sampai kuota reset atau tingkatkan kuota project.'};
    }

    const retryable=code===429 || code===408 || (code>=500 && code<=599);
    if (retryable && attempt<maxRetries) {
      const delayMs=Math.min(8000,2000*Math.pow(2,attempt))+Math.floor(Math.random()*500);
      Utilities.sleep(delayMs);
      continue;
    }

    if (code===429) {
      return {ok:false,code:429,error:'Gemini sedang membatasi permintaan (429). Sistem sudah mencoba ulang otomatis. Silakan tunggu sebentar lalu coba lagi.'};
    }

    return {ok:false,code:code,error:'AI gagal ('+code+') pada model "'+model+'": '+String(detail).slice(0,400)};
  }

  return {ok:false,code:500,error:'AI gagal setelah percobaan ulang.'};
}

function journalPayload_(data) {
  const allowed=['date','teacher','className','subject','hours','topic','objective','activities','reflection','created'];
  const out={};
  allowed.forEach(k=>{ if (data && data[k] != null) out[k]=data[k]; });
  return out;
}

function listJournals_(token) {
  const session=requireSession_(token);
  const rows=readSheetObjects_('Journals');
  const role=normalizeRole_(session.role);
  const classes=assignedClasses_(session).map(x=>x.toLowerCase());
  const data=role==='admin'||role==='kepala_sekolah'?rows:role==='guru'?rows.filter(j=>samePerson_(j.teacher,session.name)):rows.filter(j=>classes.includes(String(j.className||'').toLowerCase()));
  return {ok:true,data:data};
}

function createJournal_(token, rawData) {
  const session=requireSession_(token);
  if (!['admin','kepala_sekolah','guru','wali_kelas'].includes(normalizeRole_(session.role))) throw new Error('Akses ditolak.');
  const data=journalPayload_(rawData);
  if (['guru','wali_kelas'].includes(normalizeRole_(session.role))) data.teacher=session.name;
  if (normalizeRole_(session.role)==='wali_kelas' && !assignedClasses_(session).map(x=>x.toLowerCase()).includes(String(data.className||'').toLowerCase())) throw new Error('Anda hanya dapat membuat jurnal untuk kelas yang menjadi tanggung jawab Anda.');
  if (!data.date || !data.teacher || !data.className || !data.subject || !data.topic) {
    throw new Error('Tanggal, guru, kelas, mata pelajaran, dan materi wajib diisi.');
  }
  const id=Utilities.getUuid();
  const now=new Date();
  const row=SHEETS.Journals.map(h=>{
    if (h==='id') return id;
    if (h==='created') return data.created || now.toISOString();
    if (h==='updatedAt') return now;
    return data[h] == null ? '' : data[h];
  });
  sheet_('Journals').appendRow(row);
  audit_(session.username,'CREATE','Journals',id,'Membuat jurnal mengajar');
  return {ok:true,data:journalById_(id)};
}

function updateJournal_(token,id,rawData) {
  const session=requireSession_(token);
  if (!['admin','kepala_sekolah','guru','wali_kelas'].includes(session.role)) throw new Error('Akses ditolak.');
  if (!id) throw new Error('ID jurnal tidak ditemukan.');
  const sh=sheet_('Journals');
  const values=sh.getDataRange().getValues();
  if (values.length<2) throw new Error('Jurnal tidak ditemukan.');
  const headers=values[0], idx=headers.indexOf('id');
  let rowNumber=-1;
  for (let i=1;i<values.length;i++) if (String(values[i][idx])===String(id)) { rowNumber=i+1; break; }
  if (rowNumber<0) throw new Error('Jurnal tidak ditemukan.');
  const old={}; headers.forEach((h,i)=>old[h]=values[rowNumber-1][i]);
  assertJournalScope_(session, old);
  const data=journalPayload_(rawData);
  if (['guru','wali_kelas'].includes(normalizeRole_(session.role))) data.teacher=session.name;
  if (normalizeRole_(session.role)==='wali_kelas' && !assignedClasses_(session).map(x=>x.toLowerCase()).includes(String(data.className||old.className||'').toLowerCase())) throw new Error('Anda hanya dapat mengubah jurnal untuk kelas yang menjadi tanggung jawab Anda.');
  const row=headers.map(h=>{
    if (h==='id') return old.id;
    if (h==='updatedAt') return new Date();
    if (Object.prototype.hasOwnProperty.call(data,h)) return data[h];
    return old[h];
  });
  sh.getRange(rowNumber,1,1,headers.length).setValues([row]);
  audit_(session.username,'UPDATE','Journals',id,'Memperbarui jurnal mengajar');
  return {ok:true,data:journalById_(id)};
}

function deleteJournal_(token,id) {
  const session=requireSession_(token);
  if (!['admin','kepala_sekolah','guru','wali_kelas'].includes(session.role)) throw new Error('Akses ditolak.');
  if (!id) throw new Error('ID jurnal tidak ditemukan.');
  const sh=sheet_('Journals'), values=sh.getDataRange().getValues(), idx=values[0].indexOf('id');
  let rowNumber=-1;
  for (let i=1;i<values.length;i++) if (String(values[i][idx])===String(id)) { rowNumber=i+1; break; }
  if (rowNumber<0) throw new Error('Jurnal tidak ditemukan.');
  const old={}; values[0].forEach((h,i)=>old[h]=values[rowNumber-1][i]);
  assertJournalScope_(session, old);
  sh.deleteRow(rowNumber);
  audit_(session.username,'DELETE','Journals',id,'Menghapus jurnal mengajar');
  return {ok:true,id:id};
}

function journalById_(id) {
  const rows=readSheetObjects_('Journals');
  const row=rows.find(x=>String(x.id)===String(id));
  if (!row) throw new Error('Jurnal tidak ditemukan.');
  return row;
}

function setupDatabase() {
  if (CONFIG.SPREADSHEET_ID === 'PASTE_SPREADSHEET_ID_HERE') {
    throw new Error('Isi CONFIG.SPREADSHEET_ID terlebih dahulu.');
  }
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    else sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  // Backfill stable IDs for legacy records so edit/delete works across devices.
  Object.keys(SHEETS).forEach(name => {
    const headers = SHEETS[name];
    const idIndex = headers.indexOf('id');
    if (idIndex < 0) return;
    const sh = ss.getSheetByName(name);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    const ids = sh.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
    let changed = false;
    ids.forEach((row, i) => {
      const wholeRow = sh.getRange(i + 2, 1, 1, headers.length).getValues()[0];
      if (wholeRow.some(v => v !== '') && !row[0]) {
        row[0] = Utilities.getUuid();
        changed = true;
      }
    });
    if (changed) sh.getRange(2, idIndex + 1, ids.length, 1).setValues(ids);
  });
  const users = sheet_('Users');
  if (users.getLastRow() === 1) {
    users.appendRow([
      Utilities.getUuid(),'admin','Administrator','admin',
      sha256_('Admin123!'),'1',new Date(),new Date()
    ]);
  }
  const settings = sheet_('Settings');
  if (settings.getLastRow() === 1) {
    [
      ['schoolName','MIN 1 Tanggamus',new Date()],
      ['year','2026/2027',new Date()],
      ['address','Tanggamus, Lampung',new Date()],
      ['principal','Kusairi, S.Pd.I.',new Date()]
    ].forEach(r=>settings.appendRow(r));
  }
  return {ok:true,message:'Database siap.',spreadsheet:ss.getUrl()};
}

function login_(username, passwordHash) {
  requireConfig_();
  const user = findUser_(username);
  if (!user || String(user.active) !== '1' || user.passwordHash !== passwordHash) {
    throw new Error('Username atau password salah.');
  }
  const token = Utilities.getUuid() + '.' + Utilities.getUuid();
  CacheService.getScriptCache().put('session:' + token, JSON.stringify({
    userId:user.id,username:user.username,name:user.name,role:user.role
  }), CONFIG.SESSION_SECONDS);
  audit_(user.username,'LOGIN','Users',user.id,'Login berhasil');
  return {ok:true,token,user:{id:user.id,username:user.username,name:user.name,role:user.role},expiresIn:CONFIG.SESSION_SECONDS};
}

function logout_(token) {
  if (token) CacheService.getScriptCache().remove('session:' + token);
  return {ok:true};
}

function bootstrap_(token) {
  const session = requireSession_(token);
  const data = filterDatabaseForRole_(readDatabase_(), session);
  return {ok:true,user:session,data:data};
}

function canonicalPerson_(value) {
  return String(value || '').toLowerCase().trim().split(',')[0].replace(/\s+/g,' ');
}
function samePerson_(a, b) {
  const x=canonicalPerson_(a), y=canonicalPerson_(b);
  return !!x && !!y && (x===y || x.includes(y) || y.includes(x));
}
function assignedClasses_(session) {
  const fromClasses=readSheetObjects_('Classes').filter(c=>samePerson_(c.teacher,session.name)).map(c=>String(c.name||''));
  const fromSchedules=readSheetObjects_('Schedules').filter(s=>samePerson_(s.teacher,session.name)).map(s=>String(s.className||''));
  return Array.from(new Set(fromClasses.concat(fromSchedules).filter(Boolean)));
}
function filterDatabaseForRole_(data, session) {
  const role=normalizeRole_(session.role);
  if (role==='admin' || role==='kepala_sekolah') return data;
  const classes=assignedClasses_(session);
  const classSet=new Set(classes.map(x=>x.toLowerCase()));
  data.teachers=data.teachers.filter(t=>samePerson_(t.name,session.name));
  data.classes=data.classes.filter(c=>classSet.has(String(c.name||'').toLowerCase()));
  data.students=data.students.filter(s=>classSet.has(String(s.className||'').toLowerCase()));
  data.journals=data.journals.filter(j=>role==='guru'?samePerson_(j.teacher,session.name):classSet.has(String(j.className||'').toLowerCase()));
  data.attendance=data.attendance.filter(a=>role==='guru'?samePerson_(a.teacher,session.name):classSet.has(String(a.className||'').toLowerCase()));
  data.plans=data.plans.filter(p=>classSet.has(String(p.className||'').toLowerCase()));
  data.schedules=data.schedules.filter(s=>role==='guru'?samePerson_(s.teacher,session.name):classSet.has(String(s.className||'').toLowerCase()));
  return data;
}
function assertRecordScope_(session, collection, data) {
  const role=normalizeRole_(session.role);
  if (role==='admin' || role==='kepala_sekolah') return;
  if (role==='guru') {
    if (collection==='attendance' && !samePerson_(data.teacher,session.name)) throw new Error('Guru hanya dapat mengubah absensi miliknya sendiri.');
    if (collection==='schedules' && !samePerson_(data.teacher,session.name)) throw new Error('Guru hanya dapat mengubah jadwal miliknya sendiri.');
    if (collection==='plans' && !assignedClasses_(session).map(x=>x.toLowerCase()).includes(String(data.className||'').toLowerCase())) throw new Error('Guru hanya dapat mengubah perangkat ajar untuk kelas yang ditugaskan.');
    return;
  }
  if (role==='wali_kelas') {
    const classes=assignedClasses_(session).map(x=>x.toLowerCase());
    if (['students','classes','attendance','schedules','plans'].includes(collection) && !classes.includes(String(data.className||data.name||'').toLowerCase())) {
      throw new Error('Akses dibatasi pada kelas yang menjadi tanggung jawab Anda.');
    }
  }
}
function assertJournalScope_(session, journal) {
  const role=normalizeRole_(session.role);
  if (role==='admin' || role==='kepala_sekolah') return;
  if (role==='guru' && samePerson_(journal.teacher,session.name)) return;
  if (role==='wali_kelas' && assignedClasses_(session).map(x=>x.toLowerCase()).includes(String(journal.className||'').toLowerCase())) return;
  throw new Error('Akses ditolak: jurnal ini bukan milik Anda atau bukan kelas tanggung jawab Anda.');
}

function saveAll_(token, rawData) {
  requireSession_(token);
  throw new Error('Sinkronisasi massal dinonaktifkan. Gunakan API CRUD per data agar perubahan pengguna lain tidak tertimpa.');
}

function normalizeRole_(role) {
  const value = String(role || '').trim().toLowerCase().replace(/[ -]+/g, '_');
  if (value === 'kepala sekolah' || value === 'kepala_sekolah') return 'kepala_sekolah';
  if (value === 'wali kelas' || value === 'wali_kelas' || value === 'walikelas') return 'wali_kelas';
  return value;
}

function collectionPermission_(role, collection) {
  const matrix = {
    admin: ['teachers','students','classes','attendance','plans','schedules'],
    kepala_sekolah: ['teachers','students','classes','attendance','plans','schedules'],
    guru: ['attendance','plans','schedules'],
    wali_kelas: ['attendance','students','classes','schedules']
  };
  return (matrix[normalizeRole_(role)] || []).includes(collection);
}

function saveRecord_(token, collection, rawData) {
  const session = requireSession_(token);
  const sheetMap = {teachers:'Teachers',students:'Students',classes:'Classes',attendance:'Attendance',plans:'Plans',schedules:'Schedules'};
  if (!sheetMap[collection]) throw new Error('Jenis data tidak didukung.');
  if (!collectionPermission_(session.role, collection)) throw new Error('Akses ditolak untuk menyimpan '+collection+'.');
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
  assertRecordScope_(session, collection, data);
  const sheetName = sheetMap[collection], sh = sheet_(sheetName);
  const headers = SHEETS[sheetName];
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) throw new Error('Skema ID belum tersedia untuk '+collection+'.');
  const values = sh.getDataRange().getValues();
  let rowNumber = -1;
  if (data.id !== undefined && data.id !== null && String(data.id) !== '') {
    for (let i=1;i<values.length;i++) if (String(values[i][idIndex]) === String(data.id)) { rowNumber=i+1; break; }
  }
  if (rowNumber > 0) {
    const existing = {};
    headers.forEach((h,i)=>existing[h]=values[rowNumber-1][i]);
    assertRecordScope_(session, collection, existing);
  }
  const wasUpdate = rowNumber > 0;
  const now = new Date();
  const record = {};
  headers.forEach(h => {
    if (h === 'id') record[h] = rowNumber > 0 ? data.id : Utilities.getUuid();
    else if (h === 'createdAt') record[h] = (rowNumber > 0 && data[h]) || data[h] || now;
    else if (h === 'updatedAt') record[h] = now;
    else record[h] = data[h] == null ? '' : data[h];
  });
  const row = headers.map(h => record[h]);
  if (rowNumber > 0) sh.getRange(rowNumber,1,1,headers.length).setValues([row]);
  else { sh.appendRow(row); rowNumber=sh.getLastRow(); }
  audit_(session.username, wasUpdate ? 'UPDATE' : 'CREATE', sheetName, record.id, 'CRUD '+collection);
  return {ok:true,data:record,message:'Data berhasil disimpan ke Google Sheets.'};
}

function deleteRecord_(token, collection, id) {
  const session = requireSession_(token);
  const sheetMap = {teachers:'Teachers',students:'Students',classes:'Classes',attendance:'Attendance',plans:'Plans',schedules:'Schedules'};
  if (!sheetMap[collection]) throw new Error('Jenis data tidak didukung.');
  if (!collectionPermission_(session.role, collection)) throw new Error('Akses ditolak untuk menghapus '+collection+'.');
  if (!id) throw new Error('ID data tidak valid.');
  const sheetName=sheetMap[collection], sh=sheet_(sheetName), values=sh.getDataRange().getValues();
  const idx=values[0].indexOf('id');
  for(let i=1;i<values.length;i++){
    if(String(values[i][idx])===String(id)){
      const record={}; values[0].forEach((h,j)=>record[h]=values[i][j]);
      assertRecordScope_(session, collection, record);
      sh.deleteRow(i+1);
      audit_(session.username,'DELETE',sheetName,id,'CRUD '+collection);
      return {ok:true,id:id,message:'Data berhasil dihapus dari Google Sheets.'};
    }
  }
  throw new Error('Data tidak ditemukan atau sudah dihapus oleh pengguna lain.');
}

function saveSchoolSettings_(token, rawData) {
  const session = requireSession_(token);
  if (!['admin','kepala_sekolah'].includes(normalizeRole_(session.role))) throw new Error('Hanya admin atau kepala sekolah yang dapat mengubah pengaturan sekolah.');
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});
  const fields = {
    schoolName: String(data.name || '').trim(),
    year: String(data.year || '').trim(),
    address: String(data.address || '').trim(),
    principal: String(data.principal || '').trim()
  };
  if (!fields.schoolName) throw new Error('Nama sekolah wajib diisi.');
  if (!fields.year) throw new Error('Tahun pelajaran wajib diisi.');

  const sh = sheet_('Settings');
  const lastRow = sh.getLastRow();
  const existing = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 3).getValues() : [];
  const rowByKey = {};
  existing.forEach((row, i) => { rowByKey[String(row[0])] = i + 2; });
  const now = new Date();
  Object.keys(fields).forEach(key => {
    const row = rowByKey[key];
    if (row) {
      sh.getRange(row, 2, 1, 2).setValues([[fields[key], now]]);
    } else {
      sh.appendRow([key, fields[key], now]);
    }
  });
  audit_(session.username, 'SAVE_SCHOOL_SETTINGS', 'Settings', '', 'Pengaturan identitas sekolah diperbarui');
  return {ok:true,message:'Pengaturan sekolah berhasil disimpan ke Google Sheets.',data:readDatabase_().school};
}

function changePassword_(token,currentHash,newHash) {
  const session = requireSession_(token);
  if (!newHash || newHash.length !== 64) throw new Error('Hash password baru tidak valid.');
  const user = findUser_(session.username);
  if (!user || user.passwordHash !== currentHash) throw new Error('Password saat ini salah.');
  const sh = sheet_('Users');
  sh.getRange(user.row,5).setValue(newHash);
  sh.getRange(user.row,8).setValue(new Date());
  audit_(session.username,'CHANGE_PASSWORD','Users',user.id,'Password diubah');
  return {ok:true,message:'Password berhasil diubah.'};
}

function health_() {
  requireConfig_();
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return {ok:true,spreadsheet:ss.getName(),sheets:ss.getSheets().map(s=>s.getName()),time:new Date().toISOString()};
}

function readDatabase_() {
  const rows = {};
  rows.teachers = readSheetObjects_('Teachers');
  rows.students = readSheetObjects_('Students');
  rows.classes = readSheetObjects_('Classes');
  rows.journals = readSheetObjects_('Journals');
  rows.attendance = readSheetObjects_('Attendance');
  rows.plans = readSheetObjects_('Plans');
  rows.schedules = readSheetObjects_('Schedules');
  const settings = {};
  readSheetObjects_('Settings').forEach(x => settings[x.key] = x.value);
  rows.school = {
    name:settings.schoolName || 'MIN 1 Tanggamus',
    year:settings.year || '2026/2027',
    address:settings.address || 'Tanggamus, Lampung',
    principal:settings.principal || 'Kusairi, S.Pd.I.'
  };
  rows.journals.forEach(x => { if (x.id) x.id = isNaN(Number(x.id)) ? x.id : Number(x.id); });
  ['teachers','students','classes','attendance','plans'].forEach(k => rows[k].forEach(x => { if (x.id && !isNaN(Number(x.id))) x.id=Number(x.id); }));
  return rows;
}

function replaceCollection_(sheetName,arr) {
  const sh=sheet_(sheetName);
  clearDataRows_(sh);
  if (!arr.length) return;
  const headers=SHEETS[sheetName];
  const now=new Date();
  const values=arr.map(obj=>headers.map(h=>{
    if (h==='createdAt' || h==='updatedAt') return obj[h] || now;
    return obj[h] == null ? '' : obj[h];
  }));
  sh.getRange(2,1,values.length,headers.length).setValues(values);
}

function readSheetObjects_(name) {
  const sh=sheet_(name), values=sh.getDataRange().getValues();
  if (values.length<2) return [];
  const headers=values[0];
  return values.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>{
    const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o;
  });
}

function findUser_(username) {
  const sh=sheet_('Users'), values=sh.getDataRange().getValues();
  if (values.length<2) return null;
  for (let i=1;i<values.length;i++) {
    if (String(values[i][1]).toLowerCase()===String(username).trim().toLowerCase()) {
      return {row:i+1,id:String(values[i][0]),username:String(values[i][1]),name:String(values[i][2]),role:String(values[i][3]),passwordHash:String(values[i][4]),active:String(values[i][5])};
    }
  }
  return null;
}

function requireSession_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw=CacheService.getScriptCache().get('session:'+token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}

function audit_(username,action,collection,recordId,detail) {
  const sh=sheet_('AuditLog');
  sh.appendRow([new Date(),username,action,collection,recordId,detail]);
}

function sheet_(name) {
  requireConfig_();
  const sh=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
  if (!sh) throw new Error('Sheet belum tersedia: '+name+'. Jalankan setupDatabase().');
  return sh;
}

function clearDataRows_(sh) {
  if (sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).clearContent();
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8)
    .map(b=>('0'+(b<0?b+256:b).toString(16)).slice(-2)).join('');
}

function parseBody_(e) {
  const raw=e && e.postData && e.postData.contents;
  if (!raw) return e && e.parameter ? e.parameter : {};
  try { return JSON.parse(raw); } catch (_) { return e.parameter || {}; }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeCallback_(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(name||'')) ? name : 'callback';
}

function requireConfig_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID==='PASTE_SPREADSHEET_ID_HERE') {
    throw new Error('CONFIG.SPREADSHEET_ID belum diisi.');
  }
}
