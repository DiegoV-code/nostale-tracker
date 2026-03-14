import type { EventDef, SignalConfig, AppData, LotStrategy } from "../types"

/* ═══════════════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════════════ */
export const EVENTS: EventDef[] = [
  { id:"none",        label:"Nessun evento",          color:"#3d4a5c", icon:"·"   },
  { id:"happy_hour",  label:"Happy Hour NosDollari",   color:"#f59e0b", icon:"💰"  },
  { id:"double_gold", label:"Doppio Oro Drop",         color:"#fbbf24", icon:"🪙"  },
  { id:"double_drop", label:"Doppio Drop Item",        color:"#10b981", icon:"📦"  },
  { id:"double_exp",  label:"EXP Doppia",              color:"#3b82f6", icon:"⭐"  },
  { id:"double_fata", label:"EXP Fata Doppia",         color:"#a78bfa", icon:"🧚"  },
  { id:"upgrade",     label:"Perfezionamento",         color:"#ec4899", icon:"⚗️" },
  { id:"rune",        label:"Evento Rune",             color:"#f97316", icon:"🔮"  },
  { id:"nosmall",     label:"Sconto NosMall",          color:"#06b6d4", icon:"🛍️" },
  { id:"nosfire",     label:"Server NosFire",          color:"#ef4444", icon:"🔥"  },
  { id:"weekend",     label:"Bonus Weekend",           color:"#84cc16", icon:"📅"  },
  { id:"seasonal",    label:"Evento Stagionale",       color:"#f472b6", icon:"🌸"  },
  { id:"custom",      label:"Altro",                   color:"#94a3b8", icon:"📝"  },
]
export const EVT: Record<string, EventDef> = Object.fromEntries(EVENTS.map(e => [e.id, e]))

/* ═══════════════════════════════════════════════════════
   SIGNAL CONFIG
═══════════════════════════════════════════════════════ */
export const SIGNAL_DEFAULTS: SignalConfig = { strongBuy: 15, buy: 6, high: 6, overpriced: 15, sell: 12 }

export interface SignalGroup {
  id: string
  label: string
  color: string
  types: string[] | null
}

export const SIGNAL_GROUPS: SignalGroup[] = [
  { id:"__all__",   label:"TUTTI",      color:"#8895b3", types:null },
  { id:"buy",       label:"🟢 COMPRA",  color:"#10b981", types:["strong_buy","buy","buy_target"] },
  { id:"hold",      label:"🟡 NORMA",   color:"#f59e0b", types:["hold"] },
  { id:"high",      label:"🟠 SOPRA",   color:"#f97316", types:["high"] },
  { id:"overpriced",label:"🔴 CARO",    color:"#ef4444", types:["overpriced"] },
  { id:"sell",      label:"🔵 VENDI",   color:"#3b82f6", types:["sell","sell_target"] },
  { id:"esaurito",  label:"📭 ESAURITO", color:"#a78bfa", types:["esaurito"] },
  { id:"nodata",    label:"· POCHI DATI", color:"#5a6a8a", types:["nodata"] },
]

/* ═══════════════════════════════════════════════════════
   CATEGORIES & OPTIONS
═══════════════════════════════════════════════════════ */
export const CATEGORIES: string[] = ["—", "Accessori", "Armi", "Armature", "Consumabili", "Materiali", "Rune", "Pet", "Costume", "Item Shop ND", "Altro"]
export const ND_DISCOUNTS: number[] = [0, 10, 15, 20, 25, 30, 40, 50]

export interface LotStrategyDef {
  id: LotStrategy
  label: string
}

export const LOT_STRATEGIES: LotStrategyDef[] = [
  { id: "fifo",       label: "FIFO (primo acquistato)" },
  { id: "lifo",       label: "LIFO (ultimo acquistato)" },
  { id: "best_price", label: "Prezzo migliore" },
]

/* ═══════════════════════════════════════════════════════
   DATA SHAPE — default empty structure
═══════════════════════════════════════════════════════ */
export const mkInit = (): AppData => ({
  items: {}, events: {}, signalConfig: { ...SIGNAL_DEFAULTS },
  ndRate: 0, globalNdDisc: 0, qRecent: [],
  trendDays: 7, lotStrategy: "fifo",
  customCategories: [], customEvents: [], customNdDiscounts: [],
})
