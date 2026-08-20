// Chess Tournament Manager — standalone Electron desktop integration.
// v2.0.2 removes the localhost dependency and uses a secure preload bridge.

(function(){
  const statusEl=()=>document.getElementById('desktopUpdateStatus');
  const installBtn=()=>document.getElementById('installDesktopUpdateBtn');
  const desktop=()=>window.chessDesktop;

  function setStatus(message,type='info'){
    const el=statusEl();
    if(!el)return;
    el.textContent=message;
    el.dataset.type=type;
  }

  function requireDesktop(){
    const api=desktop();
    if(!api)throw new Error('Desktop bridge is unavailable. Open the packaged Chess Tournament Manager EXE.');
    return api;
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
      const result=await requireDesktop().checkUpdate();
      if(result.status==='error')throw new Error(result.error||'Update check failed.');
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
      const result=await requireDesktop().installUpdate();
      setStatus(result.message||'Update downloaded. Restarting…','downloaded');
    }catch(e){
      if(btn)btn.disabled=false;
      setStatus('Update failed: '+(e.message||String(e)),'error');
    }
  };

  window.openDesktopDataFolder=async function(){
    try{
      const result=await requireDesktop().openDataFolder();
      if(result.path)setStatus('Local save folder: '+result.path,'info');
    }catch(e){ setStatus('Could not open the local save folder: '+(e.message||String(e)),'error'); }
  };

  window.exitProgram=async function(){
    try{ await requireDesktop().exit(); }
    catch(e){ window.close(); }
  };

  async function initDesktopInfo(){
    installBranding();
    try{
      const info=await requireDesktop().getVersion();
      const versionEl=document.getElementById('desktopAppVersion');
      if(versionEl)versionEl.textContent=info.version||'—';

      const localSave=document.querySelector('.desktop-app-card .desktop-value + .help');
      if(localSave)localSave.textContent='Tournament data is stored locally in this PC’s Chess Tournament Manager desktop profile and remains available after EXE updates.';

      setStatus(`${info.shell||'Standalone Desktop'} · GitHub updater: ${info.githubRepo}`,'info');

      setTimeout(async()=>{
        try{
          const result=await requireDesktop().checkUpdate();
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
