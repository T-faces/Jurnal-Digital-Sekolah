(()=>{
"use strict";
window.JDS_BACKEND={
  API_URL:"https://script.google.com/macros/s/AKfycbzxyaNd5Sj84BJc8MvLdp7jVGGUARu3zTu6KawN0e66vNTX_lELQHcFFdWDC_w1sEtjsg/exec",
  TOKEN_KEY:"jds_api_token_v1",
  USER_KEY:"jds_api_user_v1"
};
const cfg=window.JDS_BACKEND;
const configured=()=>cfg.API_URL && !cfg.API_URL.includes("PASTE_APPS_SCRIPT_WEB_APP_URL_HERE");
const $=s=>document.querySelector(s);
const hash=async value=>{
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
};
const getToken=()=>localStorage.getItem(cfg.TOKEN_KEY)||sessionStorage.getItem(cfg.TOKEN_KEY)||"";
const setSession=(token,user)=>{
  localStorage.setItem(cfg.TOKEN_KEY,token);
  localStorage.setItem(cfg.USER_KEY,JSON.stringify(user));
  sessionStorage.setItem(cfg.TOKEN_KEY,token);
  sessionStorage.setItem(cfg.USER_KEY,JSON.stringify(user));
};
const clearSession=()=>{
  localStorage.removeItem(cfg.TOKEN_KEY);localStorage.removeItem(cfg.USER_KEY);
  sessionStorage.removeItem(cfg.TOKEN_KEY);sessionStorage.removeItem(cfg.USER_KEY);
};
const call=async payload=>{
  if(!configured()) throw new Error("Backend belum dikonfigurasi.");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(cfg.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify(payload),redirect:"follow",cache:"no-store",signal:controller.signal});
    const text=await r.text();
    let data;
    try{data=JSON.parse(text)}catch(_){throw new Error("Respons backend tidak valid. Pastikan Web App Apps Script aktif dan aksesnya 'Anyone'.")}
    if(!r.ok||!data.ok){
      const message=data.error||("HTTP "+r.status);
      if(/Sesi (tidak ditemukan|berakhir)/i.test(message)){
        clearSession();
        if(!document.getElementById("jdsLogin")) overlay();
      }
      throw new Error(message);
    }
    return data;
  }catch(err){
    if(err.name==="AbortError") throw new Error("Backend tidak merespons dalam 20 detik.");
    throw err;
  }finally{clearTimeout(timer)}
};
const overlay=()=>{
  if(document.getElementById("jdsLogin")) return;
  const el=document.createElement("div");
  el.id="jdsLogin";
  el.innerHTML=`<div class="jds-login-card"><div class="jds-login-logo">JD</div><h1>Jurnal Digital Sekolah</h1><p>Login untuk mengakses data sekolah.</p><form id="jdsLoginForm"><label>Username<input name="username" autocomplete="username" required value="admin"></label><label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password"></label><button type="submit">Masuk ke Aplikasi</button><small id="jdsLoginMsg"></small></form></div>`;
  document.body.appendChild(el);
  $("#jdsLoginForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.target),msg=$("#jdsLoginMsg"),btn=e.target.querySelector("button");
    msg.textContent="Memverifikasi...";btn.disabled=true;
    try{
      const d=await call({action:"login",username:String(f.get("username")||""),passwordHash:await hash(String(f.get("password")||""))});
      setSession(d.token,d.user);
      const boot=await call({action:"bootstrap",token:d.token});
      localStorage.setItem("jds_demo_v1",JSON.stringify(boot.data));
      location.reload();
    }catch(err){msg.textContent=err.message||"Login gagal.";btn.disabled=false}
  });
};
const hydrate=async()=>{
  const token=getToken();
  if(!token){overlay();return false}
  try{
    const d=await call({action:"bootstrap",token});
    setSession(token,d.user);
    localStorage.setItem("jds_demo_v1",JSON.stringify(d.data));
    window.dispatchEvent(new CustomEvent("jds:ready",{detail:d.user}));
    return true;
  }catch(err){
    clearSession();
    overlay();
    const msg=$("#jdsLoginMsg");if(msg)msg.textContent=err.message||"Sesi tidak valid. Silakan login kembali.";
    return false;
  }
};
if(configured()){
  let hydrating=true,syncTimer=0;
  window.JDS_AUTH={
    generateJournalAI:async context=>call({action:"generateJournalAI",token:getToken(),context}),
    saveSchoolSettings:async data=>call({action:"saveSchoolSettings",token:getToken(),data}),
    listJournals:async()=>call({action:"listJournals",token:getToken()}),
    createJournal:async data=>call({action:"createJournal",token:getToken(),data}),
    updateJournal:async(id,data)=>call({action:"updateJournal",token:getToken(),id,data}),
    deleteJournal:async id=>call({action:"deleteJournal",token:getToken(),id}),
    logout:async()=>{const token=getToken();try{if(token)await call({action:"logout",token})}catch(_){}clearSession();window.dispatchEvent(new Event("jds:logout"));location.reload()}};
  window.addEventListener("jds:logout",()=>clearSession());
  const originalSet=Storage.prototype.setItem;
  const originalRemove=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this===localStorage&&key==="jds_demo_v1"&&!hydrating&&getToken()){
      clearTimeout(syncTimer);
      syncTimer=setTimeout(async()=>{try{await call({action:"saveAll",token:getToken(),data:JSON.parse(value)})}catch(e){console.warn("Sinkronisasi backend:",e.message)}},500);
    }
  };
  document.addEventListener("DOMContentLoaded",async()=>{await hydrate();hydrating=false});
}else{
  document.addEventListener("DOMContentLoaded",()=>{const n=document.createElement("div");n.className="jds-demo-badge";n.textContent="MODE DEMO • Backend belum dikonfigurasi";document.body.appendChild(n)});
}
})();
