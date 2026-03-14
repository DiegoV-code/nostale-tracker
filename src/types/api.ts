import type { AppData, PriceEntry } from "./data"

export interface SaveResult {
  ok: boolean
}

export interface ExportCsvParams {
  name: string
  entries: PriceEntry[]
}

export interface ExportCsvResult {
  ok: boolean
  path?: string
}

export interface ElectronApi {
  load(): Promise<AppData>
  save(d: AppData): Promise<SaveResult>
  dataPath(): Promise<string>
  exportCsv(p: ExportCsvParams): Promise<ExportCsvResult>
  openDataFolder(): void
  minimize(): void
  maximize(): void
  close(): void
  getVersion?(): Promise<string | null>
  onUpdateAvailable?(cb: () => void): () => void
  onDownloadProgress?(cb: (info: { percent?: number }) => void): () => void
  onUpdateDownloaded?(cb: () => void): () => void
  onUpdateError?(cb: (msg: string) => void): () => void
  flushAndInstallUpdate(data: AppData): Promise<void>
}
