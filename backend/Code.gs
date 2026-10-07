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
  SPREADSHEET_ID: 'PASTE_SPREADSHEET_ID_HERE',
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
  const action = String(p.action || '');
  if (action === 'ping') return {ok:true,app:CONFIG.APP_NAME,time:new Date().toISOString()};
  if (action === 'login') return login_(String(p.username||''),String(p.passwordHash||''));
  if (action === 'logout') return logout_(String(p.token||''));
  if (action === 'bootstrap') return bootstrap_(String(p.token||''));
  if (action === 'saveAll') return saveAll_(String(p.token||''), p.data);
  if (action === 'changePassword') return changePassword_(String(p.token||''),String(p.currentHash||''),String(p.newHash||''));
  if (action === 'health') return health_();
  throw new Error('Aksi tidak dikenal: ' + action);
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
  const data = readDatabase_();
  return {ok:true,user:session,data:data};
}

function saveAll_(token, rawData) {
  const session = requireSession_(token);
  if (!['admin','kepala_sekolah','guru'].includes(session.role)) throw new Error('Akses ditolak.');
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  const map = {
    teachers:'Teachers',students:'Students',classes:'Classes',
    journals:'Journals',attendance:'Attendance',plans:'Plans',schedules:'Schedules'
  };
  Object.keys(map).forEach(key => {
    if (Array.isArray(data[key])) replaceCollection_(map[key],data[key]);
  });
  if (data.school) {
    const s = sheet_('Settings');
    const values = [
      ['schoolName',data.school.name || '',new Date()],
      ['year',data.school.year || '',new Date()],
      ['address',data.school.address || '',new Date()],
      ['principal',data.school.principal || '',new Date()]
    ];
    clearDataRows_(s);
    if (values.length) s.getRange(2,1,values.length,3).setValues(values);
  }
  audit_(session.username,'SAVE_ALL','*','', 'Sinkronisasi data');
  return {ok:true,message:'Data tersimpan.',data:readDatabase_()};
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
