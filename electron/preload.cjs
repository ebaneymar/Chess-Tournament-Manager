const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chessDesktop', {
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
  checkUpdate: () => ipcRenderer.invoke('desktop:check-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder'),
  exit: () => ipcRenderer.invoke('desktop:exit')
});
