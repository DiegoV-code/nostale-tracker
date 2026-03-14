import { SIGNAL_DEFAULTS } from "./constants"
import type { Lot, LotLink, PriceEntry, Item, SignalConfig, LotStrategy } from "../types"
import type { Signal, TrendResult, Volatility } from "../types"
import type { Palette } from "../types"

/* ═══════════════════════════════════════════════════════
   LOT MATCHING — FIFO/LIFO/best-price match dei lotti
═══════════════════════════════════════════════════════ */
interface IndexedLot extends Lot {
  _origIdx: number
}

export interface LotMatchResult {
  links: LotLink[]
  coveredQty: number
  uncoveredQty: number
  totalCost: number
  avgBuyPrice: number | null
}

export function matchLotsForQty(lots: Lot[], qty: number, strategy: LotStrategy = "fifo"): LotMatchResult {
  const indexed: IndexedLot[] = lots.map((l, i) => ({ ...l, _origIdx: i }))
  let ordered: IndexedLot[]
  if (strategy === "lifo")            ordered = [...indexed].reverse()
  else if (strategy === "best_price") ordered = [...indexed].filter(l => !l.sold && l.qty > 0).sort((a, b) => a.price - b.price)
  else                                ordered = indexed
  const links: LotLink[] = []
  let remaining = qty
  for (const l of ordered) {
    if (remaining <= 0) break
    if (l.sold || l.qty <= 0) continue
    const take = Math.min(l.qty, remaining)
    links.push({ lotId: l.id, lotIdx: l._origIdx, qty: take, unitPrice: l.price })
    remaining -= take
  }
  const coveredQty = qty - remaining
  const totalCost = links.reduce((a, lk) => a + lk.qty * lk.unitPrice, 0)
  const avgBuyPrice = coveredQty > 0 ? Math.round(totalCost / coveredQty) : null
  return { links, coveredQty, uncoveredQty: remaining, totalCost, avgBuyPrice }
}

/* ═══════════════════════════════════════════════════════
   TREND — regressione lineare sugli ultimi N giorni
═══════════════════════════════════════════════════════ */
export function calcTrend(prices: PriceEntry[], days = 7): TrendResult | null {
  const cutoff = Date.now() - days * 86400000
  const recent = prices.filter(p => !p.esaurito && new Date(p.timestamp).getTime() >= cutoff)
  if (recent.length < 2) return null
  const n   = recent.length
  const ys  = recent.map(p => p.price as number)
  const t0  = new Date(recent[0].timestamp).getTime()
  const xs  = recent.map(p => (new Date(p.timestamp).getTime() - t0) / 86400000)
  const avgX = xs.reduce((a,b) => a+b, 0) / n
  const avgY = ys.reduce((a,b) => a+b, 0) / n
  const num  = xs.reduce((a,x,i) => a + (x - avgX) * (ys[i] - avgY), 0)
  const den  = xs.reduce((a,x) => a + (x - avgX) ** 2, 0)
  const slope = den ? num / den : 0
  const span = xs[xs.length - 1] || 1
  const totalChg = avgY ? ((slope * span) / avgY) * 100 : 0
  const ssRes = xs.reduce((a, x, i) => a + (ys[i] - (avgY + slope * (x - avgX))) ** 2, 0)
  const ssTot = ys.reduce((a, y) => a + (y - avgY) ** 2, 0)
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0
  return { pct: totalChg, days, points: n, up: totalChg > 0, r2 }
}

/* ═══════════════════════════════════════════════════════
   VOLATILITÀ — coefficiente di variazione (CV%)
═══════════════════════════════════════════════════════ */
export function calcVolatility(prices: PriceEntry[]): Volatility | null {
  const real = prices.filter(p => !p.esaurito)
  if (real.length < 3) return null
  const vals = real.map(p => p.price as number)
  const avg  = vals.reduce((a,b) => a+b, 0) / vals.length
  const std  = Math.sqrt(vals.reduce((a,v) => a + (v - avg) ** 2, 0) / (vals.length - 1))
  return { cv: (std / avg) * 100, std: Math.round(std) }
}

/* ═══════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════ */
export function calcOpenQty(it: Item | null | undefined): number {
  return (it?.lots || []).filter(l => !l.sold).reduce((a, l) => a + l.qty, 0)
}

export function calcListingProfit(l: { listPrice: number; buyPrice: number | null; coveredQty?: number; qty: number; tax?: number }): number | null {
  if (l.buyPrice == null) return null
  const qty = l.coveredQty || l.qty
  return (l.listPrice - l.buyPrice) * qty - (l.tax || 0)
}

