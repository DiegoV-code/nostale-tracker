import type { Palette } from "../types"
import type React from "react"

/* ═══════════════════════════════════════════════════════
   PALETTE & STYLE HELPERS
   Esportati come oggetto mutabile — C viene riassegnato
   dal componente App ad ogni render in base al tema.
═══════════════════════════════════════════════════════ */
export const DARK: Palette = {
  bg:      "#13151f",
  panel:   "#1c1f2e",
  border:  "#272b3d",
  border2: "#353a52",
  text:    "#dde6f0",
  muted:   "#8895b3",
  muted2:  "#6b7a96",
  gold:    "#e8a838",
  green:   "#4ade80",
  red:     "#fb7185",
  blue:    "#60a5fa",
  purple:  "#a78bfa",
  amber:   "#f59e0b",
  cyan:    "#06b6d4",
  orange:  "#f97316",
  inputBg: "#0f1119",
  pillTxt: "#0f1119",
  flat:    "#4b5563",
  hoverBg: "rgba(255,255,255,.04)",
  hoverSi: "rgba(232,168,56,.08)",
  shadow:  "rgba(0,0,0,.3)",
}

export const LIGHT: Palette = {
  bg:      "#c8ccd6",
  panel:   "#d5d9e1",
  border:  "#6b7a8e",
  border2: "#8e99ad",
  text:    "#111827",
  muted:   "#3d4a5c",
  muted2:  "#4b5568",
  gold:    "#a06510",
  green:   "#15803d",
  red:     "#b91c1c",
  blue:    "#1d4ed8",
  purple:  "#7c3aed",
  amber:   "#b45309",
  cyan:    "#0e7490",
  orange:  "#c2410c",
  inputBg: "#bfc4d0",
  pillTxt: "#ffffff",
  flat:    "#6b7280",
  hoverBg: "rgba(0,0,0,.06)",
  hoverSi: "rgba(160,101,16,.12)",
  shadow:  "rgba(0,0,0,.12)",
}

/* Palette corrente — riassegnata da App ad ogni render */
export let C: Palette = DARK

export function setActiveTheme(theme: string): void {
  C = theme === "light" ? LIGHT : DARK
}

/* ── Style factory per input ── */
export const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: C.inputBg, border: `1px solid ${C.border2}`,
  borderRadius: 8, color: C.text, padding: "10px 13px",
  fontSize: 15, fontFamily: "monospace", outline: "none",
  width: "100%", transition: "border-color .15s",
  ...extra
})

/* ── Style factory per pill/button ── */
export const pill = (active: boolean, col: string = C.gold, extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: active ? col : "transparent",
  border: `1px solid ${active ? col : C.border2}`,
  color: active ? C.pillTxt : col,
  borderRadius: 8, padding: "9px 16px", cursor: "pointer",
  fontSize: 14, fontWeight: 700, letterSpacing: 1,
  transition: "all .15s", ...extra
})
