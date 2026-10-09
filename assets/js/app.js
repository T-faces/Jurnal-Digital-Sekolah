(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORE_KEY="jds_demo_v1";
const initial={school:{name:"MIN 1 Tanggamus",year:"2026/2027",address:"Tanggamus, Lampung",principal:"Kusairi, S.Pd.I."},journals:[],teachers:[{id:1,name:"Ari Agung Satria, S.Pd., Gr.",subject:"Guru Kelas",role:"Wali Kelas VI.B"},{id:2,name:"Dhita Dwi Astuti, S.Pd.",subject:"Bahasa Indonesia",role:"Guru Mapel"},{id:3,name:"M. Kaeroni, S.Pd.I.",subject:"Pendidikan Agama Islam",role:"Guru Mapel"}],students:[{id:1,name:"Azka",className:"VI.B",nis:"26001",status:"Aktif"},{id:2,name:"Gerald",className:"VI.B",nis:"26002",status:"Aktif"},{id:3,name:"Sherin",className:"VI.B",nis:"26003",status:"Aktif"},{id:4,name:"Adibah",className:"VI.B",nis:"26004",status:"Aktif"},{id:5,name:"Kian",className:"VI.B",nis:"26005",status:"Aktif"}],classes:[{id:1,name:"VI.B",teacher:"Ari Agung Satria",room:"Ruang 6B",students:28},{id:2,name:"VI.A",teacher:"Dhita Dwi Astuti",room:"Ruang 6A",students:27},{id:3,name:"V.A",teacher:"M. Kaeroni",room:"Ruang 5A",students:26}],attendance:[],plans:[],schedules:[{day:"Senin",time:"07.30–08.40",subject:"Bahasa Indonesia",className:"VI.B",teacher:"Ari Agung Satria"},{day:"Senin",time:"08.40–09.50",subject:"Matematika",className:"VI.B",teacher:"Ari Agung Satria"},{day:"Selasa",time:"07.30–08.40",subject:"IPAS",className:"VI.B",teacher:"Ari Agung Satria"},{day:"Rabu",time:"07.30–08.40",subject:"Pendidikan Pancasila",className:"VI.B",teacher:"Ari Agung Satria"},{day:"Kamis",time:"07.30–08.40",subject:"Bahasa Lampung",className:"VI.B",teacher:"Ari Agung Satria"},{day:"Jumat",time:"07.30–08.30",subject:"PJOK",className:"VI.B",teacher:"Ari Agung Satria"}]};
let db;try{db=JSON.parse(localStorage.getItem(STORE_KEY))||structuredClone(initial)}catch{db=structuredClone(initial)}
let page="dashboard", searchTerm="", editing=null, modalKind=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const save=()=>localStorage.setItem(STORE_KEY,JSON.stringify(db));
const currentUser=()=>{try{return JSON.parse(localStorage.getItem("jds_api_user_v1")||sessionStorage.getItem("jds_api_user_v1")||"null")}catch{return null}};
const dateStr=(d=new Date())=>d.toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
const shortDate=(d=new Date())=>d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
const todayISO=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2800)};
const navNames={dashboard:"Dashboard",jurnal:"Jurnal Mengajar",absensi:"Absensi Kelas",jadwal:"Jadwal Pelajaran",perangkat:"Perangkat Ajar",guru:"Data Guru",siswa:"Data Siswa",kelas:"Data Kelas",laporan:"Laporan & Rekap",pengaturan:"Pengaturan Sekolah"};
$("#todayLabel").textContent=dateStr();
const user=currentUser();
if(user){const chip=document.querySelector(".user-chip");if(chip){const av=chip.querySelector(".user-avatar"),bs=chip.querySelector("b"),sm=chip.querySelector("small");if(av)av.textContent=String(user.name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();if(bs)bs.textContent=user.name||user.username;if(sm)sm.textContent=user.role||"Pengguna";}}
function normalizeRole(role){return String(role||"").trim().toLowerCase().replace(/[ -]+/g,"_").replace("walikelas","wali_kelas")}
const pageAccess={
admin:["dashboard","jurnal","absensi","jadwal","perangkat","guru","siswa","kelas","laporan","pengaturan"],
kepala_sekolah:["dashboard","jurnal","absensi","jadwal","perangkat","guru","siswa","kelas","laporan","pengaturan"],
guru:["dashboard","jurnal","absensi","jadwal","perangkat","laporan"],
wali_kelas:["dashboard","jurnal","absensi","jadwal","perangkat","siswa","kelas","laporan"]
};
function canAccessPage(p){const role=normalizeRole(currentUser()?.role||"admin");return (pageAccess[role]||pageAccess.guru).includes(p)}
function canWriteCollection(c){const role=normalizeRole(currentUser()?.role||"admin");const matrix={admin:["journals","attendance","schedules","plans","teachers","students","classes"],kepala_sekolah:["journals","attendance","schedules","plans","teachers","students","classes"],guru:["journals","attendance","schedules","plans"],wali_kelas:["journals","attendance","schedules","students","classes"]};return (matrix[role]||[]).includes(c)}
function applyRoleUI(){
 const role=normalizeRole(currentUser()?.role||"admin");
 $$("[data-page]").forEach(n=>{n.hidden=!canAccessPage(n.dataset.page)});
 if(role==="guru"||role==="wali_kelas") $$('[data-action="reset"],[data-page="pengaturan"]').forEach(n=>n.hidden=true);
 $$("[data-action]").forEach(n=>{const act=n.dataset.action;const collection=({"add-journal":"journals","add-attendance":"attendance","add-schedule":"schedules","add-plan":"plans","add-teacher":"teachers","add-student":"students","add-class":"classes"})[act];if(collection&&!canWriteCollection(collection))n.hidden=true});
 $$("[data-edit],[data-delete]").forEach(n=>{if(!canWriteCollection(n.dataset.edit||n.dataset.delete))n.hidden=true});
}
function setPage(p){if(!canAccessPage(p)){toast("Menu ini tidak tersedia untuk peran akun Anda.");return}page=p;searchTerm="";$$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===p));$("#pageCrumb").textContent=navNames[p]||"Dashboard";$("#sidebar").classList.remove("open");render()}
function heading(title,desc,action="",label="+ Tambah Data"){return `<div class="page-heading"><div><div class="eyebrow">PORTAL AKADEMIK</div><h1>${title}</h1><p>${desc}</p></div>${action?`<button class="btn btn-primary" data-action="${action}">${label}</button>`:""}</div>`}
function stat(title,value,icon,foot){return `<article class="stat-card"><div class="stat-top"><span>${title}</span><div class="stat-icon">${icon}</div></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`}
function panel(title,content,link="",sub=""){return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:""}</div>${link?`<button class="link-btn" data-page="${link}">Lihat semua →</button>`:""}</div>${content}</section>`}
function table(headers,rows,empty="Belum ada data untuk ditampilkan."){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}"><div class="empty-state"><div class="empty-icon">▤</div><b>Data belum tersedia</b>${empty}</div></td></tr>`}</tbody></table></div>`}
function filtered(items,fields){return items.filter(x=>fields.some(f=>String(x[f]||"").toLowerCase().includes(searchTerm.toLowerCase())))}
function dashboard(){
const role=normalizeRole(currentUser()?.role||"admin");
const todayJ=db.journals.filter(x=>x.date===todayISO()).length;
const ownName=String(currentUser()?.name||"").toLowerCase();
const ownJournals=role==="admin"||role==="kepala_sekolah"?db.journals:db.journals.filter(j=>String(j.teacher||"").toLowerCase().includes(ownName)||String(j.teacher||"").toLowerCase()===ownName);
if(role==="kepala_sekolah"){
 const todayAttendance=db.attendance.filter(x=>x.date===todayISO()).length;
 const recent=[...db.journals].sort((a,b)=>(b.created||"").localeCompare(a.created||"")).slice(0,5);
 const recentHtml=recent.length?recent.map(j=>`<div class="activity"><div class="activity-icon">▤</div><div><b>${esc(j.teacher)} · ${esc(j.className)}</b><p>${esc(j.subject)} — ${esc(j.topic||"Materi belum diisi")}</p></div><time>${esc(j.date)}</time></div>`).join(""):`<div class="empty-state"><div class="empty-icon">▤</div><b>Belum ada jurnal</b>Jurnal guru akan muncul setelah tersimpan.</div>`;
 return `${heading("Dashboard Kepala Sekolah","Pantau pelaksanaan pembelajaran dan administrasi madrasah.")}<div class="stats-grid">${stat("Total Guru",db.teachers.length,"♙","Tenaga pendidik")}${stat("Total Siswa",db.students.length,"♧","Peserta didik")}${stat("Jurnal Hari Ini",todayJ,"▤","Jurnal pembelajaran")}${stat("Absensi Hari Ini",todayAttendance,"✓","Rekap absensi tersimpan")}</div><div class="dashboard-grid">${panel("Pemantauan Jurnal Guru",recentHtml,"jurnal","Jurnal terbaru dari seluruh guru")}${panel("Administrasi Sekolah",`<div class="quick-grid"><button class="quick-action" data-page="guru"><span class="q-icon">♙</span><b>Data Guru</b><small>Kelola tenaga pendidik</small></button><button class="quick-action" data-page="siswa"><span class="q-icon">♧</span><b>Data Siswa</b><small>Data peserta didik</small></button><button class="quick-action" data-page="laporan"><span class="q-icon">▥</span><b>Laporan</b><small>Rekap aktivitas sekolah</small></button><button class="quick-action" data-page="pengaturan"><span class="q-icon">⚙</span><b>Pengaturan</b><small>Identitas sekolah</small></button></div>`)}</div>`;
}
if(role==="guru"||role==="wali_kelas"){
 const mine=ownJournals;
 const scopedAttendance=role==="wali_kelas"?db.attendance:db.attendance.filter(x=>String(x.teacher||"").toLowerCase().includes(ownName));
 const label=role==="wali_kelas"?"Dashboard Wali Kelas":"Dashboard Guru";
 const recent=mine.slice().sort((a,b)=>(b.created||"").localeCompare(a.created||"")).slice(0,5);
 const recentHtml=recent.length?recent.map(j=>`<div class="activity"><div class="activity-icon">▤</div><div><b>${esc(j.subject)} · ${esc(j.className)}</b><p>${esc(j.topic||"Materi belum diisi")}</p></div><time>${esc(j.date)}</time></div>`).join(""):`<div class="empty-state"><div class="empty-icon">▤</div><b>Belum ada jurnal</b>Mulai catat kegiatan pembelajaran Anda.</div>`;
 return `${heading("Selamat datang, "+esc(currentUser()?.name||"Guru")+"!","Ringkasan pekerjaan sesuai peran Anda.")}<div class="stats-grid">${stat("Jurnal Saya",mine.length,"▤","Jurnal yang sesuai akun")}${stat("Jurnal Hari Ini",mine.filter(x=>x.date===todayISO()).length,"◷","Catatan hari ini")}${stat("Rekap Absensi",scopedAttendance.length,"✓","Data absensi yang tersedia")}${stat(role==="wali_kelas"?"Data Siswa":"Perangkat Ajar",role==="wali_kelas"?db.students.length:db.plans.length,role==="wali_kelas"?"♧":"▧",role==="wali_kelas"?"Data peserta didik":"Perencanaan pembelajaran")}</div><div class="dashboard-grid">${panel("Jurnal Terbaru",recentHtml,"jurnal","Aktivitas pembelajaran")}${panel("Akses Cepat",`<div class="quick-grid"><button class="quick-action" data-action="add-journal"><span class="q-icon">＋</span><b>Tambah Jurnal</b><small>Catat pembelajaran</small></button><button class="quick-action" data-page="absensi"><span class="q-icon">✓</span><b>Absensi</b><small>Kelola kehadiran</small></button><button class="quick-action" data-page="perangkat"><span class="q-icon">▧</span><b>Perangkat Ajar</b><small>Rencana pembelajaran</small></button></div>`)}</div>`;
}
let recent=[...db.journals].sort((a,b)=>(b.created||"").localeCompare(a.created||"")).slice(0,4);
let recentHtml=recent.length?recent.map(j=>`<div class="activity"><div class="activity-icon">▤</div><div><b>${esc(j.subject)} · ${esc(j.className)}</b><p>${esc(j.topic||"Materi belum diisi")} · ${esc(j.teacher||"Guru")}</p></div><time>${esc(j.date)}</time></div>`).join(""):`<div class="empty-state"><div class="empty-icon">◷</div><b>Belum ada aktivitas</b>Jurnal yang ditambahkan akan tampil di sini.</div>`;
return `${heading("Selamat datang kembali! 👋","Pantau aktivitas pembelajaran dan administrasi sekolah dari satu dashboard.")}<div class="stats-grid">${stat("Total Guru",db.teachers.length,"♙","Data tenaga pendidik terdaftar")}${stat("Total Siswa",db.students.length,"♧","Data siswa pada sistem")}${stat("Jurnal Hari Ini",todayJ,"▤","Catatan pembelajaran hari ini")}${stat("Rombongan Belajar",db.classes.length,"▣","Kelas terdaftar di sekolah")}</div><div class="dashboard-grid">${panel("Aktivitas Jurnal Terbaru",recentHtml,"jurnal","Ringkasan pencatatan pembelajaran terkini")}${panel("Akses Cepat",`<div class="quick-grid"><button class="quick-action" data-action="add-journal"><span class="q-icon">＋</span><b>Tambah Jurnal</b><small>Catat kegiatan pembelajaran</small></button><button class="quick-action" data-page="absensi"><span class="q-icon">✓</span><b>Absensi Kelas</b><small>Catat kehadiran siswa</small></button><button class="quick-action" data-page="jadwal"><span class="q-icon">▦</span><b>Jadwal Pelajaran</b><small>Lihat jadwal mingguan</small></button><button class="quick-action" data-page="laporan"><span class="q-icon">▥</span><b>Lihat Laporan</b><small>Rekap aktivitas sekolah</small></button></div>`)}</div><div class="dashboard-grid">${panel("Ringkasan Data Sekolah",`<div class="progress-row"><div class="progress-meta"><b>Data guru</b><span>${db.teachers.length} orang</span></div><div class="progress"><i style="width:${Math.min(db.teachers.length*10,100)}%"></i></div></div><div class="progress-row"><div class="progress-meta"><b>Data siswa</b><span>${db.students.length} siswa</span></div><div class="progress"><i style="width:${Math.min(db.students.length*3,100)}%"></i></div></div><div class="progress-row"><div class="progress-meta"><b>Jurnal tersimpan</b><span>${db.journals.length} catatan</span></div><div class="progress"><i style="width:${Math.min(db.journals.length*5,100)}%"></i></div></div>`)}${panel("Informasi Sistem",`<div class="activity"><div class="activity-icon">✓</div><div><b>Penyimpanan lokal aktif</b><p>Data demo tersimpan di browser perangkat ini.</p></div></div><div class="activity"><div class="activity-icon">ⓘ</div><div><b>Mode prototipe</b><p>Hubungkan backend untuk penggunaan multiakun dan sinkronisasi.</p></div></div>`)}</div>`}
function toolbar(placeholder,filter=""){return `<div class="toolbar"><div class="search-box"><span>⌕</span><input id="searchInput" placeholder="${placeholder}" value="${esc(searchTerm)}"></div>${filter}<button class="btn btn-light" data-action="export">⇩ Ekspor CSV</button></div>`}
function journals(){let arr=filtered([...db.journals].sort((a,b)=>(b.date||"").localeCompare(a.date||"")),["teacher","subject","className","topic","date"]);let rows=arr.map((j,i)=>`<tr><td>${esc(j.date)}</td><td><div class="person"><div class="person-avatar">${esc((j.teacher||"G").split(" ").map(x=>x[0]).slice(0,2).join(""))}</div><div><b>${esc(j.teacher)}</b><small>${esc(j.className)}</small></div></div></td><td>${esc(j.subject)}</td><td>${esc(j.topic)}</td><td>${esc(j.hours||"—")}</td><td><span class="pill">${esc(j.status||"Tersimpan")}</span></td><td><button class="link-btn" data-edit="journals" data-id="${j.id}">Edit</button> <button class="link-btn" data-delete="journals" data-id="${j.id}">Hapus</button></td></tr>`).join("");
return `${heading("Jurnal Mengajar","Kelola catatan kegiatan pembelajaran guru secara terstruktur.","add-journal","+ Buat Jurnal")}${toolbar("Cari guru, kelas, mata pelajaran...")}${panel("Daftar Jurnal Pembelajaran",table(["Tanggal","Guru / Kelas","Mata Pelajaran","Materi Pembelajaran","Jam","Status","Aksi"],rows), "",`${arr.length} catatan ditemukan`)}`}
function attendance(){let rows=db.attendance.map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.className)}</td><td>${esc(a.teacher)}</td><td>${esc(a.present)}</td><td>${esc(a.sick)}</td><td>${esc(a.permission)}</td><td>${esc(a.absent)}</td><td><button class="link-btn" data-delete="attendance" data-id="${a.id}">Hapus</button></td></tr>`).join("");return `${heading("Absensi Kelas","Catat dan pantau rekap kehadiran siswa per kelas.","add-attendance","+ Catat Absensi")}${toolbar("Cari kelas atau guru...")}${panel("Rekap Kehadiran",table(["Tanggal","Kelas","Guru","Hadir","Sakit","Izin","Alpa","Aksi"],filtered(db.attendance,["className","teacher","date"]).map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.className)}</td><td>${esc(a.teacher)}</td><td><span class="pill">${esc(a.present)}</span></td><td>${esc(a.sick)}</td><td>${esc(a.permission)}</td><td>${esc(a.absent)}</td><td><button class="link-btn" data-delete="attendance" data-id="${a.id}">Hapus</button></td></tr>`).join("")),"",`${db.attendance.length} rekap tersimpan`)}`}
function teachers(){let rows=filtered(db.teachers,["name","subject","role"]).map(t=>`<tr><td><div class="person"><div class="person-avatar">${esc(t.name.split(" ").map(x=>x[0]).slice(0,2).join(""))}</div><div><b>${esc(t.name)}</b><small>ID Guru: G-${String(t.id).padStart(3,"0")}</small></div></div></td><td>${esc(t.subject)}</td><td>${esc(t.role)}</td><td><span class="pill">Aktif</span></td><td><button class="link-btn" data-edit="teachers" data-id="${t.id}">Edit</button> <button class="link-btn" data-delete="teachers" data-id="${t.id}">Hapus</button></td></tr>`).join("");return `${heading("Data Guru","Direktori tenaga pendidik dan kependidikan sekolah.","add-teacher","+ Tambah Guru")}${toolbar("Cari nama, mapel, jabatan...")}${panel("Direktori Guru",table(["Nama Guru","Mata Pelajaran","Jabatan","Status","Aksi"],rows),"",`${db.teachers.length} guru terdaftar`)}`}
function students(){let rows=filtered(db.students,["name","className","nis"]).map(s=>`<tr><td><div class="person"><div class="person-avatar">${esc(s.name.slice(0,2).toUpperCase())}</div><div><b>${esc(s.name)}</b><small>NIS: ${esc(s.nis)}</small></div></div></td><td>${esc(s.className)}</td><td>${esc(s.nis)}</td><td><span class="pill">${esc(s.status||"Aktif")}</span></td><td><button class="link-btn" data-edit="students" data-id="${s.id}">Edit</button> <button class="link-btn" data-delete="students" data-id="${s.id}">Hapus</button></td></tr>`).join("");return `${heading("Data Siswa","Kelola identitas siswa dan penempatan rombongan belajar.","add-student","+ Tambah Siswa")}${toolbar("Cari nama, NIS, kelas...")}${panel("Daftar Siswa",table(["Nama Siswa","Kelas","NIS","Status","Aksi"],rows),"",`${db.students.length} siswa terdaftar`)}`}
function classes(){let rows=filtered(db.classes,["name","teacher","room"]).map(c=>`<tr><td><div class="person-avatar">${esc(c.name.replace(/[^A-Z0-9]/gi,""))}</div></td><td><b>${esc(c.name)}</b></td><td>${esc(c.teacher)}</td><td>${esc(c.room)}</td><td>${esc(c.students)}</td><td><button class="link-btn" data-edit="classes" data-id="${c.id}">Edit</button> <button class="link-btn" data-delete="classes" data-id="${c.id}">Hapus</button></td></tr>`).join("");return `${heading("Data Kelas","Atur rombongan belajar, wali kelas, dan ruang belajar.","add-class","+ Tambah Kelas")}${toolbar("Cari kelas, wali kelas, ruang...")}${panel("Rombongan Belajar",table(["","Nama Kelas","Wali Kelas","Ruang","Jumlah Siswa","Aksi"],rows),"",`${db.classes.length} kelas terdaftar`)}`}
function schedules(){let days=["Senin","Selasa","Rabu","Kamis","Jumat"];return `${heading("Jadwal Pelajaran","Lihat susunan kegiatan pembelajaran mingguan.","add-schedule","+ Tambah Jadwal")}<div class="week-grid">${days.map(day=>`<section class="day-card"><h3>${day}</h3>${db.schedules.filter(s=>s.day===day).map(s=>`<div class="lesson-chip"><b>${esc(s.subject)}</b><small>${esc(s.time)} · ${esc(s.className)}</small><small>${esc(s.teacher)}</small></div>`).join("")||`<p class="muted" style="font-size:10px">Belum ada jadwal</p>`}</section>`).join("")}</div><div style="height:16px"></div>${panel("Daftar Jadwal",table(["Hari","Waktu","Mata Pelajaran","Kelas","Guru","Aksi"],db.schedules.map((s,i)=>`<tr><td>${esc(s.day)}</td><td>${esc(s.time)}</td><td>${esc(s.subject)}</td><td>${esc(s.className)}</td><td>${esc(s.teacher)}</td><td><button class="link-btn" data-delete="schedules" data-id="${esc(s.id||i)}">Hapus</button></td></tr>`).join("")))}`}
function plans(){let rows=db.plans.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.subject)}</td><td>${esc(p.className)}</td><td>${esc(p.topic)}</td><td>${esc(p.objective)}</td><td><button class="link-btn" data-edit="plans" data-id="${p.id}">Edit</button> <button class="link-btn" data-delete="plans" data-id="${p.id}">Hapus</button></td></tr>`).join("");return `${heading("Perangkat Ajar","Simpan tujuan pembelajaran, materi, dan catatan perencanaan.","add-plan","+ Tambah Perangkat Ajar")}${toolbar("Cari mapel, kelas, materi...")}${panel("Perencanaan Pembelajaran",table(["Tanggal","Mata Pelajaran","Kelas","Materi","Tujuan Pembelajaran","Aksi"],filtered(db.plans,["subject","className","topic","objective","date"]).map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.subject)}</td><td>${esc(p.className)}</td><td>${esc(p.topic)}</td><td>${esc(p.objective)}</td><td><button class="link-btn" data-edit="plans" data-id="${p.id}">Edit</button> <button class="link-btn" data-delete="plans" data-id="${p.id}">Hapus</button></td></tr>`).join("")))}`}
function reports(){let total=db.journals.length, today=db.journals.filter(j=>j.date===todayISO()).length;return `${heading("Laporan & Rekap","Ringkasan data administrasi dan aktivitas pembelajaran.")}<div class="stats-grid">${stat("Total Jurnal",total,"▤","Seluruh jurnal tersimpan")}${stat("Jurnal Hari Ini",today,"◷","Berdasarkan tanggal perangkat")}${stat("Data Guru",db.teachers.length,"♙","Guru terdaftar")}${stat("Data Siswa",db.students.length,"♧","Siswa terdaftar")}</div><div class="dashboard-grid">${panel("Rekap Jurnal per Mata Pelajaran",table(["Mata Pelajaran","Jumlah Jurnal"],[...new Set(db.journals.map(j=>j.subject))].map(sub=>`<tr><td>${esc(sub)}</td><td>${db.journals.filter(j=>j.subject===sub).length}</td></tr>`).join("")))}${panel("Ekspor Laporan",`<p class="muted" style="line-height:1.7;font-size:11px">Unduh data yang tersimpan di browser ini dalam format CSV untuk diolah lebih lanjut menggunakan spreadsheet.</p><div class="quick-grid"><button class="quick-action" data-export="journals"><span class="q-icon">⇩</span><b>Ekspor Jurnal</b><small>Data jurnal mengajar</small></button><button class="quick-action" data-export="attendance"><span class="q-icon">⇩</span><b>Ekspor Absensi</b><small>Rekap kehadiran</small></button><button class="quick-action" data-export="teachers"><span class="q-icon">⇩</span><b>Ekspor Guru</b><small>Direktori guru</small></button><button class="quick-action" data-export="students"><span class="q-icon">⇩</span><b>Ekspor Siswa</b><small>Data peserta didik</small></button></div>`)}</div>`}
function settings(){return `${heading("Pengaturan Sekolah","Kelola identitas yang ditampilkan pada portal sekolah.")}<div class="settings-grid">${panel("Identitas Sekolah",`<form id="settingsForm" class="form-grid"><div class="field full"><label>Nama Sekolah</label><input name="name" required value="${esc(db.school.name)}"></div><div class="field full"><label>Tahun Pelajaran</label><input name="year" required value="${esc(db.school.year)}"></div><div class="field full"><label>Alamat Sekolah</label><textarea name="address">${esc(db.school.address)}</textarea></div><div class="field full"><label>Kepala Sekolah</label><input name="principal" value="${esc(db.school.principal)}"></div><div class="field full"><button class="btn btn-primary" type="submit">Simpan Pengaturan</button></div></form>`)}${panel("Data & Privasi",`<p style="font-size:11px;line-height:1.8;color:#77849a">Pengaturan identitas sekolah tersimpan ke Google Sheets saat backend aktif. Gunakan akun admin atau kepala sekolah untuk mengubahnya.</p><button class="btn btn-light" data-action="backup">Unduh Cadangan JSON</button> <button class="btn btn-danger" data-action="reset">Reset Data Demo</button>`)}</div>`}
function render(){if(!canAccessPage(page))page="dashboard";const map={dashboard,jurnal:journals,absensi:attendance,jadwal:schedules,perangkat:plans,guru:teachers,siswa:students,kelas:classes,laporan:reports,pengaturan:settings};$("#content").innerHTML=(map[page]||dashboard)();$("#journalCount").textContent=db.journals.length;$("#schoolName")&&($("#schoolName").textContent=db.school.name);const mini=document.querySelector(".school-mini");if(mini){const labels=mini.querySelectorAll("b,small");if(labels[0])labels[0].textContent=db.school.name||"Nama Sekolah";if(labels[1])labels[1].textContent="Tahun Pelajaran "+(db.school.year||"—")}applyRoleUI()}
const configs={
"add-journal":{title:"Tambah Jurnal Mengajar",collection:"journals",fields:[["date","Tanggal","date",todayISO()],["teacher","Nama Guru","select",()=>db.teachers.map(t=>t.name)],["className","Kelas","select",()=>db.classes.map(c=>c.name)],["subject","Mata Pelajaran","text"],["hours","Jam Pelajaran","text","1–2"],["topic","Materi Pembelajaran","text"],["objective","Tujuan Pembelajaran","textarea"],["activities","Kegiatan Pembelajaran","textarea"],["reflection","Refleksi / Catatan","textarea"]]},
"add-attendance":{title:"Catat Absensi Kelas",collection:"attendance",fields:[["date","Tanggal","date",todayISO()],["className","Kelas","select",()=>db.classes.map(c=>c.name)],["teacher","Guru Pencatat","select",()=>db.teachers.map(t=>t.name)],["present","Jumlah Hadir","number","0"],["sick","Sakit","number","0"],["permission","Izin","number","0"],["absent","Alpa","number","0"]]},
"add-teacher":{title:"Tambah Guru",collection:"teachers",fields:[["name","Nama Lengkap","text"],["subject","Mata Pelajaran","text"],["role","Jabatan","text"]]},
"add-student":{title:"Tambah Siswa",collection:"students",fields:[["name","Nama Lengkap","text"],["nis","NIS / NISN","text"],["className","Kelas","select",()=>db.classes.map(c=>c.name)],["status","Status","select",["Aktif","Pindah","Lulus"]]]},
"add-class":{title:"Tambah Kelas",collection:"classes",fields:[["name","Nama Kelas","text"],["teacher","Wali Kelas","select",()=>db.teachers.map(t=>t.name)],["room","Ruang Kelas","text"],["students","Jumlah Siswa","number","0"]]},
"add-plan":{title:"Tambah Perangkat Ajar",collection:"plans",fields:[["date","Tanggal","date",todayISO()],["subject","Mata Pelajaran","text"],["className","Kelas","select",()=>db.classes.map(c=>c.name)],["topic","Materi / Topik","text"],["objective","Tujuan Pembelajaran","textarea"]]},
"add-schedule":{title:"Tambah Jadwal Pelajaran",collection:"schedules",fields:[["day","Hari","select",["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]],["time","Waktu","text","07.30–08.40"],["subject","Mata Pelajaran","text"],["className","Kelas","select",()=>db.classes.map(c=>c.name)],["teacher","Guru","select",()=>db.teachers.map(t=>t.name)]]}
};
async function generateJournalAI(){
  const form=document.querySelector("#modalForm"); if(!form) return;
  const data=Object.fromEntries(new FormData(form).entries());
  if(!data.subject || !data.topic){toast("Isi Mata Pelajaran dan Materi Pembelajaran terlebih dahulu.");return;}
  const btn=document.querySelector("#aiJournalBtn"); if(btn){btn.disabled=true;btn.textContent="✨ Membuat...";}
  try{
    if(!window.JDS_AUTH?.generateJournalAI) throw new Error("Backend AI belum siap. Pastikan sudah login dan Web App Apps Script aktif.");
    const d=await window.JDS_AUTH.generateJournalAI({date:data.date,teacher:data.teacher,className:data.className,subject:data.subject,hours:data.hours,topic:data.topic});
    const set=(name,val)=>{const el=form.querySelector('[name="'+name+'"]');if(el)el.value=val||""};
    set("objective",d.result.objective);set("activities",d.result.activities);set("reflection",d.result.reflection);
    toast("Tujuan, kegiatan, dan refleksi berhasil dibuat AI.");
  }catch(e){toast(e.message||"Gagal membuat konten AI.");}
  finally{if(btn){btn.disabled=false;btn.textContent="✨ Generate dengan AI";}}
}
function openModal(kind,record=null){modalKind=kind;editing=record;let cfg=configs[kind];if(!cfg)return;$("#modalTitle").textContent=record?`Edit ${cfg.title.replace("Tambah ","")}`:cfg.title;const fields=$("#modalFields");fields.innerHTML=cfg.fields.map(([name,label,type,extra])=>{let value=record?.[name]??(typeof extra==="string"&&!["0","1–2","07.30–08.40"].includes(extra)?extra:"");let required=["date","teacher","className","subject","name"].includes(name);let control;if(type==="select"){let opts=typeof extra==="function"?extra():extra||[];control=`<select name="${name}" ${required?"required":""}>${opts.map(v=>`<option ${v===value?"selected":""}>${esc(v)}</option>`).join("")}</select>`}else if(type==="textarea"){control=`<textarea name="${name}" ${required?"required":""}>${esc(value)}</textarea>`}else{let def=record?value:(extra||"");control=`<input name="${name}" type="${type}" value="${esc(def)}" ${required?"required":""} ${type==="number"?'min="0"':""}>`}return `<div class="field ${type==="textarea"?"full":""}"><label>${label}${required?' <span>*</span>':""}</label>${control}</div>`}).join("");$("#modalBackdrop").classList.add("show"); if(kind==="add-journal" && !document.querySelector("#aiJournalBtn")){const actions=document.querySelector(".modal-actions"); const b=document.createElement("button"); b.type="button";b.id="aiJournalBtn";b.className="btn btn-light";b.textContent="✨ Generate dengan AI";b.title="Buat tujuan pembelajaran, kegiatan, dan refleksi otomatis";b.addEventListener("click",generateJournalAI);actions.insertBefore(b,actions.firstChild);}}
function closeModal(){$("#modalBackdrop").classList.remove("show");editing=null;modalKind=null}
function nextId(arr){return Math.max(0,...arr.map(x=>Number(x.id)||0))+1}
function exportCSV(collection){let arr=db[collection]||[];if(!arr.length){toast("Belum ada data untuk diekspor.");return}let keys=[...new Set(arr.flatMap(o=>Object.keys(o)))];let csv=[keys.join(","),...arr.map(o=>keys.map(k=>`"${String(o[k]??"").replace(/"/g,'""')}"`).join(","))].join("\r\n");let blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${collection}-${todayISO()}.csv`;a.click();URL.revokeObjectURL(a.href);toast("File CSV berhasil disiapkan.")}
function downloadJSON(){let b=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`cadangan-jurnal-sekolah-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Cadangan data berhasil disiapkan.")}
async function handleSubmit(e){
  if(e.target.id==="settingsForm"){
    e.preventDefault();
    const form=e.target;
    const btn=form.querySelector('button[type="submit"]');
    const data=Object.fromEntries(new FormData(form).entries());
    const oldLabel=btn.textContent;
    btn.disabled=true;btn.textContent="Menyimpan...";
    try{
      if(window.JDS_AUTH?.saveSchoolSettings){
        const result=await window.JDS_AUTH.saveSchoolSettings(data);
        db.school=result.data||data;
        save();
        render();
        toast("Pengaturan sekolah berhasil disimpan ke Google Sheets.");
      }else{
        db.school=data;
        save();
        render();
        toast("Pengaturan disimpan di browser ini (mode lokal).");
      }
    }catch(err){
      toast("Gagal menyimpan pengaturan: "+(err.message||"Periksa koneksi backend."));
      btn.disabled=false;btn.textContent=oldLabel;
    }
    return;
  }
  if(e.target.id!=="modalForm")return;
  e.preventDefault();
  let cfg=configs[modalKind];if(!cfg)return;
  let obj=Object.fromEntries(new FormData(e.target).entries());
  for(let f of cfg.fields){if(f[2]==="number")obj[f[0]]=Number(obj[f[0]]||0)}

  if(cfg.collection==="journals" && window.JDS_AUTH){
    const isEdit=!!editing;
    const btn=e.target.querySelector('button[type="submit"]');
    if(btn){btn.disabled=true;btn.textContent=isEdit?"Menyimpan...":"Menyimpan...";}
    try{
      let result;
      if(isEdit) result=await window.JDS_AUTH.updateJournal(editing.id,obj);
      else {obj.created=new Date().toISOString();result=await window.JDS_AUTH.createJournal(obj);}
      const savedJournal=result.data;
      if(isEdit){
        const idx=db.journals.findIndex(x=>String(x.id)===String(editing.id));
        if(idx>=0) db.journals[idx]=savedJournal; else db.journals.unshift(savedJournal);
      }else{
        db.journals.unshift(savedJournal);
      }
      save();closeModal();render();
      toast(isEdit?"Jurnal berhasil diperbarui dan disinkronkan.":"Jurnal berhasil disimpan ke Google Sheets.");
    }catch(err){
      toast(err.message||"Gagal menyimpan jurnal.");
      if(btn){btn.disabled=false;btn.textContent="Simpan Jurnal";}
    }
    return;
  }

  if(!canWriteCollection(cfg.collection)){toast("Akun Anda tidak memiliki izin mengubah data ini.");return;}
  if(!canWriteCollection(cfg.collection)){toast("Akun Anda tidak memiliki izin mengubah data ini.");return;}
  const isEdit=!!editing;
  const btn=e.target.querySelector('button[type="submit"]');
  const oldLabel=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="Menyimpan...";}
  try{
    let saved=obj;
    if(window.JDS_AUTH?.saveRecord){
      const result=await window.JDS_AUTH.saveRecord(cfg.collection,{...(isEdit?editing:obj),...obj});
      saved=result.data||obj;
    }else{
      saved={...obj,id:isEdit?editing.id:nextId(db[cfg.collection])};
    }
    const arr=db[cfg.collection];
    if(isEdit){const idx=arr.findIndex(x=>String(x.id)===String(editing.id));if(idx>=0)arr[idx]=saved;else arr.push(saved)}
    else arr.push(saved);
    save();closeModal();render();toast(isEdit?"Perubahan berhasil disimpan ke Google Sheets.":"Data berhasil ditambahkan ke Google Sheets.");
  }catch(err){
    toast("Gagal menyimpan: "+(err.message||"Periksa koneksi backend."));
    if(btn){btn.disabled=false;btn.textContent=oldLabel||"Simpan Data";}
  }
}
document.addEventListener("click",e=>{let nav=e.target.closest("[data-page]");if(nav){setPage(nav.dataset.page);return}let act=e.target.closest("[data-action]")?.dataset.action;if(act){if(act==="add-journal")openModal(act);else if(configs[act])openModal(act);else if(act==="export")exportCSV(({jurnal:"journals",absensi:"attendance",guru:"teachers",siswa:"students",kelas:"classes",perangkat:"plans"})[page]||"journals");else if(act==="backup")downloadJSON();else if(act==="reset"){if(confirm("Reset seluruh data demo ke data awal? Perubahan lokal akan hilang.")){db=structuredClone(initial);save();render();toast("Data demo telah direset.")}}return}let ex=e.target.closest("[data-export]");if(ex){exportCSV(ex.dataset.export);return}let edit=e.target.closest("[data-edit]");if(edit){let cfgKey=Object.keys(configs).find(k=>configs[k].collection===edit.dataset.edit);if(cfgKey)openModal(cfgKey,db[edit.dataset.edit].find(x=>String(x.id)===edit.dataset.id));return}let del=e.target.closest("[data-delete]");if(del){
  if(confirm("Hapus data ini? Tindakan ini tidak dapat dibatalkan.")){
    const collection=del.dataset.delete,id=del.dataset.id;
    if(!canWriteCollection(collection)){toast("Akun Anda tidak memiliki izin menghapus data ini.");return;}
    if(collection==="journals" && window.JDS_AUTH){
      const btn=del;
      btn.disabled=true;btn.textContent="Menghapus...";
      window.JDS_AUTH.deleteJournal(id).then(()=>{
        db.journals=db.journals.filter(x=>String(x.id)!==String(id));
        save();render();toast("Jurnal berhasil dihapus dari Google Sheets.");
      }).catch(err=>{
        btn.disabled=false;btn.textContent="Hapus";
        toast(err.message||"Gagal menghapus jurnal.");
      });
    }else{
      if(!canWriteCollection(collection)){toast("Akun Anda tidak memiliki izin menghapus data ini.");return;}
      const btn=del;btn.disabled=true;btn.textContent="Menghapus...";
      (async()=>{
        try{
          if(window.JDS_AUTH?.deleteRecord) await window.JDS_AUTH.deleteRecord(collection,id);
          if(collection==="schedules") db.schedules=db.schedules.filter((x,i)=>String(x.id||i)!==String(id));
          else db[collection]=db[collection].filter(x=>String(x.id)!==String(id));
          save();render();toast("Data berhasil dihapus dari Google Sheets.");
        }catch(err){btn.disabled=false;btn.textContent="Hapus";toast("Gagal menghapus: "+(err.message||"Periksa koneksi backend."))}
      })();
    }
  }
  return;
}});
document.addEventListener("submit",handleSubmit);
document.addEventListener("input",e=>{if(e.target.id==="searchInput"){let pos=e.target.selectionStart;searchTerm=e.target.value;render();let n=$("#searchInput");n?.focus();n?.setSelectionRange(pos,pos)}});
$("#modalClose").addEventListener("click",closeModal);$("#modalCancel").addEventListener("click",closeModal);$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.add("open"));$("#closeSidebar").addEventListener("click",()=>$("#sidebar").classList.remove("open"));$("#profileBtn").addEventListener("click",()=>{const u=currentUser();if(u&&window.JDS_AUTH){if(confirm("Keluar dari akun "+(u.name||u.username)+"?"))window.JDS_AUTH.logout();}else toast("Akun demo: Administrator")});
window.addEventListener("jds:ready",e=>{try{db=JSON.parse(localStorage.getItem(STORE_KEY))||db}catch(_){}const user=e.detail;if(user){const chip=document.querySelector(".user-chip");if(chip){const av=chip.querySelector(".user-avatar"),bs=chip.querySelector("b"),sm=chip.querySelector("small");if(av)av.textContent=String(user.name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();if(bs)bs.textContent=user.name||user.username;if(sm)sm.textContent=String(user.role||"Pengguna").replace(/_/g," ")} }render()});
render();
})();
