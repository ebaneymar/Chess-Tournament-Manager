const { app, BrowserWindow, shell, nativeImage, ipcMain, dialog } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_NAME = 'Chess Tournament Manager';
const SHELL_VERSION = '2.0.3.1';
const GITHUB_OWNER = 'ebaneymar';
const GITHUB_REPO = 'Chess-Tournament-Manager';
const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/update-manifest.json`;

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '.', 'AppData', 'Local');
const dataRoot = path.join(localAppData, APP_NAME);
const profileRoot = path.join(dataRoot, 'ElectronProfile');
const runtimeRoot = path.join(dataRoot, 'Runtime');
const runtimeAppDir = path.join(runtimeRoot, 'app');
const runtimeVersionFile = path.join(runtimeRoot, 'CURRENT_VERSION.txt');
const updatesRoot = path.join(dataRoot, 'Updates');
const pendingFile = path.join(updatesRoot, 'pending-update.json');
const logFile = path.join(dataRoot, 'startup.log');

for (const p of [dataRoot, profileRoot, runtimeRoot, updatesRoot]) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function log(message) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\r\n`, 'utf8');
  } catch {}
}

process.on('uncaughtException', e => {
  log(`uncaughtException: ${e && e.stack ? e.stack : e}`);
  try { dialog.showErrorBox(APP_NAME, `Startup error:\n\n${e.message || e}\n\nLog: ${logFile}`); } catch {}
});
process.on('unhandledRejection', e => log(`unhandledRejection: ${e && e.stack ? e.stack : e}`));

log(`Starting shell ${SHELL_VERSION}`);
app.disableHardwareAcceleration();
app.setPath('userData', profileRoot);
app.setName(APP_NAME);

let mainWindow = null;

