import { createContext, useContext } from "react"

export interface ThemeContextValue {
  theme: string
  setTheme: (t: string) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeContext.Provider")
  return ctx
}
export default ThemeContext
