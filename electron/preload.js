const { contextBridge, ipcRenderer } = require('electron')

function onChannel(channel, transform) {
  return (cb) => {
    const handler = transform ? (_e, ...args) => cb(transform(...args)) : cb
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

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
  onUpdateAvailable:  onChannel('update-available'),
  onUpdateDownloaded: onChannel('update-downloaded'),
  onDownloadProgress: onChannel('download-progress', (info) => info),
  onUpdateError:      onChannel('update-error', (msg) => msg),
  flushAndInstallUpdate: (data) => ipcRenderer.invoke('flush-and-install', data),
})
