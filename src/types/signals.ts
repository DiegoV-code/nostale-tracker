export type SignalType =
  | "nodata"
  | "esaurito"
  | "strong_buy"
  | "buy"
  | "buy_target"
  | "hold"
  | "high"
  | "overpriced"
  | "sell"
  | "sell_target"

export interface Signal {
  type: SignalType
  label: string
  hint: string
  color: string
  bg: string
  icon: string
  diffPct?: number | null
  openQty?: number
  vol?: Volatility | null
}

export interface TrendResult {
  pct: number
  days: number
  points: number
  up: boolean
  r2: number
}

export interface Volatility {
  cv: number
  std: number
}
