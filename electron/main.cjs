const { app, BrowserWindow, shell, nativeImage } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP_NAME = 'Chess Tournament Manager';
const APP_VERSION = '2.0.1';
const GITHUB_OWNER = 'ebaneymar';
const GITHUB_REPO = 'Chess-Tournament-Manager';
const UPDATE_ASSET = 'Chess-Tournament-Manager.exe';
const PORT = 49179;
const HOST = '127.0.0.1';

const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
const dataRoot = path.join(localAppData, APP_NAME);
const profileRoot = path.join(dataRoot, 'BrowserProfile');
const updatesRoot = path.join(dataRoot, 'Updates');

// Keep the same profile folder used by v2.0.0 so the existing local tournament
// storage has the best chance of carrying over into the standalone shell.
fs.mkdirSync(profileRoot, { recursive: true });
fs.mkdirSync(updatesRoot, { recursive: true });
app.setPath('userData', profileRoot);
app.setName(APP_NAME);

let mainWindow = null;
let server = null;
let latestRelease = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function json(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function mimeFor(file) {
  switch (path.extname(file).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.ico': return 'image/x-icon';
    case '.csv': return 'text/csv; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = normalizeVersion(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

async function githubLatestRelease() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': `Chess-Tournament-Manager/${APP_VERSION}`
    },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  return response.json();
}

function findUpdateAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find(a => String(a.name).toLowerCase() === UPDATE_ASSET.toLowerCase()) ||
    assets.find(a => /chess.*tournament.*\.exe$/i.test(String(a.name))) || null;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination + '.tmp');
    const request = https.get(url, {
      headers: { 'User-Agent': `Chess-Tournament-Manager/${APP_VERSION}` }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close(); fs.rmSync(destination + '.tmp', { force: true });
        return download(response.headers.location, destination).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        file.close(); fs.rmSync(destination + '.tmp', { force: true });
        return reject(new Error(`Download server returned HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          const temp = destination + '.tmp';
          if (fs.statSync(temp).size < 1024 * 1024) {
            fs.rmSync(temp, { force: true });
            return reject(new Error('Downloaded update is unexpectedly small.'));
          }
          fs.rmSync(destination, { force: true });
          fs.renameSync(temp, destination);
          resolve();
        });
      });
    });
    request.on('error', err => {
      file.close(); fs.rmSync(destination + '.tmp', { force: true }); reject(err);
    });
  });
}

function portableExePath() {
  // electron-builder portable target sets this to the original one-file EXE.
  return process.env.PORTABLE_EXECUTABLE_FILE || '';
}

function quoteCmd(s) { return `"${String(s).replaceAll('"', '""')}"`; }

function createUpdateScript(currentExe, newExe) {
  const script = path.join(updatesRoot, 'install-update.cmd');
  const body = [
    '@echo off',
    'setlocal',
    'timeout /t 2 /nobreak >nul',
    ':retry',
    `copy /Y ${quoteCmd(newExe)} ${quoteCmd(currentExe)} >nul 2>&1`,
    'if errorlevel 1 (',
    '  timeout /t 1 /nobreak >nul',
    '  goto retry',
    ')',
    `start "" ${quoteCmd(currentExe)}`,
    `del /Q ${quoteCmd(newExe)} >nul 2>&1`,
    'del /Q "%~f0"'
  ].join('\r\n');
  fs.writeFileSync(script, body, 'utf8');
  return script;
}

async function handleApi(req, res, pathname) {
  if (pathname === '/health') {
    res.writeHead(200, {'Content-Type':'text/plain'}); res.end('ChessTournamentManager'); return true;
  }
  if (pathname === '/api/version') {
    json(res, 200, {
      version: APP_VERSION,
      githubRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      saveRoot: dataRoot,
      shell: 'Standalone Electron Desktop'
    });
    return true;
  }
  if (pathname === '/api/open-data-folder') {
    if (req.method !== 'POST') { json(res,405,{error:'POST required'}); return true; }
    await shell.openPath(dataRoot);
    json(res,200,{ok:true,path:dataRoot}); return true;
  }
  if (pathname === '/api/exit') {
    if (req.method !== 'POST') { json(res,405,{error:'POST required'}); return true; }
    json(res,200,{ok:true}); setTimeout(()=>app.quit(),120); return true;
  }
  if (pathname === '/api/check-update') {
    try {
      latestRelease = await githubLatestRelease();
      const version = normalizeVersion(latestRelease.tag_name);
      if (compareVersions(version, APP_VERSION) <= 0) {
        json(res,200,{status:'current',version:APP_VERSION,message:'You already have the latest version.'});
      } else {
        const asset = findUpdateAsset(latestRelease);
        json(res,200,{
          status:'available',version,
          message: asset ? `Version ${version} is available on GitHub.` : `Version ${version} is available, but the Windows EXE asset is missing.`
        });
      }
    } catch (e) { json(res,502,{status:'error',error:e.message}); }
    return true;
  }
  if (pathname === '/api/install-update') {
    if (req.method !== 'POST') { json(res,405,{error:'POST required'}); return true; }
    try {
      latestRelease = latestRelease || await githubLatestRelease();
      const version = normalizeVersion(latestRelease.tag_name);
      if (compareVersions(version, APP_VERSION) <= 0) {
        json(res,200,{ok:true,message:'This app is already current.'}); return true;
      }
      const asset = findUpdateAsset(latestRelease);
      if (!asset) { json(res,404,{error:`Release ${version} does not contain ${UPDATE_ASSET}.`}); return true; }
      const currentExe = portableExePath();
      if (!currentExe) {
        json(res,500,{error:'This update can only be installed from the packaged portable EXE.'}); return true;
      }
      const newExe = path.join(updatesRoot, UPDATE_ASSET);
      await download(asset.browser_download_url, newExe);
      const script = createUpdateScript(currentExe, newExe);
      json(res,200,{ok:true,version,message:'Update downloaded. Chess Tournament Manager will restart.'});
      setTimeout(() => {
        const child = spawn('cmd.exe', ['/C', 'start', '', '/min', script], { detached:true, stdio:'ignore', windowsHide:true });
        child.unref();
        app.quit();
      }, 700);
    } catch (e) { json(res,502,{error:e.message}); }
    return true;
  }
  return false;
}

function startServer() {
  const appDir = path.join(__dirname, '..', 'app');
  server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, `http://${HOST}:${PORT}`);
      if (await handleApi(req, res, u.pathname)) return;

      let rel = decodeURIComponent(u.pathname);
      if (rel === '/') rel = '/index.html';
      const normalized = path.normalize(rel).replace(/^([.][.][/\\])+/, '');
      const target = path.join(appDir, normalized.replace(/^[/\\]+/, ''));
      if (!target.startsWith(appDir)) { res.writeHead(403); res.end('Forbidden'); return; }
      fs.stat(target, (err, stat) => {
        if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {
          'Content-Type': mimeFor(target),
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(target).pipe(res);
      });
    } catch (e) { res.writeHead(500); res.end('Application server error'); }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
}

async function createWindow() {
  const appDir = path.join(__dirname, '..', 'app');
  const iconPath = path.join(appDir, 'assets', 'logo.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 930,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f6f8fa',
    title: APP_NAME,
    icon,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (/^https?:/i.test(url) && !url.startsWith(`http://${HOST}:${PORT}`)) shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://${HOST}:${PORT}/`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    await createWindow();
  } catch (e) {
    const { dialog } = require('electron');
    dialog.showErrorBox(APP_NAME, `Could not start the desktop app.\n\n${e.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { server?.close(); } catch {} });
