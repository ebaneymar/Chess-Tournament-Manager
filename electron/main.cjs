const { app, BrowserWindow, shell, nativeImage, ipcMain } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP_NAME = 'Chess Tournament Manager';
const APP_VERSION = '2.0.2';
const GITHUB_OWNER = 'ebaneymar';
const GITHUB_REPO = 'Chess-Tournament-Manager';
const UPDATE_ASSET = 'Chess-Tournament-Manager.exe';

const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
const dataRoot = path.join(localAppData, APP_NAME);
const profileRoot = path.join(dataRoot, 'ElectronProfile');
const updatesRoot = path.join(dataRoot, 'Updates');

fs.mkdirSync(profileRoot, { recursive: true });
fs.mkdirSync(updatesRoot, { recursive: true });
app.setPath('userData', profileRoot);
app.setName(APP_NAME);

let mainWindow = null;
let latestRelease = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map(x => parseInt(x, 10) || 0);
  const pb = normalizeVersion(b).split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
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
    const temp = destination + '.tmp';
    fs.rmSync(temp, { force: true });
    const file = fs.createWriteStream(temp);

    const request = https.get(url, {
      headers: { 'User-Agent': `Chess-Tournament-Manager/${APP_VERSION}` }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(temp, { force: true });
        return download(response.headers.location, destination).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(temp, { force: true });
        return reject(new Error(`Download server returned HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try {
            if (fs.statSync(temp).size < 1024 * 1024) {
              fs.rmSync(temp, { force: true });
              return reject(new Error('Downloaded update is unexpectedly small.'));
            }
            fs.rmSync(destination, { force: true });
            fs.renameSync(temp, destination);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    request.on('error', err => {
      file.close();
      fs.rmSync(temp, { force: true });
      reject(err);
    });
  });
}

function portableExePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || '';
}

function quoteCmd(s) {
  return `"${String(s).replaceAll('"', '""')}"`;
}

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

async function getVersionInfo() {
  return {
    version: APP_VERSION,
    githubRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    saveRoot: dataRoot,
    shell: 'Standalone Electron Desktop'
  };
}

async function checkUpdate() {
  latestRelease = await githubLatestRelease();
  const version = normalizeVersion(latestRelease.tag_name);
  if (compareVersions(version, APP_VERSION) <= 0) {
    return { status: 'current', version: APP_VERSION, message: 'You already have the latest version.' };
  }
  const asset = findUpdateAsset(latestRelease);
  return {
    status: 'available',
    version,
    message: asset ? `Version ${version} is available on GitHub.` : `Version ${version} is available, but the Windows EXE asset is missing.`
  };
}

async function installUpdate() {
  latestRelease = latestRelease || await githubLatestRelease();
  const version = normalizeVersion(latestRelease.tag_name);
  if (compareVersions(version, APP_VERSION) <= 0) {
    return { ok: true, message: 'This app is already current.' };
  }

  const asset = findUpdateAsset(latestRelease);
  if (!asset) throw new Error(`Release ${version} does not contain ${UPDATE_ASSET}.`);

  const currentExe = portableExePath();
  if (!currentExe) throw new Error('This update can only be installed from the packaged portable EXE.');

  const newExe = path.join(updatesRoot, UPDATE_ASSET);
  await download(asset.browser_download_url, newExe);
  const script = createUpdateScript(currentExe, newExe);

  setTimeout(() => {
    const child = spawn('cmd.exe', ['/C', 'start', '', '/min', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    app.quit();
  }, 700);

  return { ok: true, version, message: 'Update downloaded. Chess Tournament Manager will restart.' };
}

function registerDesktopIpc() {
  ipcMain.handle('desktop:get-version', () => getVersionInfo());
  ipcMain.handle('desktop:check-update', async () => {
    try { return await checkUpdate(); }
    catch (e) { return { status: 'error', error: e.message }; }
  });
  ipcMain.handle('desktop:install-update', async () => installUpdate());
  ipcMain.handle('desktop:open-data-folder', async () => {
    await shell.openPath(dataRoot);
    return { ok: true, path: dataRoot };
  });
  ipcMain.handle('desktop:exit', () => {
    setTimeout(() => app.quit(), 100);
    return { ok: true };
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  await mainWindow.loadFile(path.join(appDir, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    registerDesktopIpc();
    await createWindow();
  } catch (e) {
    const { dialog } = require('electron');
    dialog.showErrorBox(APP_NAME, `Could not start the desktop app.\n\n${e.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
