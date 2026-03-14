import type { AppData, ElectronApi, ExportCsvParams, ExportCsvResult, SaveResult } from "../types"

/* ═══════════════════════════════════════════════════════
   IPC SERVICE LAYER
   Wrappa tutte le chiamate window.api in un unico modulo.
   Se in futuro si cambia bridge IPC, basta toccare qui.
═══════════════════════════════════════════════════════ */

const ipc = (): ElectronApi => window.api

/* ── Data persistence ── */
export const loadData     = (): Promise<AppData>       => ipc().load()
export const saveData     = (d: AppData): Promise<SaveResult> => ipc().save(d)
export const getDataPath  = (): Promise<string>        => ipc().dataPath()
export const exportCsv    = (p: ExportCsvParams): Promise<ExportCsvResult> => ipc().exportCsv(p)
export const openDataFolder = (): void => ipc().openDataFolder()

/* ── Window controls ── */
export const winMinimize = (): void => ipc().minimize()
export const winMaximize = (): void => ipc().maximize()
export const winClose    = (): void => ipc().close()

/* ── App version & auto-update ── */
export const getVersion = (): Promise<string | null> => ipc().getVersion?.() ?? Promise.resolve(null)

export const onUpdateAvailable  = (cb: () => void): (() => void) | undefined => ipc().onUpdateAvailable?.(cb)
export const onDownloadProgress = (cb: (info: { percent?: number }) => void): (() => void) | undefined => ipc().onDownloadProgress?.(cb)
export const onUpdateDownloaded = (cb: () => void): (() => void) | undefined => ipc().onUpdateDownloaded?.(cb)
export const onUpdateError      = (cb: (msg: string) => void): (() => void) | undefined => ipc().onUpdateError?.(cb)

export const flushAndInstallUpdate = (data: AppData): Promise<void> => ipc().flushAndInstallUpdate(data)
