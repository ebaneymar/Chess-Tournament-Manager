const { app, BrowserWindow, shell, nativeImage, ipcMain } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_NAME = 'Chess Tournament Manager';
const SHELL_VERSION = '2.0.3';
const GITHUB_OWNER = 'ebaneymar';
const GITHUB_REPO = 'Chess-Tournament-Manager';
const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/update-manifest.json`;

const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
const dataRoot = path.join(localAppData, APP_NAME);
const profileRoot = path.join(dataRoot, 'ElectronProfile');
const runtimeRoot = path.join(dataRoot, 'Runtime');
const runtimeAppDir = path.join(runtimeRoot, 'app');
const runtimeVersionFile = path.join(runtimeRoot, 'CURRENT_VERSION.txt');
const updatesRoot = path.join(dataRoot, 'Updates');
const pendingFile = path.join(updatesRoot, 'pending-update.json');

for (const p of [profileRoot, runtimeRoot, updatesRoot]) fs.mkdirSync(p, { recursive: true });
app.setPath('userData', profileRoot);
app.setName(APP_NAME);

let mainWindow = null;

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

function readRuntimeVersion() {
  try {
    const v = fs.readFileSync(runtimeVersionFile, 'utf8').trim();
    if (v) return normalizeVersion(v);
  } catch {}
  try {
    const info = JSON.parse(fs.readFileSync(path.join(runtimeAppDir, 'VERSION.json'), 'utf8'));
    if (info.version) return normalizeVersion(info.version);
  } catch {}
  return SHELL_VERSION;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function seedRuntimeIfNeeded() {
  const indexPath = path.join(runtimeAppDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const bundledApp = path.join(__dirname, '..', 'app');
  fs.rmSync(runtimeAppDir, { recursive: true, force: true });
  copyDirRecursive(bundledApp, runtimeAppDir);
  fs.writeFileSync(runtimeVersionFile, SHELL_VERSION + '\n', 'utf8');
}

function applyPendingRuntimeUpdate() {
  if (!fs.existsSync(pendingFile)) return;
  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    const stagedApp = String(pending.stagedApp || '');
    const version = normalizeVersion(pending.version || '');
    if (!stagedApp || !version || !fs.existsSync(path.join(stagedApp, 'index.html'))) {
      throw new Error('Pending update package is incomplete.');
    }

    const backup = path.join(runtimeRoot, 'app.previous');
    fs.rmSync(backup, { recursive: true, force: true });

    if (fs.existsSync(runtimeAppDir)) fs.renameSync(runtimeAppDir, backup);
    try {
      fs.renameSync(stagedApp, runtimeAppDir);
      fs.writeFileSync(runtimeVersionFile, version + '\n', 'utf8');
      fs.rmSync(backup, { recursive: true, force: true });
      fs.rmSync(path.dirname(stagedApp), { recursive: true, force: true });
      fs.rmSync(pendingFile, { force: true });
    } catch (e) {
      fs.rmSync(runtimeAppDir, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.renameSync(backup, runtimeAppDir);
      throw e;
    }
  } catch (e) {
    try { fs.rmSync(pendingFile, { force: true }); } catch {}
    throw e;
  }
}

async function fetchJson(url) {
  const response = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': `Chess-Tournament-Manager/${SHELL_VERSION}`
    },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Update server returned HTTP ${response.status}`);
  return response.json();
}

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('Invalid update manifest.');
  if (String(m.app || '') !== APP_NAME) throw new Error('Update manifest is for a different app.');
  if (!m.version || !m.downloadUrl || !m.sha256) throw new Error('Update manifest is missing required fields.');
  if (m.packageType && m.packageType !== 'runtime-zip') throw new Error('Unsupported update package type.');
  if (m.minimumShellVersion && compareVersions(SHELL_VERSION, m.minimumShellVersion) < 0) {
    throw new Error(`This update requires desktop shell ${m.minimumShellVersion} or newer.`);
  }
  return m;
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const temp = destination + '.tmp';
    fs.rmSync(temp, { force: true });
    const file = fs.createWriteStream(temp);
    const request = https.get(url, {
      headers: { 'User-Agent': `Chess-Tournament-Manager/${SHELL_VERSION}` }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(temp, { force: true });
        return downloadFile(response.headers.location, destination).then(resolve, reject);
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
            fs.rmSync(destination, { force: true });
            fs.renameSync(temp, destination);
            resolve();
          } catch (e) { reject(e); }
        });
      });
    });
    request.on('error', err => {
      try { file.close(); } catch {}
      fs.rmSync(temp, { force: true });
      reject(err);
    });
  });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
  });
}

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `PowerShell exited with ${code}`)));
  });
}

