/* ═══════════════════════════════════════════════════════
   GOLD FORMATTER  ori → k → kk → kkk
═══════════════════════════════════════════════════════ */
export function fmtG(n: number | null | undefined, short = true): string {
  if (n === null || n === undefined || isNaN(n)) return "—"
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (!short) return sign + Math.round(n).toLocaleString("it-IT") + " ori"
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "kkk"
  if (abs >= 100_000_000)   return sign + Math.round(abs / 1_000_000) + "kk"
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "kk"
  if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(1).replace(/\.?0+$/, "") + "k"
  return sign + Math.round(abs) + " ori"
}

// Parse "150k" "1.5kk" "2kkk" "1.5m" "2b" "150000" → number
export function parseG(str: string | null | undefined): number {
  if (!str) return NaN
  const s = String(str).trim().toLowerCase().replace(/,/g, ".")
  let val: number
  if (s.endsWith("kkk"))      val = parseFloat(s) * 1_000_000_000
  else if (s.endsWith("b"))   val = parseFloat(s) * 1_000_000_000
  else if (s.endsWith("kk"))  val = parseFloat(s) * 1_000_000
  else if (s.endsWith("m"))   val = parseFloat(s) * 1_000_000
  else if (s.endsWith("k"))   val = parseFloat(s) * 1_000
  else                         val = parseFloat(s)
  if (isNaN(val) || val < 0) return NaN
  return val
}

/* ═══════════════════════════════════════════════════════
   DATE HELPERS
═══════════════════════════════════════════════════════ */
export const fmtDate = (d: Date): string => d.toLocaleDateString("it-IT")
export const fmtTime = (d: Date): string => d.toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" })
export const fmtFull = (iso: string): string => { const d = new Date(iso); return `${fmtDate(d)} ${fmtTime(d)}` }
export const todayStr = (): string => fmtDate(new Date())

/* ═══════════════════════════════════════════════════════
   DURATION HELPERS
═══════════════════════════════════════════════════════ */
export interface Duration {
  d: number
  h: number
  m: number
}

export function breakDuration(ms: number): Duration {
  const safe = Math.max(0, ms)
  return {
    d: Math.floor(safe / 86400000),
    h: Math.floor((safe % 86400000) / 3600000),
    m: Math.floor((safe % 3600000) / 60000)
  }
}

export function fmtDurationMs(ms: number): string {
  const { d, h, m } = breakDuration(ms)
  if (d >= 1) return `${d}g ${h}h`
  if (h >= 1) return `${h}h ${m}min`
  return `${m}min`
}

export function fmtSellTime(listedAt: string, soldAt: string): string {
  return fmtDurationMs(new Date(soldAt).getTime() - new Date(listedAt).getTime())
}

/* Formato dd:hh:mm per età/durata */
export function fmtAge(ms: number): string {
  const { d, h, m } = breakDuration(ms)
  return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}
