// Chess Tournament Manager — Portable Windows EXE integration.
// The Go desktop launcher exposes local /api/* endpoints.
// Tournament data itself remains in a dedicated persistent browser profile
// under %LOCALAPPDATA%\Chess Tournament Manager.

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
    if(!response.ok){
      throw new Error(data.error||data.message||`Request failed (${response.status})`);
    }
    return data;
  }

  window.checkDesktopUpdate=async function(){
    try{
      setStatus('Checking GitHub Releases for a newer version…','checking');
      const result=await api('/api/check-update');
      setStatus(result.message||'Update check complete.',result.status||'info');

      const btn=installBtn();
      if(btn){
        btn.style.display=result.status==='available'?'inline-flex':'none';
        if(result.status==='available'){
          btn.textContent=`Download & Install ${result.version||'Update'}`;
        }
      }
    }catch(e){
      setStatus('Update check failed: '+(e.message||String(e)),'error');
    }
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
    }catch(e){
      setStatus('Could not open the local save folder: '+(e.message||String(e)),'error');
    }
  };

  async function initDesktopInfo(){
    try{
      const info=await api('/api/version');
      const versionEl=document.getElementById('desktopAppVersion');
      if(versionEl)versionEl.textContent=info.version||'—';

      const localSave=document.querySelector('.desktop-app-card .desktop-value + .help');
      if(localSave){
        localSave.textContent='Tournament data is stored in this PC’s dedicated Chess Tournament Manager profile and is preserved when the EXE updates.';
      }

      if(info.githubRepo){
        setStatus(`GitHub updater: ${info.githubRepo}`,'info');
      }else{
        setStatus('GitHub updater is not configured.','warning');
      }

      // Quiet automatic check a few seconds after launch.
      setTimeout(async()=>{
        try{
          const result=await api('/api/check-update');
          if(result.status==='available'){
            setStatus(result.message||'A newer version is available.','available');
            const btn=installBtn();
            if(btn){
              btn.style.display='inline-flex';
              btn.textContent=`Download & Install ${result.version||'Update'}`;
            }
          }
        }catch(e){}
      },5000);
    }catch(e){
      setStatus('Desktop integration could not initialize: '+(e.message||String(e)),'error');
    }
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(initDesktopInfo,100));
})();
