import type { ElectronApi } from "./types/api"

declare global {
  interface Window {
    api: ElectronApi
  }
}