async function stageRuntimePackage(manifest) {
  const version = normalizeVersion(manifest.version);
  const zipPath = path.join(updatesRoot, `Chess_Tournament_Manager_Update_${version}.zip`);
  await downloadFile(String(manifest.downloadUrl), zipPath);

  const actualHash = await sha256File(zipPath);
  const expectedHash = String(manifest.sha256).trim().toLowerCase();
  if (actualHash !== expectedHash) {
    fs.rmSync(zipPath, { force: true });
    throw new Error('Update verification failed (SHA-256 mismatch).');
  }

  if (manifest.size && Number(manifest.size) !== fs.statSync(zipPath).size) {
    fs.rmSync(zipPath, { force: true });
    throw new Error('Update verification failed (file size mismatch).');
  }

  const stageRoot = path.join(updatesRoot, `stage-${version}-${Date.now()}`);
  fs.mkdirSync(stageRoot, { recursive: true });

  const escapedZip = zipPath.replaceAll("'", "''");
  const escapedStage = stageRoot.replaceAll("'", "''");
  await runPowerShell(['-Command', `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedStage}' -Force`]);

  let stagedApp = path.join(stageRoot, 'app');
  if (!fs.existsSync(path.join(stagedApp, 'index.html'))) {
    // Accept a package where app files are directly at ZIP root.
    if (fs.existsSync(path.join(stageRoot, 'index.html'))) stagedApp = stageRoot;
    else throw new Error('Update ZIP does not contain app/index.html.');
  }

  fs.writeFileSync(pendingFile, JSON.stringify({ version, stagedApp }, null, 2), 'utf8');
  fs.rmSync(zipPath, { force: true });
  return version;
}

async function checkUpdate() {
  const manifest = validateManifest(await fetchJson(MANIFEST_URL));
  const current = readRuntimeVersion();
  const version = normalizeVersion(manifest.version);
  if (compareVersions(version, current) <= 0) {
    return {
      status: 'current',
      version: current,
      message: `You already have the latest version (${current}).`
    };
  }
  return {
    status: 'available',
    version,
    notes: String(manifest.notes || ''),
    message: `Version ${version} is available.`
  };
}

async function installUpdate() {
  const manifest = validateManifest(await fetchJson(MANIFEST_URL));
  const current = readRuntimeVersion();
  const version = normalizeVersion(manifest.version);
  if (compareVersions(version, current) <= 0) {
    return { ok: true, version: current, message: 'This app is already current.' };
  }
  await stageRuntimePackage(manifest);
  setTimeout(() => {
    app.relaunch();
    app.quit();
  }, 700);
  return {
    ok: true,
    version,
    message: `Update ${version} verified. Chess Tournament Manager will restart and install it.`
  };
}

ipcMain.handle('desktop:get-version', async () => ({
  version: readRuntimeVersion(),
  shellVersion: SHELL_VERSION,
  githubRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
  saveRoot: dataRoot,
  shell: 'Standalone Electron Desktop',
  updater: 'MATH-a-PANG style · manifest + ZIP'
}));

ipcMain.handle('desktop:check-update', async () => {
  try { return await checkUpdate(); }
  catch (e) { return { status: 'error', error: e.message }; }
});

ipcMain.handle('desktop:install-update', async () => {
  try { return await installUpdate(); }
  catch (e) { throw new Error(e.message); }
});

ipcMain.handle('desktop:open-data-folder', async () => {
  await shell.openPath(dataRoot);
  return { ok: true, path: dataRoot };
});

ipcMain.handle('desktop:exit', async () => {
  setTimeout(() => app.quit(), 120);
  return { ok: true };
});

async function createWindow() {
  const iconPath = path.join(runtimeAppDir, 'assets', 'logo.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 930,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f6f8fa',
    title: `${APP_NAME} ${readRuntimeVersion()}`,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadFile(path.join(runtimeAppDir, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    seedRuntimeIfNeeded();
    applyPendingRuntimeUpdate();
    await createWindow();
  } catch (e) {
    const { dialog } = require('electron');
    dialog.showErrorBox(APP_NAME, `Could not start the desktop app.\n\n${e.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
