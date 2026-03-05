const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  load:           ()        => ipcRenderer.invoke('load-data'),
  save:           d         => ipcRenderer.invoke('save-data', d),
  dataPath:       ()        => ipcRenderer.invoke('get-data-path'),
  exportCsv:      p         => ipcRenderer.invoke('export-csv', p),
  openDataFolder: ()        => ipcRenderer.invoke('open-data-folder'),
  minimize:       ()        => ipcRenderer.send('win-minimize'),
  maximize:       ()        => ipcRenderer.send('win-maximize'),
  close:          ()        => ipcRenderer.send('win-close'),
  getVersion:     ()        => ipcRenderer.invoke('get-version'),
  onUpdateAvailable:  (cb)  => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb)  => ipcRenderer.on('update-downloaded', cb),
  onDownloadProgress: (cb)  => ipcRenderer.on('download-progress', (_e, info) => cb(info)),
  installUpdate:  ()        => ipcRenderer.send('install-update'),
})
