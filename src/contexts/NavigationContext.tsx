import { createContext, useContext } from "react"

export type PageId = "dashboard" | "item" | "new" | "analisi" | "bazar" | "magazzino" | "nd"
export type SubPageId = "prices" | "magazzino" | "vendite" | "charts"

export interface NavigationContextValue {
  page: PageId
  setPage: (p: PageId) => void
  selItem: string | null
  setSelItem: (n: string | null) => void
  subPage: SubPageId
  setSubPage: (sp: SubPageId) => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

export const useNav = (): NavigationContextValue => {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error("useNav must be used within NavigationContext.Provider")
  return ctx
}
export default NavigationContext