function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '');
}
function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = normalizeVersion(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length, 4);
  for (let i=0;i<len;i++) {
    const x=pa[i]||0, y=pb[i]||0;
    if (x<y) return -1;
    if (x>y) return 1;
  }
  return 0;
}
function readRuntimeVersion() {
  try {
    const v=fs.readFileSync(runtimeVersionFile,'utf8').trim();
    if(v) return normalizeVersion(v);
  } catch {}
  return SHELL_VERSION;
}
function bundledAppDir() {
  return path.join(__dirname, '..', 'app');
}
function activeAppDir() {
  // Important compatibility fix:
  // Do NOT copy the bundled app out of app.asar during first startup.
  // v2.0.3 could fail on some Windows systems while doing that copy.
  try {
    const rv = fs.readFileSync(runtimeVersionFile,'utf8').trim();
    const idx = path.join(runtimeAppDir,'index.html');
    if (rv && compareVersions(rv, '2.0.3.1') > 0 && fs.existsSync(idx)) {
      return runtimeAppDir;
    }
  } catch {}
  return bundledAppDir();
}
function applyPendingRuntimeUpdate() {
  if (!fs.existsSync(pendingFile)) return;
  const pending = JSON.parse(fs.readFileSync(pendingFile,'utf8'));
  const stagedApp = String(pending.stagedApp || '');
  const version = normalizeVersion(pending.version || '');
  if (!stagedApp || !version || !fs.existsSync(path.join(stagedApp,'index.html'))) {
    throw new Error('Pending update package is incomplete.');
  }

  const backup = path.join(runtimeRoot,'app.previous');
  fs.rmSync(backup,{recursive:true,force:true});
  if (fs.existsSync(runtimeAppDir)) fs.renameSync(runtimeAppDir, backup);
  try {
    fs.renameSync(stagedApp, runtimeAppDir);
    fs.writeFileSync(runtimeVersionFile, version + '\n', 'utf8');
    fs.rmSync(backup,{recursive:true,force:true});
    fs.rmSync(path.dirname(stagedApp),{recursive:true,force:true});
    fs.rmSync(pendingFile,{force:true});
    log(`Applied runtime update ${version}`);
  } catch(e) {
    fs.rmSync(runtimeAppDir,{recursive:true,force:true});
    if(fs.existsSync(backup)) fs.renameSync(backup,runtimeAppDir);
    throw e;
  }
}
async function fetchJson(url) {
  const response = await fetch(url + (url.includes('?')?'&':'?') + 't=' + Date.now(), {
    headers:{'Accept':'application/json','User-Agent':`Chess-Tournament-Manager/${SHELL_VERSION}`},
    cache:'no-store'
  });
  if(!response.ok) throw new Error(`Update server returned HTTP ${response.status}`);
  return response.json();
}
function validateManifest(m) {
  if(!m || typeof m!=='object') throw new Error('Invalid update manifest.');
  if(String(m.app||'')!==APP_NAME) throw new Error('Update manifest is for a different app.');
  if(!m.version || !m.downloadUrl || !m.sha256) throw new Error('Update manifest is missing required fields.');
  if(m.packageType && m.packageType!=='runtime-zip') throw new Error('Unsupported update package type.');
  if(m.minimumShellVersion && compareVersions(SHELL_VERSION,m.minimumShellVersion)<0) {
    throw new Error(`This update requires desktop shell ${m.minimumShellVersion} or newer.`);
  }
  return m;
}
function downloadFile(url,destination) {
  return new Promise((resolve,reject)=>{
    const temp=destination+'.tmp';
    fs.rmSync(temp,{force:true});
    const file=fs.createWriteStream(temp);
    const request=https.get(url,{headers:{'User-Agent':`Chess-Tournament-Manager/${SHELL_VERSION}`}},response=>{
      if(response.statusCode>=300 && response.statusCode<400 && response.headers.location){
        file.close(); fs.rmSync(temp,{force:true});
        return downloadFile(response.headers.location,destination).then(resolve,reject);
      }
      if(response.statusCode!==200){
        file.close(); fs.rmSync(temp,{force:true});
        return reject(new Error(`Download server returned HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish',()=>file.close(()=>{
        try{
          fs.rmSync(destination,{force:true});
          fs.renameSync(temp,destination);
          resolve();
        }catch(e){reject(e);}
      }));
    });
    request.on('error',err=>{ try{file.close();}catch{} fs.rmSync(temp,{force:true}); reject(err); });
  });
}
function sha256File(file) {
  return new Promise((resolve,reject)=>{
    const hash=crypto.createHash('sha256');
    const stream=fs.createReadStream(file);
    stream.on('error',reject);
    stream.on('data',c=>hash.update(c));
    stream.on('end',()=>resolve(hash.digest('hex').toLowerCase()));
  });
}
function runPowerShell(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...args],{
      windowsHide:true,stdio:['ignore','pipe','pipe']
    });
    let stderr='';
    child.stderr.on('data',d=>stderr+=d.toString());
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(stderr.trim()||`PowerShell exited with ${code}`)));
  });
}
async function stageRuntimePackage(manifest) {
  const version=normalizeVersion(manifest.version);
  const zipPath=path.join(updatesRoot,`Chess_Tournament_Manager_Update_${version}.zip`);
  await downloadFile(String(manifest.downloadUrl),zipPath);

  const actual=await sha256File(zipPath);
  const expected=String(manifest.sha256).trim().toLowerCase();
  if(actual!==expected){ fs.rmSync(zipPath,{force:true}); throw new Error('Update verification failed (SHA-256 mismatch).'); }
  if(manifest.size && Number(manifest.size)!==fs.statSync(zipPath).size){
    fs.rmSync(zipPath,{force:true}); throw new Error('Update verification failed (file size mismatch).');
  }

  const stageRoot=path.join(updatesRoot,`stage-${version}-${Date.now()}`);
  fs.mkdirSync(stageRoot,{recursive:true});
  const escapedZip=zipPath.replaceAll("'","''");
  const escapedStage=stageRoot.replaceAll("'","''");
  await runPowerShell(['-Command',`Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedStage}' -Force`]);

  let stagedApp=path.join(stageRoot,'app');
  if(!fs.existsSync(path.join(stagedApp,'index.html'))){
    if(fs.existsSync(path.join(stageRoot,'index.html'))) stagedApp=stageRoot;
    else throw new Error('Update ZIP does not contain app/index.html.');
  }
  fs.writeFileSync(pendingFile,JSON.stringify({version,stagedApp},null,2),'utf8');
  fs.rmSync(zipPath,{force:true});
  return version;
}
async function checkUpdate() {
  const manifest=validateManifest(await fetchJson(MANIFEST_URL));
  const current=readRuntimeVersion();
  const version=normalizeVersion(manifest.version);
  if(compareVersions(version,current)<=0){
    return {status:'current',version:current,message:`You already have the latest version (${current}).`};
  }
  return {status:'available',version,notes:String(manifest.notes||''),message:`Version ${version} is available.`};
}
async function installUpdate() {
  const manifest=validateManifest(await fetchJson(MANIFEST_URL));
  const current=readRuntimeVersion();
  const version=normalizeVersion(manifest.version);
  if(compareVersions(version,current)<=0) return {ok:true,version:current,message:'This app is already current.'};
  await stageRuntimePackage(manifest);
  setTimeout(()=>{ app.relaunch(); app.quit(); },700);
  return {ok:true,version,message:`Update ${version} verified. Restarting to install.`};
}

ipcMain.handle('desktop:get-version',async()=>({
  version:readRuntimeVersion(),shellVersion:SHELL_VERSION,githubRepo:`${GITHUB_OWNER}/${GITHUB_REPO}`,
  saveRoot:dataRoot,shell:'Standalone Electron Desktop',updater:'MATH-a-PANG style · manifest + ZIP'
}));
ipcMain.handle('desktop:check-update',async()=>{ try{return await checkUpdate();}catch(e){return {status:'error',error:e.message};} });
ipcMain.handle('desktop:install-update',async()=>{ try{return await installUpdate();}catch(e){throw new Error(e.message);} });
ipcMain.handle('desktop:open-data-folder',async()=>{await shell.openPath(dataRoot);return {ok:true,path:dataRoot};});
ipcMain.handle('desktop:exit',async()=>{setTimeout(()=>app.quit(),120);return {ok:true};});

async function createWindow() {
  const appDir=activeAppDir();
  const indexPath=path.join(appDir,'index.html');
  log(`Loading app from ${indexPath}`);
  if(!fs.existsSync(indexPath)) throw new Error(`Application file missing: ${indexPath}`);

  const iconPath=path.join(appDir,'assets','logo.png');
  const icon=fs.existsSync(iconPath)?nativeImage.createFromPath(iconPath):undefined;

  mainWindow=new BrowserWindow({
    width:1500,height:930,minWidth:900,minHeight:650,show:false,autoHideMenuBar:true,
    backgroundColor:'#f6f8fa',title:`${APP_NAME} ${readRuntimeVersion()}`,icon,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,
      sandbox:false,
      nodeIntegration:false,
      devTools:false
    }
  });

  mainWindow.webContents.on('did-fail-load',(_e,code,desc,url)=>{
    log(`did-fail-load ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('render-process-gone',(_e,details)=>{
    log(`render-process-gone: ${JSON.stringify(details)}`);
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:/i.test(url)) shell.openExternal(url);
    return {action:'deny'};
  });

  await mainWindow.loadFile(indexPath);
  mainWindow.show();
  mainWindow.focus();
  log('Main window shown');
  mainWindow.on('closed',()=>{mainWindow=null;});
}

app.whenReady().then(async()=>{
  try{
    log('Electron ready');
    applyPendingRuntimeUpdate();
    await createWindow();
  }catch(e){
    log(`startup failure: ${e && e.stack ? e.stack : e}`);
    dialog.showErrorBox(APP_NAME,`Could not start the desktop app.\n\n${e.message}\n\nA diagnostic log was saved to:\n${logFile}`);
    app.quit();
  }
});
app.on('window-all-closed',()=>app.quit());