/* ═══════════════════════════════════════════════════════
   SIGNAL ENGINE
   Confronta prezzo attuale vs media storica normale
   e restituisce un segnale di trading.
   C (palette) viene passato come parametro perché
   dipende dal tema attivo a runtime.
═══════════════════════════════════════════════════════ */
export function getSignal(it: Item | null | undefined, cfg: SignalConfig | null | undefined, C: Palette): Signal {
  const c = cfg || SIGNAL_DEFAULTS
  const thStrongBuy = (c.strongBuy ?? 15) / 100
  const thBuy       = (c.buy       ?? 6)  / 100
  const thHigh      = (c.high      ?? 6)  / 100
  const thOverprice = (c.overpriced ?? 15) / 100
  const thSell      = (c.sell      ?? 12) / 100

  const prices     = it?.prices || []
  const realPrices = prices.filter(p => !p.esaurito)
  if (realPrices.length < 3) return { type:"nodata", label:"Pochi dati", hint:"Registra almeno 3 prezzi per ricevere segnali di trading", color:"#5a6a8a", bg:C.inputBg, icon:"·" }

  const lastEntry = prices[prices.length - 1]
  if (lastEntry?.esaurito) return { type:"esaurito", label:"ESAURITO AL BZ", hint:"Non ci sono item disponibili al bazar. Aspetta che ricompaiano e annota il prezzo.", color:C.purple, bg:`${C.purple}1f`, icon:"📭", diffPct: null }

  const vals       = realPrices.map(p => p.price as number)
  const current    = vals[vals.length - 1]
  const normalP    = realPrices.filter(p => p.eventId === "none").map(p => p.price as number)
  const refVals    = normalP.length >= 3 ? normalP : vals
  const avg        = refVals.reduce((a,b) => a+b, 0) / refVals.length
  const diffPct    = (current - avg) / avg

  const openQty    = calcOpenQty(it)
  const openLots   = (it?.lots || []).filter(l => !l.sold)
  const avgBuy     = openQty ? openLots.reduce((a,l)=>a+l.qty*l.price,0)/openQty : null
  const vol        = calcVolatility(prices)
  const buyTarget  = it?.meta?.buyTarget  ? Number(it.meta.buyTarget)  : null
  const sellTarget = it?.meta?.sellTarget ? Number(it.meta.sellTarget) : null

  if (buyTarget  && current <= buyTarget)                 return { type:"buy_target",  label:"COMPRA ★",    hint:"Hai raggiunto il tuo obiettivo di acquisto — è il momento giusto per comprare.",                  color:"#10b981", bg:"rgba(16,185,129,.18)", icon:"🟢", diffPct }
  if (sellTarget && openQty > 0 && current >= sellTarget) return { type:"sell_target", label:"VENDI ★",     hint:"Hai raggiunto il tuo obiettivo di vendita — metti in vendita al bazar ora.",                      color:"#3b82f6", bg:"rgba(59,130,246,.18)", icon:"🔵", diffPct }

  const volNote = vol && vol.cv >= 25 ? " ⚠ Prezzo molto instabile — rischio elevato." : ""
  const stockNote = openQty > 0 ? ` Hai già ×${openQty} in magazzino.` : ""
  if (diffPct <= -thStrongBuy) return { type:"strong_buy",  label:"FORTE COMPRA", hint:`Il prezzo è molto più basso del solito (−${c.strongBuy ?? 15}%+). Ottimo momento per fare scorta.${stockNote}${volNote}`,                color:"#10b981", bg:"rgba(16,185,129,.18)", icon:"🟢", diffPct, openQty, vol }
  if (diffPct <= -thBuy)       return { type:"buy",         label:"COMPRA",       hint:`Il prezzo è sotto la media storica. Buon momento per acquistare.${stockNote}${volNote}`,                               color:"#34d399", bg:"rgba(52,211,153,.15)", icon:"🟢", diffPct, openQty, vol }
  if (diffPct >=  thOverprice) return { type:"overpriced",  label:"TROPPO CARO",  hint:`Il prezzo è molto sopra la media (+${c.overpriced ?? 15}%+). Sconsigliato acquistare — aspetta che scenda.${volNote}`,        color:"#ef4444", bg:"rgba(239,68,68,.15)",  icon:"🔴", diffPct, openQty, vol }
  if (diffPct >=  thHigh)      return { type:"high",        label:"SOPRA MEDIA",  hint:`Il prezzo è un po' alto rispetto alla media. Meglio aspettare o vendere se hai stock.${volNote}`,          color:"#f97316", bg:"rgba(249,115,22,.15)", icon:"🟠", diffPct, openQty, vol }
  if (avgBuy && current >= avgBuy * (1 + thSell) && openQty > 0)
                         return { type:"sell",        label:"VENDI",        hint:`Il prezzo attuale è più alto di quanto hai pagato (+${c.sell ?? 12}%). Valuta di mettere in vendita.`,        color:"#3b82f6", bg:"rgba(59,130,246,.15)", icon:"🔵", diffPct, openQty, vol }
  return               { type:"hold",          label:"NELLA NORMA",  hint:"Il prezzo è nella media storica. Nessuna azione urgente — monitora e aspetta un'opportunità.",   color:C.amber, bg:`${C.amber}22`, icon:"🟡", diffPct, openQty, vol }
}
