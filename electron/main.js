const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

const isDev = !app.isPackaged

function getDataDir() {
  return path.join(app.getPath('userData'), 'NostaleData')
}

function ensureDir() {
  const d = getDataDir()
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  return d
}

ipcMain.handle('load-data', () => {
  try {
    ensureDir()
    const f = path.join(getDataDir(), 'data.json')
    const b = path.join(getDataDir(), 'data.backup.json')
    // Try primary file first
    if (fs.existsSync(f)) {
      try { return JSON.parse(fs.readFileSync(f, 'utf-8')) }
      catch (e) { console.error('data.json corrupted, trying backup:', e.message) }
    }
    // Fallback to backup
    if (fs.existsSync(b)) {
      try { return JSON.parse(fs.readFileSync(b, 'utf-8')) }
      catch (e) { console.error('backup also corrupted:', e.message) }
    }
    return null
  } catch { return null }
})

ipcMain.handle('save-data', (_, data) => {
  try {
    const dir = ensureDir()
    const f   = path.join(dir, 'data.json')
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, 'data.backup.json'))
    fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('get-data-path', () => getDataDir())

ipcMain.handle('export-csv', (_, { name, entries }) => {
  try {
    const res = dialog.showSaveDialogSync({
      title: 'Esporta CSV',
      defaultPath: `${name}_prezzi.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!res) return { ok: false }
    const rows = entries.map(e => {
      const d = new Date(e.timestamp)
      return `"${d.toLocaleDateString('it-IT')}","${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}",${e.price},"${e.eventId||'none'}","${(e.note||'').replace(/"/g,'""')}"`
    })
    fs.writeFileSync(res, '\uFEFF' + 'Data,Ora,Prezzo,Evento,Note\n' + rows.join('\n'), 'utf-8')
    return { ok: true, path: res }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('open-data-folder', () => {
  shell.openPath(getDataDir())
})

ipcMain.on('win-minimize', () => win?.minimize())
ipcMain.on('win-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
ipcMain.on('win-close',    () => win?.close())

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('confirm-dialog', (_, msg) => {
  const result = dialog.showMessageBoxSync(win, {
    type: 'question', buttons: ['OK', 'Annulla'], defaultId: 0, cancelId: 1,
    title: 'Conferma', message: msg.replace(/⚠️\s*/g, '').split('\n')[0],
    detail: msg.includes('\n') ? msg.split('\n').slice(1).join('\n').trim() : undefined,
  })
  return result === 0
})
ipcMain.handle('flush-and-install', (_, data) => {
  // Flush any pending data to disk before installing update
  if (data) {
    try {
      const dir = ensureDir()
      const f   = path.join(dir, 'data.json')
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, 'data.backup.json'))
      fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) { console.error('Flush before update failed:', e.message) }
  }
  // Remove quit listener so app doesn't fight the updater
  app.removeAllListeners('window-all-closed')
  // Destroy all windows immediately to release file handles
  BrowserWindow.getAllWindows().forEach(w => w.destroy())
  // isSilent=false so NSIS can show retry dialog if needed, forceRunAfter=true to relaunch
  autoUpdater.quitAndInstall(false, true)
})

let win
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1000, minHeight: 680,
    frame: false, backgroundColor: '#13151f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    },
    show: false
  })
  isDev ? win.loadURL('http://localhost:5173') : win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  win.once('ready-to-show', () => {
    win.show()
    if (!isDev) {
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      autoUpdater.on('update-available', () => win.webContents.send('update-available'))
      autoUpdater.on('download-progress', (info) => win.webContents.send('download-progress', info))
      autoUpdater.on('update-downloaded', () => win.webContents.send('update-downloaded'))
      autoUpdater.on('error', (err) => {
        console.error('AutoUpdater error:', err.message)
        win.webContents.send('update-error', err.message)
      })
      autoUpdater.checkForUpdatesAndNotify()
    }
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
