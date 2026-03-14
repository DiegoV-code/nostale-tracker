/* ═══════════════════════════════════════════════════════
   Core data types for Nostale Tracker
═══════════════════════════════════════════════════════ */

export interface PriceEntry {
  price: number | null
  timestamp: string
  eventId: string
  note?: string
  esaurito?: boolean
}

export interface Lot {
  id: string
  qty: number
  price: number
  timestamp: string
  eventId?: string
  note?: string
  sold: boolean
}

export interface LotLink {
  lotId: string
  lotIdx: number
  qty: number
  unitPrice: number
}

export interface Listing {
  qty: number
  listPrice: number
  buyPrice: number | null
  coveredQty: number
  totalCost: number
  lotLinks: LotLink[] | null
  listedAt: string
  tax: number
  sold: boolean
  soldAt: string | null
  lotsConsumed: boolean
}

export interface RecipeIngredient {
  itemName: string
  qty: number
  fixedPrice?: number   // prezzo NPC fisso — se assente, usa ultimo prezzo tracciato
}

export interface Recipe {
  ingredients: RecipeIngredient[]
  craftQty: number      // quanti item produce la ricetta
}

export interface ItemMeta {
  category?: string
  buyTarget?: number | null
  sellTarget?: number | null
  ndCost?: number
  ndQty?: number
  ndDiscount?: number
  recipe?: Recipe
}

export interface Item {
  meta: ItemMeta
  prices: PriceEntry[]
  lots: Lot[]
  listings: Listing[]
}

export interface SignalConfig {
  strongBuy: number
  buy: number
  high: number
  overpriced: number
  sell: number
}

export interface EventDef {
  id: string
  label: string
  color: string
  icon: string
}

export interface QuickRecentEntry {
  name: string
  price: number
  ts: string
}

export type LotStrategy = "fifo" | "lifo" | "best_price"

export interface AppData {
  items: Record<string, Item>
  events: Record<string, string>
  signalConfig: SignalConfig
  ndRate: number
  globalNdDisc: number
  qRecent: QuickRecentEntry[]
  trendDays: number
  lotStrategy: LotStrategy
  customCategories: string[]
  customEvents: EventDef[]
  customNdDiscounts: number[]
  theme?: string
}
