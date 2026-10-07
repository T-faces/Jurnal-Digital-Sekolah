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
const call=async payload=>{
  if(!configured()) throw new Error("Backend belum dikonfigurasi.");
  const r=await fetch(cfg.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify(payload),redirect:"follow"});
  const data=await r.json();
  if(!data.ok) throw new Error(data.error||"Permintaan gagal.");
  return data;
};
const overlay=()=>{
  if(document.getElementById("jdsLogin")) return;
  const el=document.createElement("div");
  el.id="jdsLogin";
  el.innerHTML=`<div class="jds-login-card"><div class="jds-login-logo">JD</div><h1>Jurnal Digital Sekolah</h1><p>Login untuk mengakses data sekolah.</p><form id="jdsLoginForm"><label>Username<input name="username" autocomplete="username" required value="admin"></label><label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password"></label><button type="submit">Masuk ke Aplikasi</button><small id="jdsLoginMsg"></small></form></div>`;
  document.body.appendChild(el);
  $("#jdsLoginForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.target),msg=$("#jdsLoginMsg");
    msg.textContent="Memverifikasi...";
    try{
      const d=await call({action:"login",username:f.get("username"),passwordHash:await hash(f.get("password"))});
      sessionStorage.setItem(cfg.TOKEN_KEY,d.token);sessionStorage.setItem(cfg.USER_KEY,JSON.stringify(d.user));
      const boot=await call({action:"bootstrap",token:d.token});
      localStorage.setItem("jds_demo_v1",JSON.stringify(boot.data));
      location.reload();
    }catch(err){msg.textContent=err.message||"Login gagal."}
  });
};
const hydrate=async()=>{
  const token=sessionStorage.getItem(cfg.TOKEN_KEY);
  if(!token){overlay();return false}
  try{
    const d=await call({action:"bootstrap",token});
    localStorage.setItem("jds_demo_v1",JSON.stringify(d.data));
    return true;
  }catch(_){sessionStorage.removeItem(cfg.TOKEN_KEY);sessionStorage.removeItem(cfg.USER_KEY);overlay();return false}
};
if(configured()){
  const originalSet=localStorage.setItem.bind(localStorage);
  let hydrating=false,syncTimer=0;
  window.addEventListener("jds:logout",()=>{sessionStorage.removeItem(cfg.TOKEN_KEY);sessionStorage.removeItem(cfg.USER_KEY);location.reload()});
  const sync=async raw=>{
    if(hydrating||!sessionStorage.getItem(cfg.TOKEN_KEY))return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      try{await call({action:"saveAll",token:sessionStorage.getItem(cfg.TOKEN_KEY),data:JSON.parse(raw)})}
      catch(e){console.warn("Sinkronisasi backend:",e.message)}
    },500);
  };
  localStorage.setItem=(key,value)=>{
    originalSet(key,value);
    if(key==="jds_demo_v1")sync(value);
  };
  document.addEventListener("DOMContentLoaded",async()=>{hydrating=true;await hydrate();hydrating=false;});
}else{
  document.addEventListener("DOMContentLoaded",()=>{
    const n=document.createElement("div");n.className="jds-demo-badge";n.textContent="MODE DEMO • Backend belum dikonfigurasi";document.body.appendChild(n);
  });
}
})();
