// Chess Tournament Manager — standalone Windows desktop integration.
// The desktop shell is Electron. No Edge/Chrome window is launched.

(function(){
  const statusEl=()=>document.getElementById('desktopUpdateStatus');
  const installBtn=()=>document.getElementById('installDesktopUpdateBtn');

  function setStatus(message,type='info'){
    const el=statusEl();
    if(!el)return;
    el.textContent=message;
    el.dataset.type=type;
  }

  async function api(path,options={}){
    const response=await fetch(path,{
      cache:'no-store',
      headers:{'Accept':'application/json',...(options.headers||{})},
      ...options
    });
    let data={};
    try{ data=await response.json(); }catch(e){}
    if(!response.ok)throw new Error(data.error||data.message||`Request failed (${response.status})`);
    return data;
  }

  function installBranding(){
    const home=document.querySelector('.home-mark');
    const side=document.querySelector('.logo');
    const image='<img class="ctm-logo-image" src="assets/logo.svg" alt="Chess Tournament Manager logo">';
    if(home)home.innerHTML=image;
    if(side)side.innerHTML=image;

    const style=document.createElement('style');
    style.textContent=`
      .home-mark,.logo{overflow:hidden;padding:0!important;background:transparent!important}
      .ctm-logo-image{display:block;width:100%;height:100%;object-fit:contain}
      .home-mark{box-shadow:0 14px 34px rgba(0,0,0,.22)}
      .brand .logo{border-radius:13px}
      .desktop-shell-pill{display:inline-flex;align-items:center;gap:6px;margin-top:7px;padding:5px 9px;border-radius:999px;border:1px solid var(--line);font-size:10px;font-weight:850;color:var(--muted);background:var(--panel)}
    `;
    document.head.appendChild(style);

    const subtitle=document.querySelector('.home-panel .subtitle');
    if(subtitle && !document.querySelector('.desktop-shell-pill')){
      const pill=document.createElement('div');
      pill.className='desktop-shell-pill';
      pill.textContent='▣ Standalone Windows Desktop App';
      subtitle.insertAdjacentElement('afterend',pill);
    }
  }

  window.checkDesktopUpdate=async function(){
    try{
      setStatus('Checking GitHub Releases for a newer version…','checking');
      const result=await api('/api/check-update');
      setStatus(result.message||'Update check complete.',result.status||'info');
      const btn=installBtn();
      if(btn){
        btn.style.display=result.status==='available'?'inline-flex':'none';
        if(result.status==='available')btn.textContent=`Download & Install ${result.version||'Update'}`;
      }
    }catch(e){ setStatus('Update check failed: '+(e.message||String(e)),'error'); }
  };

  window.installDesktopUpdate=async function(){
    const btn=installBtn();
    try{
      if(btn)btn.disabled=true;
      setStatus('Downloading the update from GitHub…','downloading');
      const result=await api('/api/install-update',{method:'POST'});
      setStatus(result.message||'Update downloaded. Restarting…','downloaded');
    }catch(e){
      if(btn)btn.disabled=false;
      setStatus('Update failed: '+(e.message||String(e)),'error');
    }
  };

  window.openDesktopDataFolder=async function(){
    try{
      const result=await api('/api/open-data-folder',{method:'POST'});
      if(result.path)setStatus('Local save folder: '+result.path,'info');
    }catch(e){ setStatus('Could not open the local save folder: '+(e.message||String(e)),'error'); }
  };

  // Override the browser-era Exit behavior with a true desktop app exit.
  window.exitProgram=async function(){
    try{ await api('/api/exit',{method:'POST'}); }catch(e){ window.close(); }
  };

  async function initDesktopInfo(){
    installBranding();
    try{
      const info=await api('/api/version');
      const versionEl=document.getElementById('desktopAppVersion');
      if(versionEl)versionEl.textContent=info.version||'—';

      const localSave=document.querySelector('.desktop-app-card .desktop-value + .help');
      if(localSave)localSave.textContent='Tournament data is stored in this PC’s dedicated Chess Tournament Manager profile and is preserved when the EXE updates.';

      setStatus(info.shell ? `${info.shell} · GitHub updater: ${info.githubRepo}` : `GitHub updater: ${info.githubRepo}`,'info');

      setTimeout(async()=>{
        try{
          const result=await api('/api/check-update');
          if(result.status==='available'){
            setStatus(result.message||'A newer version is available.','available');
            const btn=installBtn();
            if(btn){btn.style.display='inline-flex';btn.textContent=`Download & Install ${result.version||'Update'}`;}
          }
        }catch(e){}
      },5000);
    }catch(e){ setStatus('Desktop integration could not initialize: '+(e.message||String(e)),'error'); }
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(initDesktopInfo,100));
})();
