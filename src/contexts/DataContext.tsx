import { createContext, useContext } from "react"
import type { AppData } from "../types"

export interface DataContextValue {
  data: AppData
  upd: (nd: AppData) => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export const useData = (): DataContextValue => {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData must be used within DataContext.Provider")
  return ctx
}
export default DataContext
