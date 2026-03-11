import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend
} from "recharts"

/* ═══════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════ */
const EVENTS = [
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
const EVT = Object.fromEntries(EVENTS.map(e => [e.id, e]))

/* ═══════════════════════════════════════════════════════
   GOLD FORMATTER  ori → k → kk → kkk
═══════════════════════════════════════════════════════ */
function fmtG(n, short = true) {
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
function parseG(str) {
  if (!str) return NaN
  const s = String(str).trim().toLowerCase().replace(/,/g, ".")
  let val
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
const fmtDate = d  => d.toLocaleDateString("it-IT")
const fmtTime = d  => d.toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" })
const fmtFull = iso => { const d = new Date(iso); return `${fmtDate(d)} ${fmtTime(d)}` }
const todayStr = () => fmtDate(new Date())

/* ═══════════════════════════════════════════════════════
   LOT MATCHING — FIFO/LIFO/best-price match dei lotti
═══════════════════════════════════════════════════════ */
function matchLotsForQty(lots, qty, strategy = "fifo") {
  const indexed = lots.map((l, i) => ({ ...l, _origIdx: i }))
  let ordered
  if (strategy === "lifo")            ordered = [...indexed].reverse()
  else if (strategy === "best_price") ordered = [...indexed].filter(l => !l.sold && l.qty > 0).sort((a, b) => a.price - b.price)
  else                                ordered = indexed
  const links = []
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
function calcTrend(prices, days = 7) {
  const cutoff = Date.now() - days * 86400000
  const recent = prices.filter(p => !p.esaurito && new Date(p.timestamp).getTime() >= cutoff)
  if (recent.length < 2) return null
  const n   = recent.length
  const ys  = recent.map(p => p.price)
  // Use actual timestamps (in days from first entry) instead of indices
  const t0  = new Date(recent[0].timestamp).getTime()
  const xs  = recent.map(p => (new Date(p.timestamp).getTime() - t0) / 86400000)
  const avgX = xs.reduce((a,b) => a+b, 0) / n
  const avgY = ys.reduce((a,b) => a+b, 0) / n
  const num  = xs.reduce((a,x,i) => a + (x - avgX) * (ys[i] - avgY), 0)
  const den  = xs.reduce((a,x) => a + (x - avgX) ** 2, 0)
  const slope = den ? num / den : 0
  // % change over the actual time span
  const span = xs[xs.length - 1] || 1
  const totalChg = avgY ? ((slope * span) / avgY) * 100 : 0
  // R² coefficient of determination
  const ssRes = xs.reduce((a, x, i) => a + (ys[i] - (avgY + slope * (x - avgX))) ** 2, 0)
  const ssTot = ys.reduce((a, y) => a + (y - avgY) ** 2, 0)
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0
  return { pct: totalChg, days, points: n, up: totalChg > 0, r2 }
}

/* ═══════════════════════════════════════════════════════
   VOLATILITÀ — coefficiente di variazione (CV%)
═══════════════════════════════════════════════════════ */
function calcVolatility(prices) {
  const real = prices.filter(p => !p.esaurito)
  if (real.length < 3) return null
  const vals = real.map(p => p.price)
  const avg  = vals.reduce((a,b) => a+b, 0) / vals.length
  const std  = Math.sqrt(vals.reduce((a,v) => a + (v - avg) ** 2, 0) / (vals.length - 1))
  return { cv: (std / avg) * 100, std: Math.round(std) }
}

function breakDuration(ms) {
  const safe = Math.max(0, ms)
  return {
    d: Math.floor(safe / 86400000),
    h: Math.floor((safe % 86400000) / 3600000),
    m: Math.floor((safe % 3600000) / 60000)
  }
}

function fmtDurationMs(ms) {
  const { d, h, m } = breakDuration(ms)
  if (d >= 1) return `${d}g ${h}h`
  if (h >= 1) return `${h}h ${m}min`
  return `${m}min`
}

function fmtSellTime(listedAt, soldAt) {
  return fmtDurationMs(new Date(soldAt) - new Date(listedAt))
}

/* Formato dd:hh:mm per età/durata */
function fmtAge(ms) {
  const { d, h, m } = breakDuration(ms)
  return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

/* ═══════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════ */
function calcOpenQty(it) {
  return (it?.lots || []).filter(l => !l.sold).reduce((a, l) => a + l.qty, 0)
}

function calcListingProfit(l) {
  if (l.buyPrice == null) return null
  const qty = l.coveredQty || l.qty
  return (l.listPrice - l.buyPrice) * qty - (l.tax || 0)
}

/* ═══════════════════════════════════════════════════════
   SIGNAL ENGINE
   Confronta prezzo attuale vs media storica normale
   e restituisce un segnale di trading
═══════════════════════════════════════════════════════ */
const SIGNAL_DEFAULTS = { strongBuy: 15, buy: 6, high: 6, overpriced: 15, sell: 12 }

function getSignal(it, cfg) {
  const c = cfg || SIGNAL_DEFAULTS
  const thStrongBuy = (c.strongBuy ?? 15) / 100
  const thBuy       = (c.buy       ?? 6)  / 100
  const thHigh      = (c.high      ?? 6)  / 100
  const thOverprice = (c.overpriced ?? 15) / 100
  const thSell      = (c.sell      ?? 12) / 100

  const prices     = it?.prices || []
  const realPrices = prices.filter(p => !p.esaurito)
  if (realPrices.length < 3) return { type:"nodata", label:"Pochi dati", hint:"Registra almeno 3 prezzi per ricevere segnali di trading", color:"#5a6a8a", bg:C.inputBg, icon:"·" }

  // Se l'ultima entry è "esaurito", segnala subito
  const lastEntry = prices[prices.length - 1]
  if (lastEntry?.esaurito) return { type:"esaurito", label:"ESAURITO AL BZ", hint:"Non ci sono item disponibili al bazar. Aspetta che ricompaiano e annota il prezzo.", color:"#a78bfa", bg:"rgba(167,139,250,.12)", icon:"📭", diffPct: null }

  const vals       = realPrices.map(p => p.price)
  const current    = vals[vals.length - 1]
  const normalP    = realPrices.filter(p => p.eventId === "none").map(p => p.price)
  const refVals    = normalP.length >= 3 ? normalP : vals
  const avg        = refVals.reduce((a,b) => a+b, 0) / refVals.length
  const diffPct    = (current - avg) / avg

  const openQty    = calcOpenQty(it)
  const openLots   = (it?.lots || []).filter(l => !l.sold)
  const avgBuy     = openQty ? openLots.reduce((a,l)=>a+l.qty*l.price,0)/openQty : null
  const vol        = calcVolatility(prices)
  const buyTarget  = it?.meta?.buyTarget  ? parseFloat(it.meta.buyTarget)  : null
  const sellTarget = it?.meta?.sellTarget ? parseFloat(it.meta.sellTarget) : null

  // Target personalizzati (priorità massima)
  if (buyTarget  && current <= buyTarget)                 return { type:"buy_target",  label:"COMPRA ★",    hint:"Hai raggiunto il tuo obiettivo di acquisto — è il momento giusto per comprare.",                  color:"#10b981", bg:"rgba(16,185,129,.12)", icon:"🟢", diffPct }
  if (sellTarget && openQty > 0 && current >= sellTarget) return { type:"sell_target", label:"VENDI ★",     hint:"Hai raggiunto il tuo obiettivo di vendita — metti in vendita al bazar ora.",                      color:"#3b82f6", bg:"rgba(59,130,246,.12)", icon:"🔵", diffPct }

  // Segnali automatici (soglie configurabili)
  const volNote = vol && vol.cv >= 25 ? " ⚠ Prezzo molto instabile — rischio elevato." : ""
  const stockNote = openQty > 0 ? ` Hai già ×${openQty} in magazzino.` : ""
  if (diffPct <= -thStrongBuy) return { type:"strong_buy",  label:"FORTE COMPRA", hint:`Il prezzo è molto più basso del solito (−${c.strongBuy ?? 15}%+). Ottimo momento per fare scorta.${stockNote}${volNote}`,                color:"#10b981", bg:"rgba(16,185,129,.12)", icon:"🟢", diffPct, openQty, vol }
  if (diffPct <= -thBuy)       return { type:"buy",         label:"COMPRA",       hint:`Il prezzo è sotto la media storica. Buon momento per acquistare.${stockNote}${volNote}`,                               color:"#34d399", bg:"rgba(52,211,153,.08)", icon:"🟢", diffPct, openQty, vol }
  if (diffPct >=  thOverprice) return { type:"overpriced",  label:"TROPPO CARO",  hint:`Il prezzo è molto sopra la media (+${c.overpriced ?? 15}%+). Sconsigliato acquistare — aspetta che scenda.${volNote}`,        color:"#ef4444", bg:"rgba(239,68,68,.10)",  icon:"🔴", diffPct, openQty, vol }
  if (diffPct >=  thHigh)      return { type:"high",        label:"SOPRA MEDIA",  hint:`Il prezzo è un po' alto rispetto alla media. Meglio aspettare o vendere se hai stock.${volNote}`,          color:"#f97316", bg:"rgba(249,115,22,.08)", icon:"🟠", diffPct, openQty, vol }
  if (avgBuy && current >= avgBuy * (1 + thSell) && openQty > 0)
                         return { type:"sell",        label:"VENDI",        hint:`Il prezzo attuale è più alto di quanto hai pagato (+${c.sell ?? 12}%). Valuta di mettere in vendita.`,        color:"#3b82f6", bg:"rgba(59,130,246,.10)", icon:"🔵", diffPct, openQty, vol }
  return               { type:"hold",          label:"NELLA NORMA",  hint:"Il prezzo è nella media storica. Nessuna azione urgente — monitora e aspetta un'opportunità.",   color:"#f59e0b", bg:"rgba(245,158,11,.08)", icon:"🟡", diffPct, openQty, vol }
}

/* ═══════════════════════════════════════════════════════
   DATA SHAPE
   items[name] = {
     meta: { category, buyTarget, sellTarget, ndCost, ndQty, ndDiscount },
     prices:   [{ price, timestamp, eventId, note }],
     lots:     [{ id, qty, price, timestamp, eventId, note, sold }],
     listings: [{ qty, listPrice, buyPrice, coveredQty, totalCost, lotLinks, listedAt, tax, sold, soldAt, lotsConsumed }]
   }
   events[date] = eventId
   ndRate = number (gold per 1 ND)
   signalConfig = { windowDays, dropPct, surgePct }
═══════════════════════════════════════════════════════ */
const CATEGORIES = ["—", "Accessori", "Armi", "Armature", "Consumabili", "Materiali", "Rune", "Pet", "Costume", "Item Shop ND", "Altro"]
const ND_DISCOUNTS = [0, 10, 15, 20, 25, 30, 40, 50]
const LOT_STRATEGIES = [
  { id: "fifo",       label: "FIFO (primo acquistato)" },
  { id: "lifo",       label: "LIFO (ultimo acquistato)" },
  { id: "best_price", label: "Prezzo migliore" },
]

const SIGNAL_GROUPS = [
  { id:"__all__",   label:"TUTTI",      color:"#8895b3", types:null },
  { id:"buy",       label:"🟢 COMPRA",  color:"#10b981", types:["strong_buy","buy","buy_target"] },
  { id:"hold",      label:"🟡 NORMA",   color:"#f59e0b", types:["hold"] },
  { id:"high",      label:"🟠 SOPRA",   color:"#f97316", types:["high"] },
  { id:"overpriced",label:"🔴 CARO",    color:"#ef4444", types:["overpriced"] },
  { id:"sell",      label:"🔵 VENDI",   color:"#3b82f6", types:["sell","sell_target"] },
  { id:"esaurito",  label:"📭 ESAURITO", color:"#a78bfa", types:["esaurito"] },
  { id:"nodata",    label:"· POCHI DATI", color:"#5a6a8a", types:["nodata"] },
]

const mkInit = () => ({
  items: {}, events: {}, signalConfig: { ...SIGNAL_DEFAULTS },
  ndRate: 0, globalNdDisc: 0, qRecent: [],
  trendDays: 7, lotStrategy: "fifo",
  customCategories: [], customEvents: [], customNdDiscounts: [],
})

function migrateData(d) {
  const defaults = mkInit()
  for (const key of Object.keys(defaults)) {
    if (d[key] === undefined) d[key] = defaults[key]
  }
  if (d.signalConfig) {
    for (const key of Object.keys(SIGNAL_DEFAULTS)) {
      if (d.signalConfig[key] === undefined) d.signalConfig[key] = SIGNAL_DEFAULTS[key]
    }
  }
  for (const it of Object.values(d.items || {})) {
    if (!it.meta) it.meta = {}
    if (!it.prices) it.prices = []
    if (!it.lots) it.lots = []
    if (!it.listings) it.listings = []
    for (const lot of it.lots) {
      if (!lot.id) lot.id = lot.timestamp + '_' + Math.random().toString(36).slice(2,6)
    }
  }
  return d
}

/* ═══════════════════════════════════════════════════════
   STAT BAR — reusable KPI card row
═══════════════════════════════════════════════════════ */
const StatBar = ({ items, gap = 8, mb = 18 }) => (
  <div style={{ display:"flex", gap, marginBottom:mb, flexWrap:"wrap" }}>
    {items.map(s => (
      <div key={s.l} title={s.title || ""} style={{ flex:s.flex || "1 1 100px", background:s.bg2 || C.panel, border:`1px solid ${s.border || C.border}`, borderRadius:s.radius || 10, padding:s.pad || "10px 13px", cursor:s.title?"help":"default" }}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>{s.l}</div>
        <div style={{ fontSize:s.big?22:17, color:s.c, fontWeight:700, fontFamily:"monospace", marginTop:3 }}>{s.v}</div>
        {s.sub && <div style={{ fontSize:11, color:C.muted2, marginTop:2 }}>{s.sub}</div>}
      </div>
    ))}
  </div>
)

/* ═══════════════════════════════════════════════════════
   PALETTE & STYLE HELPERS
═══════════════════════════════════════════════════════ */
const DARK = {
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
  inputBg: "#0f1119",
  pillTxt: "#0f1119",
  flat:    "#4b5563",
}
const LIGHT = {
  bg:      "#e4e7ed",
  panel:   "#f5f6f8",
  border:  "#b0b8c8",
  border2: "#8e99ad",
  text:    "#111827",
  muted:   "#3d4a5c",
  muted2:  "#4b5568",
  gold:    "#a06510",
  green:   "#15803d",
  red:     "#b91c1c",
  blue:    "#1d4ed8",
  inputBg: "#dce1ea",
  pillTxt: "#ffffff",
  flat:    "#6b7280",
}
let C = DARK

const inp = (extra={}) => ({
  background: C.inputBg, border: `1px solid ${C.border2}`,
  borderRadius: 8, color: C.text, padding: "10px 13px",
  fontSize: 15, fontFamily: "monospace", outline: "none",
  width: "100%", transition: "border-color .15s",
  ...extra
})

const pill = (active, col=C.gold, extra={}) => ({
  background: active ? col : "transparent",
  border: `1px solid ${active ? col : C.border2}`,
  color: active ? C.pillTxt : col,
  borderRadius: 8, padding: "9px 16px", cursor: "pointer",
  fontSize: 14, fontWeight: 700, letterSpacing: 1,
  transition: "all .15s", ...extra
})

/* ═══════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════ */
export default function App() {
  const [data,       setData]      = useState(null)
  const [saveStatus, setSaveStatus]= useState("idle")
  const [dataPath,   setDataPath]  = useState("")
  const [appVersion, setAppVersion]= useState("")
  const [updateStatus, setUpdateStatus] = useState(null) // null | "available" | "downloading" | "downloaded" | "error"
  const [downloadPct, setDownloadPct] = useState(0)
  const [updateError, setUpdateError] = useState("")

  // theme
  const [theme, setTheme] = useState(() => localStorage.getItem("nostale-theme") || "dark")
  C = theme === "light" ? LIGHT : DARK

  // navigation
  const [page,    setPage]    = useState("dashboard")   // dashboard | item | new | analisi | bazar | magazzino | nd
  const [selItem, setSelItem] = useState(null)
  const [subPage, setSubPage] = useState("prices")      // prices | magazzino | vendite | charts

  // settings
  const [showSettings, setShowSettings] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState("salvataggio")
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [newNdDiscInput, setNewNdDiscInput] = useState("")

  // sidebar search
  const [search, setSearch] = useState("")

  // price form
  const [pVal,  setPVal]  = useState("")
  const [pNote, setPNote] = useState("")

  // lot form (magazzino)
  const [lQty,   setLQty]   = useState("")
  const [lPrice, setLPrice] = useState("")

  // listing form (in vendita)
  const [lsQty,      setLsQty]      = useState("")
  const [lsPrice,    setLsPrice]    = useState("")
  const [lsTax,      setLsTax]      = useState("")
  const [partialIdx, setPartialIdx] = useState(null)
  const [partialQty, setPartialQty] = useState("")
  const [bazarPartialKey, setBazarPartialKey] = useState(null)   // "itemName|listingIdx"
  const [bazarPartialQty, setBazarPartialQty] = useState("")

  // new item form
  const [newName, setNewName] = useState("")
  const [newCat,  setNewCat]  = useState("—")

  // sidebar controls
  const [sideSort,     setSideSort]     = useState("name")   // name | price | signal
  const [sideCategory, setSideCategory] = useState("__all__")

  // chart day
  const [chartDay, setChartDay] = useState(todayStr())

  // rename
  const [renaming,   setRenaming]   = useState(false)
  const [renameVal,  setRenameVal]  = useState("")
  const [copyFlash,  setCopyFlash]  = useState(false)

  // target prices
  const [showTargetEdit, setShowTargetEdit] = useState(false)
  const [tBuy,  setTBuy]  = useState("")
  const [tSell, setTSell] = useState("")

  // analisi page
  const [sortCol, setSortCol] = useState("signal")
  const [sortDir, setSortDir] = useState(1)          // 1 asc, -1 desc
  const [analSearch, setAnalSearch] = useState("")
  const [analSignalFilter, setAnalSignalFilter] = useState("__all__")  // "__all__" or signal type group
  const [analNameW, setAnalNameW] = useState(160)    // resizable ITEM column width
  const analResizing = useRef(false)
  const [sidebarW, setSidebarW] = useState(230)      // resizable sidebar width
  const sideResizing = useRef(false)

  // nos dollari page
  const [ndBuyQty,    setNdBuyQty]    = useState("")
  const [globalNdDisc,  setGlobalNdDisc]  = useState(0)  // global ND discount % (0 = no event)
  const [ndRateInput, setNdRateInput] = useState("")

  // quick-add modal
  const [showQuick,   setShowQuick]   = useState(false)
  const [qItem,       setQItem_]      = useState("")
  const qItemRef = useRef("")
  const setQItem = v => { const val = typeof v === "function" ? v(qItemRef.current) : v; qItemRef.current = val; setQItem_(val) }
  const [qPrice,      setQPrice]      = useState("")
  const [qRecent,     setQRecent]     = useState([])   // { name, price, ts }
  const qPriceRef = useRef(null)
  const copyTimer = useRef(null)

  const saveTimer = useRef(null)

  /* ── ITEM NAMES (must be before useEffect that references it) ── */
  const itemNames = useMemo(() => Object.keys(data?.items || {}), [data])

  /* ── KEYBOARD SHORTCUTS ── */
  const openQuickRef = useRef(null)
  useEffect(() => {
    const handler = e => {
      if (e.key === "Escape" && showSettings) { setShowSettings(false); return }
      if (e.key === "Escape" && showQuick) { setShowQuick(false); return }
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === "q") { e.preventDefault(); showQuick ? setShowQuick(false) : openQuickRef.current?.() }
      if (ctrl && e.key === "n") { e.preventDefault(); setPage("new") }
      if (ctrl && e.key === "1") { e.preventDefault(); setPage("dashboard") }
      if (ctrl && e.key === "2") { e.preventDefault(); setPage("analisi") }
      if (ctrl && e.key === "3") { e.preventDefault(); setPage("bazar") }
      if (ctrl && e.key === "4") { e.preventDefault(); setPage("magazzino") }
      if (ctrl && e.key === "5") { e.preventDefault(); setPage("nd") }
      if (ctrl && e.key === ",") { e.preventDefault(); setShowSettings(s => !s) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showQuick, showSettings])

  // Sync theme to body + localStorage
  useEffect(() => {
    document.body.style.background = theme === "light" ? LIGHT.bg : DARK.bg
    localStorage.setItem("nostale-theme", theme)
  }, [theme])

  // Persist navigation state to localStorage
  useEffect(() => {
    if (data) localStorage.setItem("nostale-nav", JSON.stringify({ page, selItem, subPage }))
  }, [page, selItem, subPage, data])

  /* ── LOAD ── */
  useEffect(() => {
    ;(async () => {
      try {
        const [loaded, dp] = await Promise.all([window.api.load(), window.api.dataPath()])
        setDataPath(dp)
        // Deep-clone + migrate to ensure all fields exist
        const d = migrateData(JSON.parse(JSON.stringify(loaded || mkInit())))
        setData(d)
        if (d.ndRate) setNdRateInput(String(d.ndRate))
        if (d.globalNdDisc) setGlobalNdDisc(d.globalNdDisc)
        if (d.qRecent?.length) setQRecent(d.qRecent)
        if (d.theme) setTheme(d.theme)
        // Restore navigation state from localStorage
        try {
          const nav = JSON.parse(localStorage.getItem("nostale-nav"))
          if (nav?.selItem && d.items?.[nav.selItem]) {
            setSelItem(nav.selItem); setPage(nav.page || "item"); setSubPage(nav.subPage || "prices")
          } else {
            const names = Object.keys(d.items || {})
            if (names.length) { setSelItem(names[0]); setPage("item") }
          }
        } catch {
          const names = Object.keys(d.items || {})
          if (names.length) { setSelItem(names[0]); setPage("item") }
        }
      } catch (err) {
        console.error("Load failed:", err)
        setData(mkInit())
      }
    })()
    // version + auto-update listeners
    window.api.getVersion?.().then(v => v && setAppVersion(v)).catch(() => {})
    const unsubs = [
      window.api.onUpdateAvailable?.(() => setUpdateStatus("available")),
      window.api.onDownloadProgress?.((info) => { setUpdateStatus("downloading"); setDownloadPct(Math.round(info.percent || 0)) }),
      window.api.onUpdateDownloaded?.(() => setUpdateStatus("downloaded")),
      window.api.onUpdateError?.((msg) => { setUpdateStatus("error"); setUpdateError(msg) }),
    ]
    return () => unsubs.forEach(fn => fn?.())
  }, [])

  /* ── SAVE (debounced) ── */
  const persist = useCallback(nd => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus("saving")
    saveTimer.current = setTimeout(async () => {
      const r = await window.api.save(nd).catch(() => ({ ok: false }))
      setSaveStatus(r.ok ? "ok" : "error")
      setTimeout(() => setSaveStatus("idle"), 2000)
    }, 600)
  }, [])

  // Clear debounce timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Track latest data for flush-on-close
  const dataRef = useRef(null)
  const upd = useCallback(nd => { setData(nd); dataRef.current = nd; persist(nd) }, [persist])

  // Flush pending save on window close
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current && dataRef.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        window.api.save(dataRef.current).catch(() => {})
      }
    }
    window.addEventListener("beforeunload", flush)
    return () => window.removeEventListener("beforeunload", flush)
  }, [])

  // Reset form state when switching items
  useEffect(() => {
    setPVal(""); setPNote("")
    setLQty(""); setLPrice("")
    setLsQty(""); setLsPrice(""); setLsTax("")
    setPartialIdx(null); setPartialQty("")
    setRenaming(false); setRenameVal("")
    setShowTargetEdit(false)
  }, [selItem])

  /* ── MERGED CUSTOMIZABLES ── */
  const allCategories = useMemo(() => {
    const customs = data?.customCategories || []
    return [...CATEGORIES, ...customs.filter(c => !CATEGORIES.includes(c))]
  }, [data?.customCategories])

  const allEvents = useMemo(() => [...EVENTS, ...(data?.customEvents || [])], [data?.customEvents])
  const allEVT = useMemo(() => Object.fromEntries(allEvents.map(e => [e.id, e])), [allEvents])

  const allNdDiscounts = useMemo(() => {
    const customs = data?.customNdDiscounts || []
    return [...new Set([...ND_DISCOUNTS, ...customs])].sort((a, b) => a - b)
  }, [data?.customNdDiscounts])

  const trendDays = data?.trendDays || 7
  const lotStrategy = data?.lotStrategy || "fifo"

  /* ── CURRENT EVENT ── */
  const curEventId = data?.events?.[todayStr()] || "none"
  const curEvt     = allEVT[curEventId] || EVT.none
  const setCurEvt  = id => upd({ ...data, events: { ...data.events, [todayStr()]: id } })

  /* ── ITEM HELPERS ── */
  const item      = selItem ? data?.items?.[selItem] : null
  const prices    = item?.prices   || []
  const lots      = item?.lots     || []
  const listings  = item?.listings || []

  /* ── SIGNAL CACHE ── */
  const signalCache = useMemo(() => {
    const cache = {}
    for (const name of itemNames) {
      cache[name] = getSignal(data?.items?.[name], data?.signalConfig)
    }
    return cache
  }, [data, itemNames])
  const filtered  = useMemo(() => {
    let names = itemNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    if (sideCategory !== "__all__") names = names.filter(n => (data?.items?.[n]?.meta?.category || "—") === sideCategory)
    if (sideSort === "price") {
      names = [...names].sort((a, b) => {
        const pa = (data?.items?.[a]?.prices || []).filter(p => !p.esaurito)
        const pb = (data?.items?.[b]?.prices || []).filter(p => !p.esaurito)
        return (pb.length ? pb[pb.length-1].price : -1) - (pa.length ? pa[pa.length-1].price : -1)
      })
    } else if (sideSort === "signal") {
      const ord = { strong_buy:0, buy:1, buy_target:0, hold:2, esaurito:3, high:4, sell:5, overpriced:6, sell_target:5, nodata:7 }
      names = [...names].sort((a, b) => (ord[signalCache[a]?.type]??7) - (ord[signalCache[b]?.type]??7))
    } else {
      names = [...names].sort((a, b) => a.localeCompare(b))
    }
    return names
  }, [itemNames, search, sideCategory, sideSort, data, signalCache])

  /* ── PRICE ANALYTICS ── */
  const allDays = useMemo(() => {
    if (!prices.length) return []
    const s = new Set(prices.map(p => fmtDate(new Date(p.timestamp))))
    const parseDate = s => { const [d,m,y] = s.split("/"); return new Date(+y,+m-1,+d).getTime() }
    return [...s].sort((a, b) => parseDate(b) - parseDate(a))
  }, [prices])

  // Auto-select most recent day with data when current chartDay has none
  useEffect(() => {
    if (allDays.length && !allDays.includes(chartDay)) setChartDay(allDays[0])
  }, [allDays])

  const dayPrices = useMemo(() =>
    prices.filter(p => !p.esaurito && fmtDate(new Date(p.timestamp)) === chartDay),
    [prices, chartDay])

  const chartPoints = useMemo(() =>
    dayPrices.map(p => ({
      time:    fmtTime(new Date(p.timestamp)),
      price:   p.price,
      eventId: p.eventId,
      note:    p.note,
    })), [dayPrices])

  const allStats = useMemo(() => {
    if (!prices.length) return null
    // Escludi le voci "esaurito" dai calcoli di prezzo
    const realPrices   = prices.filter(p => !p.esaurito)
    if (!realPrices.length) return null
    const vals         = realPrices.map(p => p.price)
    const eventPrices  = realPrices.filter(p => p.eventId !== "none").map(p => p.price)
    const normalPrices = realPrices.filter(p => p.eventId === "none").map(p => p.price)
    const avg          = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null
    // Stato attuale: l'ultima entry in assoluto (incluse esaurito)
    const lastEntry    = prices[prices.length - 1]
    const isEsaurito   = lastEntry?.esaurito === true
    const lastRealPrice = realPrices[realPrices.length - 1]?.price
    const esauritoCount = prices.filter(p => p.esaurito).length
    return {
      current:      isEsaurito ? lastRealPrice : vals[vals.length-1],
      isEsaurito,
      esauritoCount,
      avg:          avg(vals),
      min:          Math.min(...vals),
      max:          Math.max(...vals),
      avgEvent:     avg(eventPrices),
      avgNormal:    avg(normalPrices),
      count:        realPrices.length,
    }
  }, [prices])

  const dayStats = useMemo(() => {
    if (!dayPrices.length) return null
    const vals = dayPrices.map(p => p.price)
    return {
      min: Math.min(...vals), max: Math.max(...vals),
      avg: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),
      delta: vals.length > 1 ? vals[vals.length-1] - vals[0] : 0,
      last: vals[vals.length-1],
    }
  }, [dayPrices])

  const multiDayChart = useMemo(() => {
    if (!selItem || !data || allDays.length < 2) return []
    return [...allDays].reverse().map(d => {
      const entries = prices.filter(p => !p.esaurito && fmtDate(new Date(p.timestamp)) === d)
      if (!entries.length) return null
      const vals = entries.map(e => e.price)
      const evP  = entries.filter(e => e.eventId !== "none").map(e => e.price)
      const norP = entries.filter(e => e.eventId === "none").map(e => e.price)
      const avg  = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : undefined
      return {
        day:       d.slice(0,5),
        media:     avg(vals),
        evento:    avg(evP),
        normale:   avg(norP),
        min:       Math.min(...vals),
        max:       Math.max(...vals),
        hasEvent:  data.events?.[d] && data.events[d] !== "none",
        eventColor: data.events?.[d] ? allEVT[data.events[d]]?.color : undefined,
      }
    }).filter(Boolean)
  }, [prices, allDays, data, selItem])

  /* ── LOT ANALYTICS ── */
  const lotStats = useMemo(() => {
    if (!lots.length) return null
    const open   = lots.filter(l => !l.sold)
    const closed = lots.filter(l => l.sold)
    const totalQty    = open.reduce((a,l) => a + l.qty, 0)
    const totalSpent  = open.reduce((a,l) => a + l.qty * l.price, 0)
    const avgBuy      = totalQty ? Math.round(totalSpent / totalQty) : 0
    const realPrices = prices.filter(p => !p.esaurito)
    const currentPrice = realPrices.length ? realPrices[realPrices.length-1].price : null
    const estimatedValue = currentPrice ? totalQty * currentPrice : null
    const estimatedProfit = estimatedValue !== null ? estimatedValue - totalSpent : null
    return { totalQty, totalSpent, avgBuy, currentPrice, estimatedValue, estimatedProfit, openLots: open, closedLots: closed }
  }, [lots, prices])

  /* ── LISTING ANALYTICS ── */
  const listingStats = useMemo(() => {
    if (!listings.length) return null
    const active = listings.filter(l => !l.sold)
    const sold   = listings.filter(l => l.sold)
    const activeQty   = active.reduce((a,l) => a + l.qty, 0)
    const activeValue = active.reduce((a,l) => a + l.qty * l.listPrice, 0)
    const sellTimesMs = sold.map(l => new Date(l.soldAt) - new Date(l.listedAt))
    const avgMs       = sellTimesMs.length ? sellTimesMs.reduce((a,b)=>a+b,0)/sellTimesMs.length : null
    const totalProfit = sold.reduce((a,l) => a + (calcListingProfit(l) || 0), 0)
    const profitableSales = sold.filter(l => l.buyPrice != null)
    return { active, sold, activeQty, activeValue, avgMs, totalProfit, profitableSales }
  }, [listings])

  /* ── LOT PREVIEW for listing form ── */
  const lotPreview = useMemo(() => {
    if (!lsQty || isNaN(parseInt(lsQty, 10)) || parseInt(lsQty, 10) <= 0) return null
    return matchLotsForQty(lots, parseInt(lsQty, 10), lotStrategy)
  }, [lots, lsQty])

  /* ── CAPITAL OVERVIEW ── */
  const capitalOverview = useMemo(() => {
    if (!data) return null
    let inStock = 0, atMarket = 0, realized = 0, totalItems = 0
    for (const it of Object.values(data.items || {})) {
      const openLots     = (it.lots     || []).filter(l => !l.sold)
      const activeList   = (it.listings || []).filter(l => !l.sold)
      const soldWithBuy  = (it.listings || []).filter(l => l.sold && l.buyPrice != null)
      const lotValue     = openLots.reduce((a,l) => a + l.qty * l.price, 0)
      const listValue    = activeList.reduce((a,l) => a + l.qty * l.listPrice, 0)
      inStock   += lotValue
      atMarket  += listValue
      realized  += soldWithBuy.reduce((a,l) => a + (calcListingProfit(l) || 0), 0)
      if (openLots.length > 0 || activeList.length > 0) totalItems++
    }
    return { inStock, atMarket, realized, totalItems }
  }, [data])

  /* ── BAZAR OVERVIEW — all active listings across items ── */
  const bazarOverview = useMemo(() => {
    if (!data) return { rows: [], totalQty: 0, totalValue: 0, totalTax: 0, totalProfit: 0 }
    const rows = []
    for (const name of Object.keys(data.items || {})) {
      const it = data.items[name]
      const lsList = it.listings || []
      for (let i = 0; i < lsList.length; i++) {
        const l = lsList[i]
        if (l.sold) continue
        const covered = l.coveredQty || 0
        const profit = covered > 0 ? calcListingProfit(l) : null
        const daysActive = (Date.now() - new Date(l.listedAt)) / 86400000
        rows.push({ name, listingIdx: i, listing: l, covered, profit, daysActive })
      }
    }
    const totalQty   = rows.reduce((a,r) => a + r.listing.qty, 0)
    const totalValue = rows.reduce((a,r) => a + r.listing.qty * r.listing.listPrice, 0)
    const totalTax   = rows.reduce((a,r) => a + (r.listing.tax || 0), 0)
    const totalProfit = rows.reduce((a,r) => a + (r.profit || 0), 0)
    const totalCost = rows.reduce((a,r) => a + (r.listing.buyPrice != null ? r.listing.buyPrice * (r.listing.coveredQty || r.listing.qty) : 0), 0)
    return { rows, totalQty, totalValue, totalTax, totalProfit, totalCost }
  }, [data])

  /* ── MAGAZZINO OVERVIEW — all open lots across items with aging ── */
  const magazzinoOverview = useMemo(() => {
    if (!data) return { rows: [], totalQty: 0, totalSpent: 0, totalEstValue: 0, totalEstProfit: 0, itemCount: 0 }
    const rows = []
    const itemSet = new Set()
    for (const name of Object.keys(data.items || {})) {
      const it = data.items[name]
      const lots = it.lots || []
      const ps = it.prices || []
      // Ultimo prezzo reale (coerente con lotStats)
      const realPrices = ps.filter(p => !p.esaurito)
      const currentPrice = realPrices.length ? realPrices[realPrices.length - 1].price : null
      // One row per open lot
      for (const lot of lots) {
        if (lot.sold) continue
        const lotCost = lot.qty * lot.price
        // Profitto stimato = qty * (ultimo prezzo - prezzo acquisto)
        const estValue = currentPrice != null ? lot.qty * currentPrice : null
        const estProfit = currentPrice != null ? lot.qty * (currentPrice - lot.price) : null
        const ageDays = (Date.now() - new Date(lot.timestamp).getTime()) / 86400000
        rows.push({ name, lot, qty: lot.qty, price: lot.price, lotCost, estValue, estProfit, ageDays, currentPrice, note: lot.note })
        itemSet.add(name)
      }
    }
    const totalQty = rows.reduce((a, r) => a + r.qty, 0)
    const totalSpent = rows.reduce((a, r) => a + r.lotCost, 0)
    const totalEstValue = rows.reduce((a, r) => a + (r.estValue || 0), 0)
    const totalEstProfit = rows.reduce((a, r) => a + (r.estProfit || 0), 0)
    const itemCount = itemSet.size
    return { rows, totalQty, totalSpent, totalEstValue, totalEstProfit, itemCount }
  }, [data])

  /* ── STAGING & PERFORMANCE ANALYTICS ── */
  const performanceAnalytics = useMemo(() => {
    if (!data) return { byItem: [], capitalChart: [] }
    const byItem = []
    for (const name of Object.keys(data.items || {})) {
      const it = data.items[name]
      const lots = it.lots || []
      const lsList = it.listings || []
      const ps = it.prices || []

      // Staging: time from lot purchase to first listing that consumed it
      const soldLots = lots.filter(l => l.sold)
      const openLots = lots.filter(l => !l.sold)
      const activeListings = lsList.filter(l => !l.sold)
      const soldListings = lsList.filter(l => l.sold)

      // Build lot lookup map for O(1) access
      const lotMap = new Map(lots.map(l => [l.id, l]))

      // Staging time: for each listing, time from its listedAt to the earliest lot timestamp linked
      const stagingDays = []
      for (const ls of lsList) {
        if (!ls.lotLinks || !ls.lotLinks.length) continue
        for (const lk of ls.lotLinks) {
          const lot = lotMap.get(lk.lotId)
          if (lot) {
            const days = (new Date(ls.listedAt) - new Date(lot.timestamp)) / 86400000
            stagingDays.push(days)
          }
        }
      }
      const avgStaging = stagingDays.length ? stagingDays.reduce((a, b) => a + b, 0) / stagingDays.length : null
      const minStaging = stagingDays.length ? Math.min(...stagingDays) : null
      const maxStaging = stagingDays.length ? Math.max(...stagingDays) : null

      // Sell time: listing to sold
      const sellDays = soldListings.filter(l => l.soldAt).map(l => (new Date(l.soldAt) - new Date(l.listedAt)) / 86400000)
      const avgSell = sellDays.length ? sellDays.reduce((a, b) => a + b, 0) / sellDays.length : null
      const minSell = sellDays.length ? Math.min(...sellDays) : null
      const maxSell = sellDays.length ? Math.max(...sellDays) : null

      // Full cycle: lot purchase to sold listing
      const cycleDays = []
      for (const ls of soldListings) {
        if (!ls.soldAt || !ls.lotLinks) continue
        for (const lk of ls.lotLinks) {
          const lot = lotMap.get(lk.lotId)
          if (lot) cycleDays.push((new Date(ls.soldAt) - new Date(lot.timestamp)) / 86400000)
        }
      }
      const avgCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : null

      // ROI
      const soldWithBuy = soldListings.filter(l => l.buyPrice != null)
      const totalRevenue = soldWithBuy.reduce((a, l) => a + l.listPrice * (l.coveredQty || l.qty), 0)
      const totalCost = soldWithBuy.reduce((a, l) => a + l.buyPrice * (l.coveredQty || l.qty), 0)
      const totalTax = soldWithBuy.reduce((a, l) => a + (l.tax || 0), 0)
      const totalProfit = totalRevenue - totalCost - totalTax
      const roiPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : null

      // Profit per day (efficiency)
      const profitPerDay = avgSell != null && avgSell > 0 && totalProfit !== 0
        ? totalProfit / soldWithBuy.length / avgSell : null

      // Capital tied up
      const openValue = openLots.reduce((a, l) => a + l.qty * l.price, 0)
      const bazarValue = activeListings.reduce((a, l) => a + l.qty * l.listPrice, 0)

      // Sell-through rate
      const totalListed = lsList.reduce((a, l) => a + l.qty, 0)
      const totalSold = soldListings.reduce((a, l) => a + l.qty, 0)
      const sellThrough = totalListed > 0 ? (totalSold / totalListed) * 100 : null

      if (lots.length > 0 || lsList.length > 0) {
        byItem.push({
          name, avgStaging, minStaging, maxStaging, avgSell, minSell, maxSell, avgCycle,
          roiPct, totalProfit, profitPerDay, openValue, bazarValue,
          sellThrough, soldCount: soldListings.length, totalListed, totalSold,
          stockQty: openLots.reduce((a, l) => a + l.qty, 0),
          bazarQty: activeListings.reduce((a, l) => a + l.qty, 0)
        })
      }
    }

    // Capital distribution chart data
    const capitalChart = byItem
      .filter(r => r.openValue > 0 || r.bazarValue > 0)
      .map(r => ({ name: r.name, magazzino: r.openValue, bazar: r.bazarValue, totale: r.openValue + r.bazarValue }))
      .sort((a, b) => b.totale - a.totale)

    return { byItem, capitalChart }
  }, [data])

  /* ── SELL TIME DATA (extracted from IIFE) ── */
  const sellTimeData = useMemo(() => {
    const rows = performanceAnalytics.byItem
      .filter(r => r.avgSell != null)
      .map(r => ({ name: r.name, days: r.avgSell, ms: r.avgSell * 86400000 }))
      .sort((a, b) => b.days - a.days)
    if (!rows.length) return null
    const avgDays = rows.reduce((a, r) => a + r.days, 0) / rows.length
    const chartData = rows.map(r => ({ name: r.name, giorni: Math.round(r.days * 10) / 10 }))
    return { rows, avgDays, chartData }
  }, [performanceAnalytics])

  /* ── STAGING TIME DATA (extracted from IIFE) ── */
  const stagingTimeData = useMemo(() => {
    if (!magazzinoOverview.rows.length) return null
    const stagingMap = {}
    const stagingAll = {}
    for (const r of magazzinoOverview.rows) {
      if (!stagingAll[r.name]) stagingAll[r.name] = []
      stagingAll[r.name].push(r.ageDays)
      if (!stagingMap[r.name] || r.ageDays > stagingMap[r.name].ageDays) {
        stagingMap[r.name] = { name: r.name, ageDays: r.ageDays, ageMs: Date.now() - new Date(r.lot.timestamp).getTime() }
      }
    }
    const rows = Object.values(stagingMap).map(r => {
      const all = stagingAll[r.name]
      const avg = all.reduce((a, b) => a + b, 0) / all.length
      return { ...r, avgDays: avg }
    }).sort((a, b) => b.ageDays - a.ageDays)
    if (!rows.length) return null
    const globalAvg = rows.reduce((a, r) => a + r.ageDays, 0) / rows.length
    const chartData = rows.map(r => ({ name: r.name, giorni: Math.round(r.ageDays * 10) / 10, media: Math.round(r.avgDays * 10) / 10 }))
    return { rows, globalAvg, chartData }
  }, [magazzinoOverview])

  /* ── NOS DOLLARI — items with category "Item Shop ND" ── */
  const ndItems = useMemo(() => {
    if (!data) return []
    const rate = data.ndRate || 0
    return Object.keys(data.items || {})
      .filter(name => data.items[name]?.meta?.category === "Item Shop ND")
      .map(name => {
        const it = data.items[name]
        const ndCost    = it.meta?.ndCost || 0
        const ndQty     = it.meta?.ndQty  || 1
        const itemDisc  = it.meta?.ndDiscount || 0
        const disc      = globalNdDisc > 0 ? globalNdDisc : itemDisc
        const useCost   = disc > 0 ? Math.ceil(ndCost * (1 - disc / 100)) : ndCost
        const ps        = (it.prices || []).filter(p => !p.esaurito)
        const marketPrice = ps.length ? ps[ps.length - 1].price : null
        const costGold  = useCost * rate
        const revenue   = marketPrice != null ? marketPrice * ndQty : null
        const profit    = revenue != null && costGold > 0 ? revenue - costGold : null
        return { name, ndCost, ndQty, disc, useCost, marketPrice, costGold, revenue, profit }
      })
    const profitable = list.filter(r => r.profit != null && r.profit > 0).length
    const losing     = list.filter(r => r.profit != null && r.profit < 0).length
    const best       = list.filter(r => r.profit != null).sort((a,b) => b.profit - a.profit)[0]
    return Object.assign(list, { profitable, losing, bestProfit: best ? best.profit : null })
  }, [data, globalNdDisc])

  /* ── ANALISI ROWS ── */
  const analysisRows = useMemo(() => {
    if (!data) return []
    return itemNames.map(name => {
      const it     = data.items[name]
      const ps     = it.prices   || []
      const ls     = it.lots     || []
      const lsList = it.listings || []

      const realPs     = ps.filter(p => !p.esaurito)
      const current    = realPs.length ? realPs[realPs.length-1].price : null
      const signal     = signalCache[name] || getSignal(it, data?.signalConfig)

      const openLots   = ls.filter(l => !l.sold)
      const stockQty   = openLots.reduce((a,l) => a+l.qty, 0)
      const stockValue = openLots.reduce((a,l) => a+l.qty*l.price, 0)

      const activeL    = lsList.filter(l => !l.sold)
      const bazarQty   = activeL.reduce((a,l) => a+l.qty, 0)
      const bazarValue = activeL.reduce((a,l) => a+l.qty*l.listPrice, 0)

      const soldBuy    = lsList.filter(l => l.sold && l.buyPrice != null)
      const totalRevenue = soldBuy.reduce((a,l) => a + l.listPrice * (l.coveredQty || l.qty), 0)
      const totalCostA  = soldBuy.reduce((a,l) => a + l.buyPrice * (l.coveredQty || l.qty), 0)
      const totalTaxA   = soldBuy.reduce((a,l) => a + (l.tax || 0), 0)
      const totalProfit = totalRevenue - totalCostA - totalTaxA
      const roiPct     = totalCostA > 0 ? (totalProfit / totalCostA) * 100 : null

      const soldL      = lsList.filter(l => l.sold)
      const avgSellMs  = soldL.length
        ? soldL.reduce((a,l) => a + (new Date(l.soldAt) - new Date(l.listedAt)), 0) / soldL.length
        : null

      const trend7 = calcTrend(ps, trendDays)
      const vol    = calcVolatility(ps)
      return { name, current, signal, stockQty, stockValue, bazarQty, bazarValue, roiPct, avgSellMs, totalProfit, priceCount: ps.length, trend7, vol }
    })
  }, [data, itemNames])

  /* ── SIDEBAR CARD STATS (memoized) ── */
  const sideStatsMap = useMemo(() => {
    const defaults = { last: null, trend: null, tColor: C.flat, openQty: 0, count: 0, isEsaurito: false }
    const map = {}
    for (const name of itemNames) {
      const it = data?.items?.[name]
      if (!it) { map[name] = defaults; continue }
      const ps         = it.prices || []
      const lastEntry  = ps[ps.length-1]
      const isEsaurito = lastEntry?.esaurito === true
      const realPs     = ps.filter(p => !p.esaurito)
      const last       = realPs[realPs.length-1]?.price
      const t7         = calcTrend(ps, trendDays)
      const trend      = t7 ? (t7.pct > 0.5 ? "▲" : t7.pct < -0.5 ? "▼" : "—") : null
      const tColor     = trend === "▲" ? C.green : trend === "▼" ? C.red : C.flat
      const openQty    = calcOpenQty(it)
      map[name] = { last, trend, tColor, openQty, count: realPs.length, isEsaurito }
    }
    return map
  }, [data, itemNames])

  /* ── ACTIONS ── */
  const addItem = () => {
    const n = newName.trim()
    if (!n || data.items[n]) return
    const cat = newCat !== "—" ? newCat : undefined
    upd({ ...data, items: { ...data.items, [n]: { meta: { category: cat }, prices: [], lots: [], listings: [] } } })
    setNewName(""); setNewCat("—")
    setSelItem(n); setPage("item"); setSubPage("prices")
  }

  const recordPrice = () => {
    const price = parseG(pVal)
    if (!selItem || isNaN(price) || price <= 0) return
    // Anomaly check: usa dataRef per dati freschi
    const pre = dataRef.current || data
    const prePrices = pre.items[selItem]?.prices || []
    const realPrices = prePrices.filter(p => !p.esaurito)
    if (realPrices.length >= 3) {
      const avg    = realPrices.reduce((a, p) => a + p.price, 0) / realPrices.length
      const devPct = Math.abs(price - avg) / avg
      if (devPct > 0.40) {
        const dir = price > avg ? "sopra" : "sotto"
        if (!window.confirm(`⚠️ Prezzo anomalo!\n\n${fmtG(Math.round(price))} è ${(devPct*100).toFixed(0)}% ${dir} la media storica (${fmtG(Math.round(avg))}).\n\nConfermi questo prezzo?`)) return
      }
    }
    // Ri-leggi dataRef DOPO il confirm (il dialog blocca il thread, lo stato potrebbe essere cambiato)
    const d = dataRef.current || data
    const curPrices = d.items[selItem]?.prices || []
    const entry = { price: Math.round(price), timestamp: new Date().toISOString(), eventId: curEventId, note: pNote.trim() }
    const it = { ...d.items[selItem], prices: [...curPrices, entry] }
    upd({ ...d, items: { ...d.items, [selItem]: it } })
    setPVal(""); setPNote("")
  }

  const recordEsaurito = () => {
    if (!selItem) return
    const d = dataRef.current || data
    const curPrices = d.items[selItem]?.prices || []
    // Non aggiungere doppio esaurito consecutivo
    if (curPrices.length && curPrices[curPrices.length-1].esaurito) return
    const entry = { price: null, esaurito: true, timestamp: new Date().toISOString(), eventId: curEventId, note: "" }
    const it = { ...d.items[selItem], prices: [...curPrices, entry] }
    upd({ ...d, items: { ...d.items, [selItem]: it } })
  }

  const delPrice = idx => {
    if (!window.confirm("Eliminare questa registrazione di prezzo?")) return
    // Use dataRef to avoid stale closure after confirm dialog
    const d = dataRef.current || data
    const curPrices = d.items[selItem]?.prices || []
    const it = { ...d.items[selItem], prices: curPrices.filter((_,i) => i !== idx) }
    upd({ ...d, items: { ...d.items, [selItem]: it } })
  }

  const recordLot = () => {
    const qty   = parseInt(lQty, 10)
    const price = parseG(lPrice)
    if (!selItem || isNaN(qty) || qty <= 0 || qty > 999 || isNaN(price) || price <= 0) return
    const roundedPrice = Math.round(price)
    // Anomaly check: se il prezzo devia >40% dalla media storica, chiedi conferma
    const realPrices = prices.filter(p => !p.esaurito)
    if (realPrices.length >= 3) {
      const avg    = realPrices.reduce((a, p) => a + p.price, 0) / realPrices.length
      const devPct = Math.abs(roundedPrice - avg) / avg
      if (devPct > 0.40) {
        const dir = roundedPrice > avg ? "sopra" : "sotto"
        if (!window.confirm(`⚠️ Prezzo acquisto anomalo!\n\n${fmtG(roundedPrice)} è ${(devPct*100).toFixed(0)}% ${dir} la media storica (${fmtG(Math.round(avg))}).\n\nConfermi questo prezzo?`)) return
      }
    }
    // Se esiste un lotto aperto con lo stesso prezzo e c'è spazio, somma le quantità
    const existingIdx = lots.findIndex(l => !l.sold && l.price === roundedPrice)
    if (existingIdx !== -1 && lots[existingIdx].qty + qty <= 999) {
      const updatedLots = lots.map((l, i) => i === existingIdx ? { ...l, qty: l.qty + qty } : l)
      const it = { ...data.items[selItem], lots: updatedLots }
      upd({ ...data, items: { ...data.items, [selItem]: it } })
      setLQty(""); setLPrice("")
      return
    }
    // Altrimenti crea un nuovo lotto (anche se stesso prezzo — non c'è spazio per il merge)
    const lot = { id: Date.now() + '_' + Math.random().toString(36).slice(2,6), qty, price: roundedPrice, timestamp: new Date().toISOString(), eventId: curEventId, note: "", sold: false }
    const it  = { ...data.items[selItem], lots: [...lots, lot] }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
    setLQty(""); setLPrice("")
  }

  const delLot = idx => {
    const lot = lots[idx]
    // Warn if lot is linked to any active listing
    const linkedListings = listings.filter(l => !l.sold && l.lotLinks?.some(lk => lk.lotId === lot.id))
    if (linkedListings.length > 0) {
      if (!window.confirm(`Questo lotto è collegato a ${linkedListings.length} listing attiv${linkedListings.length===1?"o":"i"}. Eliminare comunque?`)) return
    }
    // Clean up dangling lotLinks in active listings that referenced this lot
    const cleanedListings = listings.map(l => {
      if (l.sold || !l.lotLinks) return l
      const cleaned = l.lotLinks.filter(lk => lk.lotId !== lot.id)
      if (cleaned.length === l.lotLinks.length) return l
      const removedQty = l.lotLinks.filter(lk => lk.lotId === lot.id).reduce((a, lk) => a + lk.qty, 0)
      const newCovered = Math.max(0, (l.coveredQty || 0) - removedQty)
      const newCost = cleaned.reduce((a, lk) => a + lk.qty * lk.unitPrice, 0)
      return { ...l, lotLinks: cleaned, coveredQty: newCovered, totalCost: newCost, buyPrice: newCovered > 0 ? Math.round(newCost / newCovered) : null }
    })
    const it = { ...data.items[selItem], lots: lots.filter((_,i) => i !== idx), listings: cleanedListings }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
  }

  const delItem = name => {
    if (!window.confirm(`Eliminare "${name}" e tutti i suoi dati?`)) return
    const items = { ...data.items }
    delete items[name]
    upd({ ...data, items })
    setSelItem(itemNames.find(i => i !== name) || null)
    setPage("dashboard")
  }

  const renameItem = (oldName, newVal) => {
    const trimmed = newVal.trim()
    if (!trimmed || trimmed === oldName) { setRenaming(false); return }
    if (data.items[trimmed]) { alert(`Esiste già un item chiamato "${trimmed}"`); return }
    const items = { ...data.items }
    items[trimmed] = items[oldName]
    delete items[oldName]
    upd({ ...data, items })
    setSelItem(trimmed)
    setRenaming(false)
    setRenameVal("")
  }

  const copyName = name => {
    navigator.clipboard.writeText(name)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopyFlash(true)
    copyTimer.current = setTimeout(() => setCopyFlash(false), 1200)
  }

  const addListing = () => {
    const qty   = parseInt(lsQty, 10)
    const listP = parseG(lsPrice)
    const tax   = lsTax.trim() ? parseG(lsTax) : 0
    if (!selItem || isNaN(qty) || qty <= 0 || isNaN(listP) || listP <= 0) return
    const match = matchLotsForQty(lots, qty, lotStrategy)
    const hasLots = match.links && match.links.length > 0
    const entry = { qty, listPrice: Math.round(listP), buyPrice: match.avgBuyPrice, coveredQty: match.coveredQty, totalCost: match.totalCost, lotLinks: match.links, listedAt: new Date().toISOString(), tax: isNaN(tax) ? 0 : Math.round(tax), sold: false, soldAt: null, lotsConsumed: hasLots }
    // Consume lots from warehouse immediately (FIFO)
    const updatedLots = lots.map(l => ({ ...l }))
    if (match.links) {
      for (const link of match.links) {
        const lotIdx = updatedLots.findIndex(l => l.id === link.lotId)
        if (lotIdx !== -1) {
          if (link.qty >= updatedLots[lotIdx].qty) {
            updatedLots[lotIdx].sold = true
          } else {
            updatedLots[lotIdx].qty -= link.qty
          }
        }
      }
    }
    const it = { ...data.items[selItem], lots: updatedLots, listings: [...listings, entry] }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
    setLsQty(""); setLsPrice(""); setLsTax("")
  }

  // Shared logic for marking a listing as sold (full or partial)
  const processListingSold = (itemName, allLots, allListings, idx, soldQty) => {
    const listing = allListings[idx]
    if (!listing || listing.sold) return null
    const isFullSale = !soldQty || soldQty >= listing.qty

    if (isFullSale) {
      const updatedLots = allLots.map(l => ({ ...l }))
      if (!listing.lotsConsumed && listing.lotLinks) {
        for (const link of listing.lotLinks) {
          const lotIdx = updatedLots.findIndex(l => l.id === link.lotId)
          if (lotIdx !== -1) {
            if (link.qty >= updatedLots[lotIdx].qty) updatedLots[lotIdx].sold = true
            else updatedLots[lotIdx].qty -= link.qty
          }
        }
      }
      const updatedListings = allListings.map((l,i) => i === idx ? { ...l, sold: true, soldAt: new Date().toISOString() } : l)
      return { lots: updatedLots, listings: updatedListings }
    } else {
      const proportionalTax = listing.tax ? Math.round(listing.tax * soldQty / listing.qty) : 0
      const soldCovered = Math.min(soldQty, listing.coveredQty || 0)
      const soldEntry = {
        qty: soldQty, listPrice: listing.listPrice, buyPrice: listing.buyPrice,
        coveredQty: soldCovered, totalCost: listing.buyPrice ? listing.buyPrice * soldCovered : 0,
        lotLinks: null, listedAt: listing.listedAt, tax: proportionalTax,
        sold: true, soldAt: new Date().toISOString(), lotsConsumed: false
      }
      let newLinks = listing.lotLinks ? listing.lotLinks.map(lk => ({...lk})) : []
      let rem = soldQty
      for (let i = 0; i < newLinks.length && rem > 0; i++) {
        const take = Math.min(newLinks[i].qty, rem)
        newLinks[i].qty -= take
        rem -= take
      }
      newLinks = newLinks.filter(lk => lk.qty > 0)
      const remainingCovered = Math.max(0, (listing.coveredQty || 0) - soldQty)
      const updatedListing = {
        ...listing, qty: listing.qty - soldQty, coveredQty: remainingCovered,
        lotLinks: newLinks, totalCost: newLinks.reduce((a, lk) => a + lk.qty * lk.unitPrice, 0),
        tax: (listing.tax || 0) - proportionalTax
      }
      const updatedListings = [...allListings]
      updatedListings[idx] = updatedListing
      updatedListings.push(soldEntry)
      return { lots: allLots.map(l => ({ ...l })), listings: updatedListings }
    }
  }

  const markListingSold = (idx, soldQty) => {
    const result = processListingSold(selItem, lots, listings, idx, soldQty)
    if (!result) return
    const it = { ...data.items[selItem], lots: result.lots, listings: result.listings }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
    setPartialIdx(null)
    setPartialQty("")
  }

  const markBazarListingSold = (itemName, listingIdx, soldQty) => {
    const it = data.items[itemName]
    if (!it) return
    const result = processListingSold(itemName, it.lots || [], it.listings || [], listingIdx, soldQty)
    if (!result) return
    upd({ ...data, items: { ...data.items, [itemName]: { ...it, lots: result.lots, listings: result.listings } } })
    setBazarPartialKey(null)
    setBazarPartialQty("")
  }

  const delListing = idx => {
    const listing = listings[idx]
    const updatedLots = lots.map(l => ({ ...l }))
    // Restore lots to warehouse if listing was active and lots were consumed
    if (listing.lotsConsumed && !listing.sold && listing.lotLinks) {
      for (const link of listing.lotLinks) {
        const lotIdx = updatedLots.findIndex(l => l.id === link.lotId)
        if (lotIdx !== -1) {
          if (updatedLots[lotIdx].sold) {
            // Lot was fully consumed — restore it with the linked qty
            updatedLots[lotIdx].sold = false
            updatedLots[lotIdx].qty = link.qty
          } else {
            // Lot was partially consumed — add back the linked qty
            updatedLots[lotIdx].qty += link.qty
          }
        }
      }
    }
    const it = { ...data.items[selItem], lots: updatedLots, listings: listings.filter((_,i) => i !== idx) }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
  }

  const saveTargets = () => {
    const buyT  = tBuy.trim()  ? parseG(tBuy)  : null
    const sellT = tSell.trim() ? parseG(tSell) : null
    const meta  = { ...data.items[selItem].meta, buyTarget: buyT ?? undefined, sellTarget: sellT ?? undefined }
    const it    = { ...data.items[selItem], meta }
    upd({ ...data, items: { ...data.items, [selItem]: it } })
    setShowTargetEdit(false)
  }

  const quickSave = () => {
    const price = parseG(qPrice)
    const cur = qItemRef.current
    if (!cur || isNaN(price) || price <= 0) return
    const d = dataRef.current || data
    const entry = { price: Math.round(price), timestamp: new Date().toISOString(), eventId: curEventId, note: "" }
    const it = { ...d.items[cur], prices: [...(d.items[cur]?.prices || []), entry] }
    const newRecent = [{ name: cur, price: Math.round(price), ts: new Date().toISOString() }, ...qRecent].slice(0, 12)
    setQRecent(newRecent)
    const nd = { ...d, items: { ...d.items, [cur]: it }, qRecent: newRecent }
    upd(nd)
    setQPrice("")
    // Auto-advance to next item (alphabetical)
    const names = Object.keys(nd.items || {}).sort((a,b) => a.localeCompare(b))
    const curIdx = names.indexOf(cur)
    if (curIdx >= 0 && curIdx < names.length - 1) {
      const nextName = names[curIdx + 1]
      setQItem(nextName)
      navigator.clipboard.writeText(nextName)
    }
    setTimeout(() => qPriceRef.current?.focus(), 30)
  }

  const openQuick = useCallback(() => {
    if (itemNames.length === 0) return
    const d = dataRef.current || data
    const names = Object.keys(d?.items || {}).sort((a,b) => a.localeCompare(b))
    if (!names.length) return
    setQItem(q => {
      // Se il modal è già aperto e l'item corrente esiste, mantienilo
      if (q && d?.items?.[q]) {
        navigator.clipboard.writeText(q)
        return q
      }
      const first = names[0]
      navigator.clipboard.writeText(first)
      return first
    })
    setQPrice("")
    setShowQuick(true)
    setTimeout(() => qPriceRef.current?.focus(), 80)
  }, [itemNames, data])
  openQuickRef.current = openQuick

  const sortAnalysis = col => {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  const exportCSV = async () => {
    const r = await window.api.exportCsv({ name: selItem, entries: prices.filter(p => !p.esaurito) })
    if (r.ok) alert(`Esportato: ${r.path}`)
  }

  /* ── DASHBOARD CARDS (memoized) ── */
  const dashboardCards = useMemo(() => {
    if (!data) return []
    return itemNames.map(name => {
      const it      = data.items[name]
      const ps      = it.prices || []
      const ls      = it.lots   || []
      const lsList  = it.listings || []
      const sig     = signalCache[name] || getSignal(it, data?.signalConfig)
      const realPs  = ps.filter(p => !p.esaurito)
      const last    = realPs.length ? realPs[realPs.length-1].price : null
      const prev    = realPs.length >= 2 ? realPs[realPs.length-2].price : null
      const trend   = last!=null&&prev!=null ? (last>prev?"▲":last<prev?"▼":"—") : null
      const tCol    = trend==="▲"?C.green:trend==="▼"?C.red:C.muted
      const openLots  = ls.filter(l=>!l.sold)
      const openQty   = openLots.reduce((a,l)=>a+l.qty,0)
      const spent     = openLots.reduce((a,l)=>a+l.qty*l.price,0)
      const estProfit = last!=null&&openQty>0 ? openQty*last - spent : null
      const activeL   = lsList.filter(l=>!l.sold)
      const soldL     = lsList.filter(l=>l.sold)
      const activeQtyL = activeL.reduce((a,l)=>a+l.qty,0)
      const sellTimes  = soldL.map(l=>new Date(l.soldAt)-new Date(l.listedAt))
      const avgMs      = sellTimes.length ? sellTimes.reduce((a,b)=>a+b,0)/sellTimes.length : null
      const buyT   = it.meta?.buyTarget
      const sellT  = it.meta?.sellTarget
      const trend7 = calcTrend(ps, trendDays)
      return { name, it, ps, ls, lsList, sig, last, prev, trend, tCol, openQty, spent, estProfit, activeQtyL, avgMs, buyT, sellT, trend7 }
    })
  }, [data, itemNames])

  /* ── SORTED ANALYSIS ROWS ── */
  const sortedAnalysis = useMemo(() => {
    let rows = analysisRows
    // search filter
    if (analSearch.trim()) {
      const q = analSearch.trim().toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(q))
    }
    // signal filter
    const group = SIGNAL_GROUPS.find(g => g.id === analSignalFilter)
    if (group?.types) {
      rows = rows.filter(r => group.types.includes(r.signal.type))
    }
    return [...rows].sort((a,b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (sortCol === "signal") { va = a.signal.diffPct ?? 0; vb = b.signal.diffPct ?? 0 }
      if (sortCol === "trend7") { va = a.trend7?.pct ?? null; vb = b.trend7?.pct ?? null }
      if (sortCol === "vol")    { va = a.vol?.cv    ?? null; vb = b.vol?.cv    ?? null }
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === "string") return va.localeCompare(vb) * sortDir
      return (va - vb) * sortDir
    })
  }, [analysisRows, sortCol, sortDir, analSearch, analSignalFilter])

  /* ── LOADING ── */
  if (!data) return (
    <div style={{ height:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, WebkitAppRegion:"drag" }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <div style={{ color:C.muted, fontFamily:"monospace", letterSpacing:4, fontSize:12 }}>CARICAMENTO</div>
    </div>
  )

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div style={{ height:"100vh", background:C.bg, color:C.text, fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column" }}>
      <style>{`
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:${C.gold}!important;outline:none}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:${theme==="light"?"#7a8494":"#4a5270"}}
        .up{animation:up .2s ease}
        .r:hover{background:${theme==="light"?"rgba(0,0,0,.04)":"rgba(255,255,255,.04)"}!important;transition:background .12s}
        .si:hover{background:rgba(${theme==="light"?"184,120,26":"232,168,56"},.08)!important;cursor:pointer}
        .dc:hover{border-color:${C.gold}66!important;transform:translateY(-2px);box-shadow:0 4px 20px rgba(0,0,0,${theme==="light"?".1":".3"})}
        .dc{transition:all .18s}
        input[type=number]::-webkit-inner-spin-button{opacity:.4}
        select option{background:${C.panel};color:${C.text}}
      `}</style>

      {/* ══ TITLEBAR ══ */}
      <div style={{ height:46, background:C.panel, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", paddingLeft:16, paddingRight:12, gap:14, flexShrink:0, WebkitAppRegion:"drag" }}>
        <span style={{ fontSize:19 }}>⚔️</span>
        <span style={{ color:C.gold, fontWeight:700, letterSpacing:2, fontSize:17 }}>NOSTALE TRACKER</span>
        <span style={{ color:C.muted, fontSize:12, letterSpacing:1 }}>v{appVersion}</span>
        {saveStatus === "error" && <span style={{ color:C.red, fontSize:11, fontWeight:700, animation:"blink 1s infinite", WebkitAppRegion:"no-drag" }}>⚠ ERRORE SALVATAGGIO</span>}
        {saveStatus === "saving" && <span style={{ color:C.gold, fontSize:11, WebkitAppRegion:"no-drag" }}>💾</span>}
        {saveStatus === "ok" && <span style={{ color:C.green, fontSize:11, WebkitAppRegion:"no-drag" }}>✓</span>}

        <button onClick={()=>setPage("analisi")} title="Analisi comparativa item"
          style={{ background:page==="analisi"?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${page==="analisi"?C.gold:`${C.gold}55`}`, borderRadius:7, color:page==="analisi"?C.gold:C.muted, cursor:"pointer", padding:"4px 10px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag" }}>
          📊 Analisi
        </button>

        <div style={{ flex:1 }}/>

        <button onClick={openQuick} title="Quick-add prezzi (Ctrl+Q)"
          style={{ background:showQuick?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${showQuick?C.gold:`${C.gold}55`}`, borderRadius:7, color:C.gold, cursor:"pointer", padding:"4px 12px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag" }}>
          ⚡ Prezzo Rapido
        </button>

        <button onClick={()=>setPage("bazar")} title="Listing attivi al bazar"
          style={{ background:page==="bazar"?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${page==="bazar"?C.gold:`${C.gold}55`}`, borderRadius:7, color:C.gold, cursor:"pointer", padding:"4px 10px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag", display:"flex", alignItems:"center", gap:5 }}>
          🏷️ Bazar
        </button>

        <button onClick={()=>setPage("magazzino")} title="Magazzino globale — stock e aging"
          style={{ background:page==="magazzino"?`${C.blue}2e`:`${C.blue}14`, border:`1px solid ${page==="magazzino"?C.blue:`${C.blue}55`}`, borderRadius:7, color:C.blue, cursor:"pointer", padding:"4px 10px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag", display:"flex", alignItems:"center", gap:5 }}>
          📦 Magazzino
        </button>

        <button onClick={()=>setPage("nd")} title="Calcolo costo Nos Dollari in gold"
          style={{ background:page==="nd"?"rgba(168,85,247,.18)":"rgba(168,85,247,.08)", border:`1px solid ${page==="nd"?"#a855f7":"#a855f755"}`, borderRadius:7, color:"#a855f7", cursor:"pointer", padding:"4px 10px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag", display:"flex", alignItems:"center", gap:5 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" fill="#a855f7" stroke="#c084fc" strokeWidth="1.5"/>
            <text x="10" y="14.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" fontFamily="monospace">$</text>
          </svg>
          Nos Dollari
        </button>

        <button onClick={()=>setShowSettings(true)} title="Impostazioni"
          style={{ background:showSettings?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${showSettings?C.gold:`${C.gold}55`}`, borderRadius:7, color:showSettings?C.gold:C.muted, cursor:"pointer", padding:"4px 10px", fontSize:12, fontWeight:700, letterSpacing:1, WebkitAppRegion:"no-drag" }}>
          ⚙️ Settings
        </button>

        {/* window controls */}
        <div style={{ display:"flex", gap:3, WebkitAppRegion:"no-drag" }}>
          {[
            { l:"−", a:()=>window.api.minimize(), h:C.muted },
            { l:"□", a:()=>window.api.maximize(), h:C.muted },
            { l:"✕", a:()=>window.api.close(),    h:C.red   },
          ].map(b => (
            <button key={b.l} onClick={b.a} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:4, color:b.h, width:24, height:24, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:sidebarW, background:C.panel, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, position:"relative" }}>
          {/* resize handle */}
          <div
            onMouseDown={e => {
              e.preventDefault()
              sideResizing.current = true
              const startX = e.clientX
              const startW = sidebarW
              const onMove = ev => { if (sideResizing.current) setSidebarW(Math.max(180, Math.min(400, startW + ev.clientX - startX))) }
              const onUp = () => { sideResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
              window.addEventListener("mousemove", onMove)
              window.addEventListener("mouseup", onUp)
            }}
            style={{ position:"absolute", right:-3, top:0, bottom:0, width:6, cursor:"col-resize", zIndex:10 }}
          />

          {/* top nav */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
            {[["dashboard","🏠"],["new","＋"]].map(([t,l]) => (
              <div key={t} onClick={()=>setPage(t)} style={{ flex:1, textAlign:"center", padding:"10px 0", fontSize:15, cursor:"pointer", color:page===t?C.gold:C.muted, borderBottom:`2px solid ${page===t?C.gold:"transparent"}`, transition:"all .15s" }}>{l}</div>
            ))}
          </div>

          {page === "new" ? (
            /* ── NEW ITEM FORM ── */
            <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }} className="up">
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:2 }}>NOME ITEM</div>
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="es. Amuleto Elementale" style={inp()}/>
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3 }}>CATEGORIA</div>
              <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={inp()}>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addItem} disabled={!newName.trim()} style={{ ...pill(!!newName.trim()), marginTop:4, padding:"10px" }}>AGGIUNGI ITEM</button>
            </div>
          ) : (
            /* ── ITEM LIST ── */
            <>
              <div style={{ padding:"8px 10px 6px", borderBottom:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:5 }}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 cerca item..." style={inp({ padding:"6px 10px", fontSize:11 })}/>
                <div style={{ display:"flex", gap:3 }}>
                  {[["name","A-Z"],["price","Prezzo"],["signal","Segnale"]].map(([k,l]) => (
                    <button key={k} onClick={()=>setSideSort(k)}
                      style={{ flex:1, padding:"4px 0", fontSize:11, background:sideSort===k?C.gold:"transparent", color:sideSort===k?C.pillTxt:C.muted, border:`1px solid ${sideSort===k?C.gold:C.border}`, borderRadius:4, cursor:"pointer", letterSpacing:.5 }}>
                      {l}
                    </button>
                  ))}
                </div>
                <select value={sideCategory} onChange={e=>setSideCategory(e.target.value)} style={inp({ padding:"4px 7px", fontSize:12 })}>
                  <option value="__all__">Tutte le categorie</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"5px 7px", display:"flex", flexDirection:"column", gap:2 }}>
                {filtered.length === 0 && (
                  <div style={{ color:C.muted, fontSize:11, textAlign:"center", marginTop:30 }}>
                    {itemNames.length === 0 ? "Aggiungi il primo item →" : "Nessun risultato"}
                  </div>
                )}
                {filtered.map(name => {
                  const { last, trend, tColor, openQty, count, isEsaurito } = sideStatsMap[name] || {}
                  const active = selItem === name && page === "item"
                  const sig    = signalCache[name] || { type:"nodata", color:"#5a6a8a", icon:"·", label:"" }
                  const cat    = data?.items?.[name]?.meta?.category
                  return (
                    <div key={name} className="si"
                      onClick={()=>{ setSelItem(name); setPage("item"); setSubPage("prices"); if(allDays.length) setChartDay(allDays[0]); copyName(name) }}
                      style={{ padding:"8px 9px", paddingLeft:11, borderRadius:7, background:active?"rgba(245,158,11,.09)":"transparent", border:`1px solid ${active?C.gold+"55":isEsaurito?"#a78bfa33":"transparent"}`, borderLeft:`3px solid ${sig.color}44`, transition:"all .15s", position:"relative" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:14, color:active?C.gold:C.text, fontWeight:active?700:400, maxWidth:sidebarW - 100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
                        {isEsaurito
                          ? <span style={{ fontSize:13, color:"#a78bfa", background:"rgba(167,139,250,.12)", borderRadius:4, padding:"2px 6px" }}>📭</span>
                          : sig.type !== "nodata" && <span style={{ fontSize:13, color:sig.color, fontWeight:700 }}>{sig.icon}</span>}
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:3 }}>
                        <span style={{ fontSize:14, color:isEsaurito?"#a78bfa":C.muted, fontFamily:"monospace" }}>{last != null ? fmtG(last) : "—"}</span>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          {openQty > 0 && <span style={{ fontSize:13, color:C.blue, background:"rgba(59,130,246,.1)", borderRadius:4, padding:"2px 6px" }}>×{openQty}</span>}
                          {!isEsaurito && <span style={{ fontSize:13, color:tColor }}>{trend}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:C.muted2, marginTop:2 }}>
                        {count} prezzi{cat ? ` · ${cat}` : ""}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:"7px 12px", borderTop:`1px solid ${C.border}`, fontSize:11, color:C.muted2, display:"flex", justifyContent:"space-between" }}>
                <span>{itemNames.length} item</span>
                <span>{Object.values(data.items).reduce((a,it)=>a+(it.prices?.length||0),0)} prezzi</span>
              </div>
            </>
          )}
        </div>

        {/* ══ MAIN ══ */}
        <div style={{ flex:1, overflowY:"auto", padding:22 }}>

          {/* ── DASHBOARD ── */}
          {page === "dashboard" && (
            <div className="up">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.muted, letterSpacing:3 }}>PANORAMICA — {todayStr()}</div>
              </div>

              {/* ── CAPITAL OVERVIEW ── */}
              {capitalOverview && (capitalOverview.inStock > 0 || capitalOverview.atMarket > 0 || capitalOverview.realized !== 0) && (
                <StatBar items={[
                    { l:"💰 INVESTITO IN STOCK",   v:fmtG(capitalOverview.inStock),   c:C.blue,  sub:"magazzino totale"           },
                    { l:"🏷️ AL BAZAR",              v:fmtG(capitalOverview.atMarket),  c:C.gold,  sub:"listing attivi"             },
                    { l:"✅ PROFITTO REALIZZATO",   v:fmtG(capitalOverview.realized),  c:capitalOverview.realized>=0?C.green:C.red, sub:"da vendite chiuse" },
                    { l:"📦 ITEM TRACCIATI",        v:capitalOverview.totalItems + " item", c:C.text, sub:"in portafoglio" },
                ]}/>
              )}

              {itemNames.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:320, gap:14 }}>
                  <span style={{ fontSize:56, opacity:.08 }}>⚔️</span>
                  <span style={{ color:C.muted, letterSpacing:3, fontSize:12 }}>NESSUN ITEM ANCORA</span>
                  <button onClick={()=>setPage("new")} style={pill(true)}>＋ AGGIUNGI ITEM</button>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
                  {dashboardCards.map(({ name, ps, ls, lsList, sig, last, prev, trend, tCol, openQty, spent, estProfit, activeQtyL, avgMs, buyT, sellT, trend7 }) => {
                    return (
                      <div key={name} className="dc"
                        onClick={()=>{ setSelItem(name); setPage("item"); setSubPage("prices") }}
                        style={{ background:C.panel, border:`1px solid ${sig.type!=="nodata"?sig.color+"44":C.border}`, borderRadius:12, padding:15, cursor:"pointer", position:"relative" }}>

                        {/* Signal badge */}
                        <div style={{ position:"absolute", top:12, right:12, background:sig.bg, border:`1px solid ${sig.color}55`, borderRadius:6, padding:"4px 9px", fontSize:11, color:sig.color, fontWeight:700, letterSpacing:.5, maxWidth:140, textAlign:"center" }}>
                          <div>{sig.icon} {sig.label}</div>
                          {sig.hint && sig.type !== "nodata" && (
                            <div style={{ fontSize:11, fontWeight:400, letterSpacing:0, marginTop:2, color:sig.color, opacity:.8, lineHeight:1.3, whiteSpace:"normal" }}>{
                              sig.type === "strong_buy" ? "Acquista ora" :
                              sig.type === "buy"        ? "Buon momento" :
                              sig.type === "buy_target" ? "Target raggiunto" :
                              sig.type === "sell_target"? "Vendi ora ★" :
                              sig.type === "sell"       ? "Valuta vendita" :
                              sig.type === "high"       ? "Aspetta" :
                              sig.type === "overpriced" ? "Non comprare" :
                              sig.type === "esaurito"   ? "Non disponibile" :
                              "Monitora"
                            }</div>
                          )}
                        </div>

                        {/* Nome */}
                        <div style={{ fontSize:14, color:C.gold, fontWeight:700, marginBottom:10, paddingRight:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>

                        {last != null ? (
                          <>
                            <div style={{ fontSize:24, color:C.text, fontWeight:700, fontFamily:"monospace" }}>{fmtG(last)}</div>
                            <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:4, flexWrap:"wrap" }}>
                              <span style={{ fontSize:13, color:tCol }}>{trend} {prev!=null ? `${last>=prev?"+":""}${fmtG(last-prev)}` : ""}</span>
                              {sig.diffPct != null && (
                                <span style={{ fontSize:12, color:sig.color, fontWeight:700 }}>
                                  {sig.diffPct>=0?"+":""}{(sig.diffPct*100).toFixed(1)}% vs media
                                </span>
                              )}
                              {trend7 && (
                                <span style={{ fontSize:11, color:trend7.up?C.green:C.red, background:trend7.up?"rgba(74,222,128,.08)":"rgba(251,113,133,.08)", borderRadius:4, padding:"1px 6px" }}>
                                  {trend7.up?"▲":"▼"} {Math.abs(trend7.pct).toFixed(1)}% 7gg
                                </span>
                              )}
                            </div>
                          </>
                        ) : <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Nessun prezzo ancora</div>}

                        {/* Target lines */}
                        {(buyT || sellT) && (
                          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                            {buyT && <span style={{ fontSize:11, color:C.green, background:"rgba(16,185,129,.1)", borderRadius:4, padding:"2px 7px" }}>🟢 Target acq. {fmtG(buyT)}</span>}
                            {sellT && <span style={{ fontSize:11, color:C.blue,  background:"rgba(59,130,246,.1)",  borderRadius:4, padding:"2px 7px" }}>🔵 Target vend. {fmtG(sellT)}</span>}
                          </div>
                        )}

                        {/* Stock / bazar / profitto */}
                        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:3, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                          {openQty > 0 && <div style={{ fontSize:12, color:C.blue }}>📦 {openQty} in magazzino · {fmtG(spent)}</div>}
                          {activeQtyL > 0 && <div style={{ fontSize:12, color:C.gold }}>🏷️ {activeQtyL} al bazar</div>}
                          {estProfit !== null && <div style={{ fontSize:12, color:estProfit>=0?C.green:C.red }}>{estProfit>=0?"▲":"▼"} stimato {fmtG(estProfit)}</div>}
                          {avgMs != null && <div style={{ fontSize:11, color:C.muted }}>⏱ vendita media: {fmtDurationMs(avgMs)}</div>}
                        </div>

                        <div style={{ fontSize:11, color:C.muted2, marginTop:8 }}>{ps.length} prezzi · {ls.length} acquisti · {lsList.length} listing</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ANALISI PAGE ── */}
          {page === "analisi" && (
            <div className="up">
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:16 }}>📊 ANALISI COMPARATIVA — {todayStr()}</div>

              {itemNames.length === 0 ? (
                <div style={{ color:C.muted, textAlign:"center", padding:60, fontSize:14 }}>
                  Aggiungi item e registra prezzi per vedere l'analisi
                </div>
              ) : (<>

              {/* KPI */}
              {(() => {
                const tot = analysisRows.reduce((a, r) => a + (r.totalProfit || 0), 0)
                return (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:C.panel, border:`1px solid ${tot >= 0 ? C.green : C.red}44`, borderRadius:10, padding:"12px 20px" }}>
                      <span style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>GUADAGNO TOTALE</span>
                      <span style={{ fontSize:20, fontWeight:700, fontFamily:"monospace", color:tot >= 0 ? C.green : C.red }}>{tot >= 0 ? "+" : ""}{fmtG(tot)}</span>
                    </div>
                  </div>
                )
              })()}

              {/* Search + signal filters */}
              <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <input value={analSearch} onChange={e => setAnalSearch(e.target.value)} placeholder="Cerca item..."
                  style={inp({ width:200, fontSize:13, padding:"7px 12px" })}/>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {SIGNAL_GROUPS.map(g => {
                    const active = analSignalFilter === g.id
                    const count = g.types ? analysisRows.filter(r => g.types.includes(r.signal.type)).length : analysisRows.length
                    return (
                      <button key={g.id} onClick={() => setAnalSignalFilter(f => f === g.id ? "__all__" : g.id)}
                        style={{ background:active ? g.color + "22" : "transparent", border:`1px solid ${active ? g.color : C.border2}`, borderRadius:6, padding:"4px 10px", fontSize:12, color:active ? g.color : C.muted, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
                        {g.label} <span style={{ opacity:.6, fontWeight:400 }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tabella */}
              <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", overflowX:"auto" }}>
                {/* Header */}
                {(() => {
                  const nameW = analNameW + "px"
                  const cols = [
                    { k:"name",       l:"ITEM",       w:nameW,  title:"Nome dell'item", resizable:true                                         },
                    { k:"signal",     l:"SEGNALE",    w:"130px", title:"Segnale di trading: COMPRA / VENDI / NELLA NORMA basato sulla media"   },
                    { k:"current",    l:"PREZZO",     w:"100px", title:"Ultimo prezzo registrato al bazar"                                     },
                    { k:"diffPct",    l:"vs MEDIA",   w:"80px",  title:"Differenza % tra il prezzo attuale e la media storica"                 },
                    { k:"roiPct",     l:"ROI%",       w:"70px",  title:"Return on Investment: profitto medio % sulle vendite chiuse"           },
                    { k:"totalProfit",l:"PROFITTO",   w:"90px",  title:"Profitto totale realizzato da tutte le vendite chiuse di questo item"   },
                    { k:"trend7",     l:"TREND 7GG",  w:"90px",  title:"Andamento del prezzo negli ultimi 7 giorni (regressione lineare)"      },
                    { k:"vol",        l:"STABILITÀ",  w:"80px",  title:"Stabilità del prezzo: STABILE = poco rischio, INSTABILE = molto rischio" },
                  ]
                  const Th = ({ k, l, w, title, resizable }) => (
                    <div onClick={()=>{ if (!analResizing.current) sortAnalysis(k) }} title={title||l} style={{ width:w, minWidth:w, fontSize:12, color:sortCol===k?C.gold:C.muted, letterSpacing:1, cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:3, position:"relative" }}>
                      {l}{sortCol===k ? (sortDir===1?"▲":"▼") : ""}
                      {resizable && (
                        <div
                          onMouseDown={e => {
                            e.stopPropagation()
                            e.preventDefault()
                            analResizing.current = true
                            const startX = e.clientX
                            const startW = analNameW
                            const onMove = ev => { if (analResizing.current) setAnalNameW(Math.max(100, Math.min(400, startW + ev.clientX - startX))) }
                            const onUp = () => { setTimeout(() => { analResizing.current = false }, 50); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
                            window.addEventListener("mousemove", onMove)
                            window.addEventListener("mouseup", onUp)
                          }}
                          style={{ position:"absolute", right:-2, top:0, bottom:0, width:6, cursor:"col-resize", zIndex:2 }}
                        />
                      )}
                    </div>
                  )

                  return (<>
                    {/* header row */}
                    <div style={{ display:"flex", gap:12, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.inputBg }}>
                      {cols.map(c => <Th key={c.k} {...c}/>)}
                    </div>

                    {/* data rows */}
                    {sortedAnalysis.map((r,i) => {
                      const sig = r.signal
                      return (
                        <div key={r.name} className="r"
                          onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("prices") }}
                          style={{ display:"flex", gap:12, padding:"11px 16px", borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:i%2===0?"transparent":C.inputBg, alignItems:"center" }}>
                          {/* Nome */}
                          <div style={{ width:nameW, minWidth:nameW, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                          {/* Segnale */}
                          <div style={{ width:"130px", minWidth:"130px" }}>
                            <div style={{ background:sig.bg, border:`1px solid ${sig.color}55`, borderRadius:5, padding:"3px 8px", fontSize:11, color:sig.color, fontWeight:700, display:"inline-block" }}>
                              {sig.icon} {sig.label}
                            </div>
                          </div>
                          {/* Prezzo */}
                          <div style={{ width:"100px", minWidth:"100px", fontSize:14, color:C.text, fontFamily:"monospace", fontWeight:700 }}>{r.current!=null?fmtG(r.current):"—"}</div>
                          {/* vs media */}
                          <div style={{ width:"80px", minWidth:"80px", fontSize:13, color:sig.type==="nodata"?C.muted:sig.diffPct!=null?(sig.diffPct<=0?C.green:C.red):C.muted, fontWeight:700, fontFamily:"monospace" }}>
                            {sig.diffPct!=null ? `${sig.diffPct>=0?"+":""}${(sig.diffPct*100).toFixed(1)}%` : "—"}
                          </div>
                          {/* ROI% */}
                          <div style={{ width:"70px", minWidth:"70px", fontSize:13, color:r.roiPct!=null?(r.roiPct>=0?C.green:C.red):C.muted, fontWeight:700, fontFamily:"monospace" }}>
                            {r.roiPct!=null ? `${r.roiPct>=0?"+":""}${r.roiPct.toFixed(1)}%` : "—"}
                          </div>
                          {/* Profitto */}
                          <div style={{ width:"90px", minWidth:"90px", fontSize:13, color:r.totalProfit>0?C.green:r.totalProfit<0?C.red:C.muted, fontWeight:700, fontFamily:"monospace" }}>
                            {r.totalProfit!==0 ? fmtG(r.totalProfit) : "—"}
                          </div>
                          {/* Trend 7gg */}
                          <div style={{ width:"90px", minWidth:"90px", fontSize:13, color:r.trend7?(r.trend7.up?C.green:C.red):C.muted, fontWeight:700, fontFamily:"monospace" }}>
                            {r.trend7 ? `${r.trend7.up?"▲":"▼"} ${Math.abs(r.trend7.pct).toFixed(1)}%` : "—"}
                          </div>
                          {/* Stabilità */}
                          <div style={{ width:"80px", minWidth:"80px", fontSize:12, color:r.vol?(r.vol.cv<10?C.green:r.vol.cv<25?C.gold:C.red):C.muted, fontWeight:700 }}>
                            {r.vol ? (r.vol.cv<10?"STABILE":r.vol.cv<25?"MODERATA":"INSTABILE") : "—"}
                          </div>
                        </div>
                      )
                    })}
                  </>)
                })()}
              </div>

              <div style={{ marginTop:10, fontSize:12, color:C.muted2 }}>
                {sortedAnalysis.length}{sortedAnalysis.length !== analysisRows.length ? ` / ${analysisRows.length}` : ""} item
              </div>
              </>)}
            </div>
          )}

          {/* ── BAZAR PAGE ── */}
          {page === "bazar" && (
            <div className="up">
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:16 }}>🏷️ BAZAR — LISTING ATTIVI</div>

              {bazarOverview.rows.length > 0 && (
                <StatBar items={[
                    { l:"SLOT ATTIVE",     v:bazarOverview.rows.length + "",       c:C.gold  },
                    { l:"COSTO TOTALE SLOT", v:fmtG(bazarOverview.totalCost),      c:C.red },
                    { l:"VALORE AL BAZAR", v:fmtG(bazarOverview.totalValue),       c:C.gold  },
                    { l:"TASSE TOTALI",    v:fmtG(bazarOverview.totalTax),         c:C.red   },
                    { l:"PROFITTO ATTESO", v:fmtG(bazarOverview.totalProfit),      c:bazarOverview.totalProfit>=0?C.green:C.red },
                ]}/>
              )}

              {bazarOverview.rows.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:250, gap:12 }}>
                  <span style={{ fontSize:48, opacity:.08 }}>🏷️</span>
                  <span style={{ color:C.muted, letterSpacing:3, fontSize:12 }}>NESSUN LISTING ATTIVO</span>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {/* header */}
                  <div style={{ display:"flex", alignItems:"center", padding:"6px 14px", gap:10, fontSize:11, color:C.muted, letterSpacing:1 }}>
                    <div style={{ width:150, flexShrink:0 }}>ITEM</div>
                    <div style={{ width:55, flexShrink:0, textAlign:"right" }}>QTÀ</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>PREZZO</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>TOTALE</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>COSTO</div>
                    <div style={{ width:75, flexShrink:0, textAlign:"right" }}>TASSE</div>
                    <div style={{ width:90, flexShrink:0, textAlign:"right" }}>DA</div>
                    <div style={{ flex:1, textAlign:"right" }}>AZIONI</div>
                  </div>
                  <div style={{ maxHeight:500, overflowY:"auto" }}>
                  {bazarOverview.rows.map((r, ri) => {
                    const bKey = `${r.name}|${r.listingIdx}`
                    const isPartial = bazarPartialKey === bKey
                    return (
                      <div key={ri} className="r"
                        style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", gap:10, cursor:"pointer" }}>
                        <div onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("vendite") }}
                          style={{ width:150, flexShrink:0, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                        <div style={{ width:55, flexShrink:0, fontSize:14, color:C.blue, fontWeight:700, fontFamily:"monospace", textAlign:"right" }}>×{r.listing.qty}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:14, color:C.gold, fontWeight:700, fontFamily:"monospace", textAlign:"right" }}>{fmtG(r.listing.listPrice)}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:13, color:C.muted, fontFamily:"monospace", textAlign:"right" }}>{fmtG(r.listing.listPrice * r.listing.qty)}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:13, color:r.listing.buyPrice != null ? C.text : C.muted, fontFamily:"monospace", textAlign:"right" }}>{r.listing.buyPrice != null ? fmtG(r.listing.buyPrice * (r.listing.coveredQty || r.listing.qty)) : "—"}</div>
                        <div style={{ width:75, flexShrink:0, fontSize:12, color:r.listing.tax > 0 ? C.red : C.muted, fontFamily:"monospace", textAlign:"right" }}>{r.listing.tax > 0 ? fmtG(r.listing.tax) : "—"}</div>
                        <div style={{ width:90, flexShrink:0, fontSize:12, fontFamily:"monospace", textAlign:"right", color:r.daysActive>=7?C.red:r.daysActive>=3?C.gold:C.green }}>
                          {fmtAge(r.daysActive * 86400000)}
                        </div>
                        <div style={{ flex:1, display:"flex", justifyContent:"flex-end", alignItems:"center", gap:5 }} onClick={e => e.stopPropagation()}>
                          {isPartial ? (
                            <div style={{ display:"flex", alignItems:"center", gap:6, background:C.inputBg, border:`1px solid ${C.border2}`, borderRadius:8, padding:"5px 10px" }}>
                              <span style={{ fontSize:11, color:C.muted }}>Venduti:</span>
                              <input type="number" min="1" max={r.listing.qty-1} value={bazarPartialQty} onChange={e=>setBazarPartialQty(e.target.value)}
                                onKeyDown={e=>{ if(e.key==="Enter"){ const q=parseInt(bazarPartialQty, 10); if(q>0&&q<r.listing.qty) markBazarListingSold(r.name,r.listingIdx,q) } if(e.key==="Escape"){setBazarPartialKey(null);setBazarPartialQty("")} }}
                                autoFocus style={{ ...inp({ width:60, padding:"4px 8px", fontSize:12, textAlign:"center" }) }}/>
                              <span style={{ fontSize:11, color:C.muted }}>/ {r.listing.qty}</span>
                              {bazarPartialQty && !isNaN(parseInt(bazarPartialQty, 10)) && parseInt(bazarPartialQty, 10) > 0 && parseInt(bazarPartialQty, 10) < r.listing.qty && r.listing.buyPrice != null && (() => {
                                const sq = parseInt(bazarPartialQty, 10)
                                const pTax = r.listing.tax ? Math.round(r.listing.tax * sq / r.listing.qty) : 0
                                const pProfit = (r.listing.listPrice - r.listing.buyPrice) * Math.min(sq, r.listing.coveredQty || 0) - pTax
                                return <span style={{ fontSize:11, color:pProfit>=0?C.green:C.red, fontFamily:"monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                                  {pProfit>=0?"▲":"▼"}{fmtG(Math.abs(pProfit))}
                                </span>
                              })()}
                              <button onClick={()=>{ const q=parseInt(bazarPartialQty, 10); if(q>0&&q<r.listing.qty) markBazarListingSold(r.name,r.listingIdx,q) }}
                                disabled={!bazarPartialQty||isNaN(parseInt(bazarPartialQty, 10))||parseInt(bazarPartialQty, 10)<=0||parseInt(bazarPartialQty, 10)>=r.listing.qty}
                                style={{ ...pill(!!(bazarPartialQty&&!isNaN(parseInt(bazarPartialQty, 10))&&parseInt(bazarPartialQty, 10)>0&&parseInt(bazarPartialQty, 10)<r.listing.qty), C.green, { padding:"4px 8px", fontSize:11 }) }}>CONFERMA</button>
                              <button onClick={()=>{setBazarPartialKey(null);setBazarPartialQty("")}} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:13 }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={()=>markBazarListingSold(r.name,r.listingIdx)} title="Venduto tutto"
                                style={{ ...pill(false, C.green, { padding:"4px 10px", fontSize:11 }) }}>✓ TUTTO</button>
                              {r.listing.qty > 1 && <button onClick={()=>{setBazarPartialKey(bKey);setBazarPartialQty("")}} title="Vendita parziale"
                                style={{ ...pill(false, C.blue, { padding:"4px 8px", fontSize:11 }) }}>½</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>
              )}

              <div style={{ marginTop:10, fontSize:12, color:C.muted2 }}>
                {bazarOverview.rows.length} listing attivi
              </div>

              {/* ── BAZAR ANALYTICS ── */}
              {performanceAnalytics.byItem.length > 0 && (<>

                {/* Sell Time per Item — table + chart */}
                {sellTimeData && (
                    <div style={{ marginTop:20 }}>
                      <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:12 }}>⏱ TEMPO DI VENDITA — BAZAR → VENDUTO</div>
                      <div style={{ display:"flex", gap:16 }}>
                        {/* Table left */}
                        <div style={{ flex:"0 0 280px", display:"flex", flexDirection:"column", gap:3 }}>
                          <div style={{ display:"flex", padding:"4px 10px", fontSize:11, color:C.muted, letterSpacing:1 }}>
                            <div style={{ flex:1 }}>ITEM</div>
                            <div style={{ width:120, textAlign:"right" }}>DURATA</div>
                          </div>
                          <div style={{ maxHeight:500, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                          {sellTimeData.rows.map(r => {
                            const col = r.days >= 7 ? C.red : r.days >= 3 ? C.gold : C.green
                            return (
                              <div key={r.name} className="r" style={{ display:"flex", alignItems:"center", padding:"7px 10px", background:C.panel, border:`1px solid ${C.border}`, borderRadius:7 }}>
                                <div style={{ flex:1, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                                <div style={{ width:120, textAlign:"right", fontSize:13, fontFamily:"monospace", fontWeight:700, color:col }}>{fmtAge(r.ms)}</div>
                              </div>
                            )
                          })}
                          </div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:4, textAlign:"right", paddingRight:10 }}>
                            Media: <b style={{ color:C.gold }}>{fmtAge(sellTimeData.avgDays * 86400000)}</b>
                          </div>
                        </div>
                        {/* Chart right */}
                        <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:14, minHeight:300, maxHeight:600, overflowY:"auto" }}>
                          <ResponsiveContainer width="100%" height={Math.max(400, Math.min(sellTimeData.rows.length * 45, 560))}>
                            <BarChart data={sellTimeData.chartData} margin={{ left:10, right:20, top:5, bottom:5 }}>
                              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                              <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:10 }} interval={0} angle={-30} textAnchor="end" height={55}/>
                              <YAxis stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }} label={{ value:"giorni", angle:-90, position:"insideLeft", fill:C.muted, fontSize:11 }}/>
                              <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={(v) => [v + "g", "Durata"]} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                              <Bar dataKey="giorni" fill="#60a5fa" radius={[4,4,0,0]} name="Durata"/>
                              <ReferenceLine y={Math.round(sellTimeData.avgDays * 10) / 10} stroke={C.red} strokeWidth={2} strokeDasharray="6 3" label={{ value:`Media: ${(Math.round(sellTimeData.avgDays * 10) / 10)}g`, fill:C.red, fontSize:11, position:"insideTopRight" }}/>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                )}

              </>)}
            </div>
          )}

          {/* ── MAGAZZINO PAGE ── */}
          {page === "magazzino" && (
            <div className="up">
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:16 }}>📦 MAGAZZINO — STOCK GLOBALE</div>

              {/* stat bar */}
              {magazzinoOverview.rows.length > 0 && (
                <StatBar items={[
                    { l:"ITEM IN STOCK",     v:magazzinoOverview.itemCount + " item / " + magazzinoOverview.rows.length + " slot", c:C.blue },
                    { l:"INVESTITO",         v:fmtG(magazzinoOverview.totalSpent),             c:C.red   },
                    { l:"VALORE STIMATO",    v:fmtG(magazzinoOverview.totalEstValue),          c:C.gold  },
                    { l:"PROFITTO STIMATO",  v:fmtG(magazzinoOverview.totalEstProfit),         c:magazzinoOverview.totalEstProfit>=0?C.green:C.red },
                ]}/>
              )}

              {magazzinoOverview.rows.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:250, gap:12 }}>
                  <span style={{ fontSize:48, opacity:.08 }}>📦</span>
                  <span style={{ color:C.muted, letterSpacing:3, fontSize:12 }}>NESSUN ITEM IN MAGAZZINO</span>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {/* header */}
                  <div style={{ display:"flex", alignItems:"center", padding:"6px 14px", gap:10, fontSize:11, color:C.muted, letterSpacing:1 }}>
                    <div style={{ width:150, flexShrink:0 }}>ITEM</div>
                    <div style={{ width:55, flexShrink:0, textAlign:"right" }}>QTÀ</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>PREZZO ACQ.</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>COSTO SLOT</div>
                    <div style={{ width:85, flexShrink:0, textAlign:"right" }}>ATTUALE</div>
                    <div style={{ width:95, flexShrink:0, textAlign:"right" }}>PROFITTO ST.</div>
                    <div style={{ width:75, flexShrink:0, textAlign:"right" }}>ETÀ</div>
                    <div style={{ flex:1, textAlign:"right" }}>DATA</div>
                  </div>
                  {[...magazzinoOverview.rows].sort((a,b) => b.ageDays - a.ageDays).map((r, ri) => {
                    const ageColor = r.ageDays >= 7 ? C.red : r.ageDays >= 3 ? C.gold : C.green
                    const ageLabel = fmtAge(r.ageDays * 86400000)
                    return (
                      <div key={ri} className="r"
                        onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("magazzino") }}
                        style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", gap:10, cursor:"pointer" }}>
                        <div style={{ width:150, flexShrink:0, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                        <div style={{ width:55, flexShrink:0, fontSize:14, color:C.blue, fontWeight:700, fontFamily:"monospace", textAlign:"right" }}>×{r.qty}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:13, color:C.text, fontFamily:"monospace", textAlign:"right" }}>{fmtG(r.price)}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:13, color:C.red, fontFamily:"monospace", textAlign:"right" }}>{fmtG(r.lotCost)}</div>
                        <div style={{ width:85, flexShrink:0, fontSize:13, fontFamily:"monospace", textAlign:"right", color:C.muted }}>{r.currentPrice != null ? fmtG(r.currentPrice) : "—"}</div>
                        <div style={{ width:95, flexShrink:0, fontSize:13, fontWeight:700, fontFamily:"monospace", textAlign:"right", color:r.estProfit!=null?(r.estProfit>=0?C.green:C.red):C.muted }}>
                          {r.estProfit != null ? `${r.estProfit>=0?"▲":"▼"} ${fmtG(Math.abs(r.estProfit))}` : "—"}
                        </div>
                        <div style={{ width:75, flexShrink:0, fontSize:13, fontWeight:700, textAlign:"right", color:ageColor }}>
                          {ageLabel}
                        </div>
                        <div style={{ flex:1, fontSize:11, color:C.muted, textAlign:"right" }}>
                          {fmtFull(r.lot.timestamp)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ marginTop:10, fontSize:12, color:C.muted2 }}>
                {magazzinoOverview.rows.length} slot · {magazzinoOverview.itemCount} item in magazzino
              </div>

              {/* ── ANALYTICS SECTION ── */}
              {performanceAnalytics.byItem.length > 0 && (<>

                {/* Capital Distribution */}
                {performanceAnalytics.capitalChart.length > 0 && (
                  <div style={{ marginTop:24 }}>
                    <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:12 }}>💰 CAPITALE BLOCCATO PER ITEM</div>
                    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:16, maxHeight:600, overflowY:"auto" }}>
                      <ResponsiveContainer width="100%" height={Math.max(400, Math.min(performanceAnalytics.capitalChart.length * 45, 560))}>
                        <BarChart data={performanceAnalytics.capitalChart} margin={{ left:10, right:20, top:5, bottom:5 }}>
                          <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                          <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:11 }} interval={0} angle={-35} textAnchor="end" height={60}/>
                          <YAxis tickFormatter={fmtG} stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }}/>
                          <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={v => fmtG(v)} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                          <Bar dataKey="magazzino" stackId="cap" fill="#60a5fa" name="Magazzino" radius={[0,0,0,0]}/>
                          <Bar dataKey="bazar" stackId="cap" fill={C.gold} name="Bazar" radius={[4,4,0,0]}/>
                          <Legend formatter={v => <span style={{ color:C.muted, fontSize:11 }}>{v}</span>}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Staging Time per Item — oldest open lot age */}
                {stagingTimeData && (
                    <div style={{ marginTop:20 }}>
                      <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:12 }}>⏱ TEMPO IN MAGAZZINO — DA QUANTO TEMPO STAI TENENDO STOCK</div>
                      <div style={{ display:"flex", gap:16 }}>
                        {/* Table left */}
                        <div style={{ flex:"0 0 280px", display:"flex", flexDirection:"column", gap:3 }}>
                          <div style={{ display:"flex", padding:"4px 10px", fontSize:11, color:C.muted, letterSpacing:1 }}>
                            <div style={{ flex:1 }}>ITEM</div>
                            <div style={{ width:120, textAlign:"right" }}>TEMPO</div>
                          </div>
                          {stagingTimeData.rows.map(r => {
                            const col = r.ageDays >= 7 ? C.red : r.ageDays >= 3 ? C.gold : C.green
                            return (
                              <div key={r.name} className="r" style={{ display:"flex", alignItems:"center", padding:"7px 10px", background:C.panel, border:`1px solid ${C.border}`, borderRadius:7 }}>
                                <div style={{ flex:1, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                                <div style={{ width:120, textAlign:"right", fontSize:13, fontFamily:"monospace", fontWeight:700, color:col }}>{fmtAge(r.ageMs)}</div>
                              </div>
                            )
                          })}
                          <div style={{ fontSize:11, color:C.muted, marginTop:4, textAlign:"right", paddingRight:10 }}>
                            Media globale: <b style={{ color:C.gold }}>{fmtAge(stagingTimeData.globalAvg * 86400000)}</b>
                          </div>
                        </div>
                        {/* Chart right */}
                        <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:14, minHeight:300, maxHeight:600, overflowY:"auto" }}>
                          <ResponsiveContainer width="100%" height={Math.max(400, Math.min(stagingTimeData.rows.length * 45, 560))}>
                            <BarChart data={stagingTimeData.chartData} margin={{ left:10, right:20, top:5, bottom:5 }}>
                              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                              <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:10 }} interval={0} angle={-30} textAnchor="end" height={55}/>
                              <YAxis stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }} label={{ value:"giorni", angle:-90, position:"insideLeft", fill:C.muted, fontSize:11 }}/>
                              <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={(v, name) => [v + "g", name === "media" ? "Media item" : "Max lotto"]} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                              <Bar dataKey="giorni" fill="#60a5fa" radius={[4,4,0,0]} name="Max lotto"/>
                              <Bar dataKey="media" fill={C.gold} radius={[4,4,0,0]} name="Media item"/>
                              <Legend formatter={v => <span style={{ color:C.muted, fontSize:11 }}>{v}</span>}/>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                )}


              </>)}
            </div>
          )}

          {/* ── NOS DOLLARI PAGE ── */}
          {page === "nd" && (
            <div className="up">
              <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" fill="#a855f7" stroke="#c084fc" strokeWidth="1.5"/>
                  <text x="10" y="14.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" fontFamily="monospace">$</text>
                </svg>
                NOS DOLLARI
              </div>

              {/* Rate + Calculator */}
              <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
                {/* ND Rate */}
                <div style={{ flex:"1 1 200px", background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:6 }}>TASSO ND (oro per 1 ND)</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input value={ndRateInput} onChange={e => setNdRateInput(e.target.value)} onBlur={e => {
                      const v = parseG(e.target.value)
                      if (!isNaN(v) && v >= 0) upd({ ...data, ndRate: Math.round(v) })
                    }} onKeyDown={e => { if(e.key==="Enter") e.target.blur() }}
                    placeholder="es. 5k" style={inp({ fontSize:15, color:C.gold, fontWeight:700, width:140 })}/>
                    <span style={{ fontSize:13, color:C.muted }}>oro / ND</span>
                  </div>
                  {data?.ndRate > 0 && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{fmtG(data.ndRate)} per ND</div>}
                </div>

                {/* ND Calculator */}
                <div style={{ flex:"1 1 250px", background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:6 }}>CALCOLATORE ND</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input type="number" value={ndBuyQty} onChange={e=>setNdBuyQty(e.target.value)} placeholder="es. 500" style={inp({ fontSize:15, width:110 })}/>
                    <span style={{ fontSize:13, color:C.muted }}>ND =</span>
                    <span style={{ fontSize:18, color:C.gold, fontWeight:700, fontFamily:"monospace" }}>
                      {ndBuyQty && !isNaN(parseInt(ndBuyQty, 10)) && data?.ndRate ? fmtG(parseInt(ndBuyQty, 10) * data.ndRate) : "—"}
                    </span>
                  </div>
                </div>

                {/* Event discount selector */}
                <div style={{ flex:"0 0 200px", background:C.panel, border:`1px solid ${globalNdDisc>0?"#f59e0b":C.border}`, borderRadius:10, padding:"14px 16px", transition:"all .15s" }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:6 }}>SCONTO EVENTO</div>
                  <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                    {allNdDiscounts.map(d => (
                      <button key={d} onClick={()=>{ setGlobalNdDisc(d); upd({ ...data, globalNdDisc: d }) }}
                        style={{ padding:"3px 8px", fontSize:11, fontWeight:700, borderRadius:4, cursor:"pointer", border:`1px solid ${globalNdDisc===d?(d>0?"#f59e0b":C.border):C.border}`, background:globalNdDisc===d?(d>0?"rgba(245,158,11,.18)":`${C.text}0d`):"transparent", color:globalNdDisc===d?(d>0?"#f59e0b":C.text):C.muted }}>
                        {d === 0 ? "OFF" : `-${d}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ND Items Table */}
              {ndItems.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12 }}>
                  <span style={{ fontSize:48, opacity:.08 }}>💎</span>
                  <span style={{ color:C.muted, letterSpacing:3, fontSize:12 }}>NESSUN ITEM "ITEM SHOP ND"</span>
                  <span style={{ color:C.muted, fontSize:11 }}>Crea un item e assegna la categoria "Item Shop ND"</span>
                </div>
              ) : (<>
                {/* summary */}
                {data?.ndRate > 0 && (
                  <StatBar mb={14} items={[
                      { l:"ITEM ND",          v:ndItems.length + "",                                    c:C.text  },
                      { l:"PROFITTEVOLI",     v:ndItems.profitable + "",                               c:C.green },
                      { l:"IN PERDITA",       v:ndItems.losing + "",                                   c:C.red   },
                      { l:"MIGLIOR PROFITTO", v:ndItems.bestProfit != null ? fmtG(ndItems.bestProfit) : "—", c:C.green },
                  ]}/>
                )}

                {/* header */}
                <div style={{ display:"flex", alignItems:"center", padding:"6px 14px", gap:6, fontSize:11, color:C.muted, letterSpacing:1 }}>
                  <div style={{ width:160, flexShrink:0 }}>ITEM</div>
                  <div style={{ width:80, flexShrink:0, textAlign:"right" }}>ND{globalNdDisc > 0 ? ` (-${globalNdDisc}%)` : ""}</div>
                  <div style={{ width:55, flexShrink:0, textAlign:"right" }}>PZ</div>
                  <div style={{ width:100, flexShrink:0, textAlign:"right" }}>MERCATO</div>
                  <div style={{ width:100, flexShrink:0, textAlign:"right" }}>COSTO ORO</div>
                  <div style={{ width:100, flexShrink:0, textAlign:"right" }}>RICAVO</div>
                  <div style={{ width:100, flexShrink:0, textAlign:"right" }}>PROFITTO</div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {[...ndItems].sort((a,b) => (b.profit||0) - (a.profit||0)).map(r => (
                    <div key={r.name} className="r"
                      onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("prices") }}
                      style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", gap:6, cursor:"pointer" }}>
                      <div style={{ width:160, flexShrink:0, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                      <div style={{ width:80, flexShrink:0, fontSize:14, color:r.disc>0?"#f59e0b":C.text, fontWeight:700, fontFamily:"monospace", textAlign:"right" }}>
                        {r.useCost > 0 ? r.useCost : "—"}
                        {r.disc > 0 && r.useCost !== r.ndCost && <span style={{ fontSize:9, color:C.muted, display:"block", textDecoration:"line-through" }}>{r.ndCost}</span>}
                      </div>
                      <div style={{ width:55, flexShrink:0, fontSize:14, color:C.blue, fontWeight:700, fontFamily:"monospace", textAlign:"right" }}>×{r.ndQty}</div>
                      <div style={{ width:100, flexShrink:0, fontSize:13, color:r.marketPrice!=null?C.text:C.muted, fontFamily:"monospace", textAlign:"right" }}>{r.marketPrice!=null?fmtG(r.marketPrice):"—"}</div>
                      <div style={{ width:100, flexShrink:0, fontSize:13, color:r.costGold>0?C.red:C.muted, fontFamily:"monospace", textAlign:"right" }}>{r.costGold>0?fmtG(r.costGold):"—"}</div>
                      <div style={{ width:100, flexShrink:0, fontSize:13, color:r.revenue!=null?C.green:C.muted, fontFamily:"monospace", textAlign:"right" }}>{r.revenue!=null?fmtG(r.revenue):"—"}</div>
                      <div style={{ width:100, flexShrink:0, fontSize:14, fontWeight:700, fontFamily:"monospace", textAlign:"right", color:r.profit!=null?(r.profit>=0?C.green:C.red):C.muted }}>
                        {r.profit!=null ? `${r.profit>=0?"▲":"▼"} ${fmtG(Math.abs(r.profit))}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* inline edit section */}
                <div style={{ marginTop:18, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:10 }}>CONFIGURA ITEM ND</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {ndItems.map(r => {
                      const it = data.items[r.name]
                      return (
                        <div key={r.name} style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ width:150, fontSize:13, color:C.gold, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{r.name}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <span style={{ fontSize:11, color:C.muted }}>ND:</span>
                            <input type="number" min="0" step="1" defaultValue={it.meta?.ndCost || ""} onBlur={e => {
                              const v = parseInt(e.target.value, 10) || 0
                              const updated = { ...it, meta: { ...it.meta, ndCost: v } }
                              upd({ ...data, items: { ...data.items, [r.name]: updated } })
                            }} onKeyDown={e => { if(e.key==="Enter") e.target.blur() }} placeholder="0" style={inp({ width:70, padding:"4px 8px", fontSize:12, textAlign:"center" })}/>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <span style={{ fontSize:11, color:C.muted }}>PZ:</span>
                            <input type="number" min="1" step="1" defaultValue={it.meta?.ndQty || ""} onBlur={e => {
                              const v = parseInt(e.target.value, 10) || 1
                              const updated = { ...it, meta: { ...it.meta, ndQty: v } }
                              upd({ ...data, items: { ...data.items, [r.name]: updated } })
                            }} onKeyDown={e => { if(e.key==="Enter") e.target.blur() }} placeholder="1" style={inp({ width:60, padding:"4px 8px", fontSize:12, textAlign:"center" })}/>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <span style={{ fontSize:11, color:"#f59e0b" }}>sconto:</span>
                            <select value={it.meta?.ndDiscount || 0} onChange={e => {
                              const v = parseInt(e.target.value, 10)
                              const updated = { ...it, meta: { ...it.meta, ndDiscount: v } }
                              upd({ ...data, items: { ...data.items, [r.name]: updated } })
                            }} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:4, color:(it.meta?.ndDiscount||0)>0?"#f59e0b":C.muted, padding:"4px 6px", fontSize:11, cursor:"pointer" }}>
                              {allNdDiscounts.map(d => <option key={d} value={d}>{d===0?"—":`-${d}%`}</option>)}
                            </select>
                            {(it.meta?.ndDiscount||0) > 0 && it.meta?.ndCost > 0 && (
                              <span style={{ fontSize:11, color:"#f59e0b", fontFamily:"monospace" }}>= {Math.ceil(it.meta.ndCost * (1 - (it.meta.ndDiscount)/100))} ND</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>)}
            </div>
          )}

          {/* ── ITEM VIEW ── */}
          {page === "item" && selItem && (
            <div className="up" style={{ maxWidth:960 }}>

              {/* header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <button onClick={()=>setPage("dashboard")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18, padding:0 }}>←</button>
                  <div>
                    {renaming ? (
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e=>setRenameVal(e.target.value)}
                          onKeyDown={e=>{ if(e.key==="Enter") renameItem(selItem, renameVal); if(e.key==="Escape"){ setRenaming(false); setRenameVal("") } }}
                          style={{ ...inp({ fontSize:15, color:C.gold, width:260, padding:"5px 10px" }) }}
                        />
                        <button onClick={()=>renameItem(selItem, renameVal)} style={{ ...pill(true, C.gold, { padding:"5px 12px", fontSize:11 }) }}>OK</button>
                        <button onClick={()=>{ setRenaming(false); setRenameVal("") }} style={{ ...pill(false, C.muted, { padding:"5px 10px", fontSize:11 }) }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <h2 style={{ margin:0, fontSize:17, color:C.gold, letterSpacing:2 }}>{selItem}</h2>
                        <button
                          title="Rinomina item"
                          onClick={()=>{ setRenameVal(selItem); setRenaming(true) }}
                          style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:5, color:C.muted, cursor:"pointer", fontSize:11, padding:"2px 7px", lineHeight:1 }}>✏️</button>
                        <button
                          title="Copia nome"
                          onClick={()=>copyName(selItem)}
                          style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:5, color:copyFlash?C.green:C.muted, cursor:"pointer", fontSize:11, padding:"2px 7px", lineHeight:1, transition:"color .2s" }}>{copyFlash?"✓":"⎘"}</button>
                      </div>
                    )}
                    <div style={{ fontSize:12, color:C.muted, marginTop:2, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span>{prices.length} prezzi · {lots.length} lotti</span>
                      <select
                        value={item?.meta?.category || "—"}
                        onChange={e => {
                          const cat = e.target.value === "—" ? undefined : e.target.value
                          const it = { ...data.items[selItem], meta: { ...data.items[selItem].meta, category: cat } }
                          upd({ ...data, items: { ...data.items, [selItem]: it } })
                        }}
                        style={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:5, color:C.muted, padding:"2px 6px", fontSize:11, cursor:"pointer" }}>
                        {allCategories.map(c => <option key={c} value={c}>{c === "—" ? "Nessuna categoria" : c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[
                    { k:"prices",    l:"📈 Prezzi"    },
                    { k:"magazzino", l:"📦 Magazzino" },
                    { k:"vendite",   l:"🏷️ In Vendita" },
                    { k:"charts",    l:"📊 Grafici"   },
                  ].map(({ k, l }) => (
                    <button key={k} onClick={()=>setSubPage(k)} style={pill(subPage===k, C.gold, { padding:"7px 13px", fontSize:11 })}>{l}</button>
                  ))}
                  <button onClick={exportCSV} style={pill(false,"#06b6d4",{ padding:"7px 11px", fontSize:11 })}>⬇ CSV</button>
                  <button onClick={()=>delItem(selItem)} style={pill(false,C.red,{ padding:"7px 11px", fontSize:11 })}>🗑</button>
                </div>
              </div>

              {/* ── SIGNAL + TARGET BAR ── */}
              {(() => {
                const sig  = signalCache[selItem] || getSignal(item, data?.signalConfig)
                const buyT  = item?.meta?.buyTarget
                const sellT = item?.meta?.sellTarget
                const diffEv = allStats?.avgEvent && allStats?.avgNormal
                  ? (allStats.avgEvent - allStats.avgNormal) / allStats.avgNormal * 100
                  : null
                return (
                  <div style={{ display:"flex", gap:10, alignItems:"stretch", marginBottom:14, flexWrap:"wrap" }}>
                    {/* Segnale attuale */}
                    <div title={sig.hint || ""} style={{ background:sig.bg, border:`1px solid ${sig.color}66`, borderRadius:10, padding:"14px 20px", display:"flex", alignItems:"center", gap:14, minWidth:220, cursor:sig.hint?"help":"default" }}>
                      <span style={{ fontSize:32 }}>{sig.icon}</span>
                      <div>
                        <div style={{ fontSize:12, color:sig.color, letterSpacing:2, fontWeight:700 }}>SEGNALE</div>
                        <div style={{ fontSize:22, color:sig.color, fontWeight:700, marginTop:2 }}>{sig.label}</div>
                        {sig.diffPct != null && (
                          <div style={{ fontSize:13, color:sig.color, opacity:.8, marginTop:4, fontFamily:"monospace" }}>
                            {sig.diffPct>=0?"+":""}{(sig.diffPct*100).toFixed(1)}% vs media
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Diff evento */}
                    {diffEv != null && (
                      <div title={diffEv<=0 ? "Prezzi calano durante eventi" : "Prezzi salgono durante eventi"} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", minWidth:160, cursor:"help" }}>
                        <div style={{ fontSize:12, color:C.muted, letterSpacing:2, marginBottom:4 }}>EVENTI</div>
                        <div style={{ fontSize:20, color:diffEv<=0?C.green:C.red, fontWeight:700, fontFamily:"monospace" }}>
                          {diffEv>=0?"+":""}{diffEv.toFixed(1)}%
                        </div>
                      </div>
                    )}

                    {/* KPI acquisto / vendita */}
                    {(() => {
                      const ls = listings || []
                      const soldWithBuy = ls.filter(l => l.sold && l.buyPrice != null)
                      const avgBuy  = soldWithBuy.length ? soldWithBuy.reduce((a,l) => a + l.buyPrice, 0) / soldWithBuy.length : null
                      const avgSell = soldWithBuy.length ? soldWithBuy.reduce((a,l) => a + l.listPrice, 0) / soldWithBuy.length : null
                      const marginPct = avgBuy && avgSell ? ((avgSell - avgBuy) / avgBuy) * 100 : null
                      return (
                        <div style={{ display:"flex", gap:8, flex:1, minWidth:200 }}>
                          <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
                            <div style={{ fontSize:11, color:C.muted, letterSpacing:1.5, marginBottom:4 }}>MEDIA ACQUISTO</div>
                            <div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color:avgBuy != null ? C.red : C.muted }}>{avgBuy != null ? fmtG(Math.round(avgBuy)) : "—"}</div>
                          </div>
                          <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
                            <div style={{ fontSize:11, color:C.muted, letterSpacing:1.5, marginBottom:4 }}>MEDIA VENDITA</div>
                            <div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color:avgSell != null ? C.green : C.muted }}>{avgSell != null ? fmtG(Math.round(avgSell)) : "—"}</div>
                          </div>
                          <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
                            <div style={{ fontSize:11, color:C.muted, letterSpacing:1.5, marginBottom:4 }}>MARGINE %</div>
                            <div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color:marginPct != null ? (marginPct >= 0 ? C.green : C.red) : C.muted }}>{marginPct != null ? `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}%` : "—"}</div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* ── STATS BAR ── */}
              {allStats && (() => {
                const trend7 = calcTrend(prices, trendDays)
                const vol    = calcVolatility(prices)
                const primary = [
                  { l: allStats.isEsaurito ? "ULTIMO PREZZO NOTO" : "PREZZO ATTUALE", v:fmtG(allStats.current), c:allStats.isEsaurito?"#a78bfa":C.gold, big:true },
                  { l:"MEDIA STORICA",  v:fmtG(allStats.avg), c:C.text },
                  { l:"MINIMO STORICO", v:fmtG(allStats.min), c:C.green },
                  { l:"MASSIMO STORICO",v:fmtG(allStats.max), c:C.red  },
                ]
                const secondary = [
                  { l:"MEDIA SENZA EVENTI", v:fmtG(allStats.avgNormal), c:C.muted, sub:"giorni normali" },
                  { l:"MEDIA CON EVENTI",   v:fmtG(allStats.avgEvent),  c:C.muted,
                    sub: allStats.avgEvent && allStats.avgNormal
                      ? (allStats.avgEvent > allStats.avgNormal ? "▲ sale con eventi" : "▼ scende con eventi")
                      : "nessun evento registrato" },
                  allStats.esauritoCount > 0
                    ? { l:"ESAURITO",   v:allStats.esauritoCount+"×",  c:"#a78bfa", sub:"volte segnalato" }
                    : null,
                  trend7
                    ? { l:`TREND ${trend7.days}GG`, v:`${trend7.pct>=0?"+":""}${trend7.pct.toFixed(1)}%`, c:trend7.up?C.green:C.red,
                        sub: `${trend7.up ? "sta salendo" : "sta scendendo"} · R²=${trend7.r2.toFixed(2)}`,
                        title:`Regressione lineare degli ultimi 7 giorni — R²=${trend7.r2.toFixed(2)} (1.00 = trend perfetto)` }
                    : null,
                  vol
                    ? { l:"STABILITÀ PREZZO", v:vol.cv < 10 ? "STABILE" : vol.cv < 25 ? "MODERATA" : "INSTABILE", c:vol.cv<10?C.green:vol.cv<25?C.gold:C.red,
                        sub:`variazione ±${vol.cv.toFixed(0)}%`,
                        title:"Coefficiente di variazione: misura quanto oscilla il prezzo" }
                    : null,
                ].filter(Boolean)
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                    {/* Riga primaria — dati chiave */}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {primary.map(s => (
                        <div key={s.l} style={{ background:C.panel, border:`1px solid ${s.big?s.c+"44":C.border}`, borderRadius:9, padding:"10px 14px", flex: s.big ? "1 1 120px" : "1 1 80px" }}>
                          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>{s.l}</div>
                          <div style={{ fontSize:s.big?22:17, color:s.c, fontWeight:700, marginTop:3, fontFamily:"monospace" }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Riga secondaria — dati contestuali */}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {secondary.map(s => (
                        <div key={s.l} title={s.title || ""} style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 11px", flex:"1 1 70px", cursor:s.title?"help":"default" }}>
                          <div style={{ fontSize:11, color:C.muted2, letterSpacing:1.5 }}>{s.l}</div>
                          <div style={{ fontSize:14, color:s.c, fontWeight:700, marginTop:2, fontFamily:"monospace" }}>{s.v}</div>
                          {s.sub && <div style={{ fontSize:11, color:C.muted2, marginTop:1 }}>{s.sub}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* ══════════════ PRICES TAB ══════════════ */}
              {subPage === "prices" && (
                <div>
                  {/* input */}
                  <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:11, padding:18, marginBottom:14 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
                      <div style={{ flex:"0 0 160px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>PREZZO</div>
                        <input
                          value={pVal} onChange={e=>setPVal(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&recordPrice()}
                          placeholder="150000 oppure 150k"
                          style={inp({ fontSize:19, color:C.gold })}
                        />
                        {pVal && !isNaN(parseG(pVal)) && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>= {parseG(pVal).toLocaleString("it-IT")} ori · {fmtG(parseG(pVal))}</div>
                        )}
                      </div>
                      <button onClick={recordPrice} disabled={!pVal||isNaN(parseG(pVal))} style={{ ...pill(!!(pVal&&!isNaN(parseG(pVal)))), padding:"8px 22px", flexShrink:0 }}>
                        SALVA
                      </button>
                      <button onClick={recordEsaurito}
                        title="Segna che al momento non ci sono item disponibili al bazar"
                        style={{ ...pill(false,"#a78bfa",{ padding:"8px 14px", flexShrink:0 }) }}>
                        📭 ESAURITO AL BZ
                      </button>
                    </div>

                    {/* Banner esaurito attivo */}
                    {allStats?.isEsaurito && (
                      <div style={{ marginTop:12, background:"rgba(167,139,250,.1)", border:"1px solid #a78bfa55", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>📭</span>
                        <div>
                          <div style={{ fontSize:13, color:"#a78bfa", fontWeight:700 }}>ESAURITO AL BAZAR</div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Nessun item disponibile al momento · Ultimo prezzo noto: <b style={{color:C.text}}>{fmtG(allStats.current)}</b></div>
                        </div>
                        <div style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>
                          Esaurito {allStats.esauritoCount}× in storico
                        </div>
                      </div>
                    )}
                  </div>

                  {/* price history */}
                  <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:420, overflowY:"auto" }}>
                    {prices.length === 0 && <div style={{ color:C.muted, textAlign:"center", padding:36, fontSize:12 }}>Nessun prezzo registrato ancora</div>}
                    {[...prices].reverse().map((p, ri) => {
                      const stableKey = p.timestamp || ri
                      const realIdx = prices.length - 1 - ri
                      const ev      = allEVT[p.eventId] || EVT.none
                      // Trova il prezzo reale precedente (esclude esaurito)
                      const prevReal = prices.slice(0, realIdx).reverse().find(x => !x.esaurito)
                      const delta    = (!p.esaurito && prevReal) ? p.price - prevReal.price : null

                      // Voce ESAURITO
                      if (p.esaurito) return (
                        <div key={stableKey} className="r" style={{ display:"flex", alignItems:"center", background:"rgba(167,139,250,.06)", border:"1px solid #a78bfa33", borderRadius:6, padding:"7px 12px", gap:10 }}>
                          <span style={{ fontSize:12, color:C.muted, minWidth:118, flexShrink:0 }}>{fmtFull(p.timestamp)}</span>
                          <span style={{ fontSize:13, color:"#a78bfa", fontWeight:700 }}>📭 ESAURITO AL BAZAR</span>
                          {ev.id !== "none" && <span style={{ fontSize:11, color:ev.color }}>{ev.icon} {ev.label}</span>}
                          <span style={{ flex:1 }}/>
                          <button onClick={()=>delPrice(realIdx)} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:13 }}>✕</button>
                        </div>
                      )

                      return (
                        <div key={stableKey} className="r" style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 12px", gap:10 }}>
                          <span style={{ fontSize:12, color:C.muted, minWidth:118, flexShrink:0 }}>{fmtFull(p.timestamp)}</span>
                          <span style={{ fontSize:16, color:C.gold, fontWeight:700, fontFamily:"monospace", minWidth:90, flexShrink:0 }}>{fmtG(p.price)}</span>
                          <span style={{ fontSize:12, color:C.muted, minWidth:80, fontFamily:"monospace", flexShrink:0 }}>{p.price.toLocaleString("it-IT")}</span>
                          {delta !== null && <span style={{ fontSize:12, color:delta>=0?C.green:C.red, minWidth:70, flexShrink:0 }}>{delta>=0?"+":""}{fmtG(delta)}</span>}
                          {ev.id !== "none" && <span style={{ fontSize:12, color:ev.color, flexShrink:0 }}>{ev.icon} {ev.label}</span>}
                          <span style={{ fontSize:12, color:"#7b8ba6", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.note}</span>
                          <button onClick={()=>delPrice(realIdx)} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:13, flexShrink:0 }}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ══════════════ MAGAZZINO TAB ══════════════ */}
              {subPage === "magazzino" && (
                <div>
                  {/* lot stats */}
                  {lotStats && (
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                      {[
                        { l:"QTÀ IN STOCK",       v:lotStats.totalQty + " pz",         c:C.blue  },
                        { l:"TOTALE SPESO",        v:fmtG(lotStats.totalSpent),          c:C.red   },
                        { l:"PREZZO MEDIO ACQ.",   v:fmtG(lotStats.avgBuy),             c:C.text  },
                        { l:"PREZZO ATTUALE",      v:fmtG(lotStats.currentPrice),        c:C.gold  },
                        { l:"VALORE STIMATO",      v:fmtG(lotStats.estimatedValue),      c:C.text  },
                        { l:"PROFITTO STIMATO",    v:fmtG(lotStats.estimatedProfit),     c:lotStats.estimatedProfit>=0?C.green:C.red },
                      ].map(s => (
                        <div key={s.l} title={s.title||""} style={{ background:C.panel, border:`1px solid ${s.l==="VENDI ALMENO A"?C.gold+"44":C.border}`, borderRadius:9, padding:"9px 13px", flex:"1 1 90px", cursor:s.title?"help":"default" }}>
                          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>{s.l}</div>
                          <div style={{ fontSize:16, color:s.c, fontWeight:700, marginTop:3, fontFamily:"monospace" }}>{s.v}</div>
                          {s.sub && <div style={{ fontSize:11, color:C.muted2, marginTop:2 }}>{s.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* lot input */}
                  <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:11, padding:18, marginBottom:14 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
                      <div style={{ flex:"0 0 100px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>QUANTITÀ (max 999)</div>
                        <input type="number" min="1" max="999" value={lQty} onChange={e=>setLQty(e.target.value)} placeholder="50" style={inp()}/>
                      </div>
                      <div style={{ flex:"0 0 160px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>PREZZO UNITARIO</div>
                        <input value={lPrice} onChange={e=>setLPrice(e.target.value)} placeholder="50000 o 50k" style={inp({ color:C.blue })}/>
                        {lPrice && !isNaN(parseG(lPrice)) && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{fmtG(parseG(lPrice))}</div>
                        )}
                      </div>
                      {lQty && lPrice && !isNaN(parseG(lPrice)) && parseInt(lQty, 10)>0 && (
                        <div style={{ flex:"0 0 140px" }}>
                          <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>TOTALE LOTTO</div>
                          <div style={{ fontSize:15, color:C.blue, fontWeight:700, fontFamily:"monospace", padding:"8px 0" }}>
                            {fmtG(parseInt(lQty, 10)*parseG(lPrice))}
                          </div>
                        </div>
                      )}
                      <button onClick={recordLot} disabled={!lQty||!lPrice||isNaN(parseG(lPrice))} style={{ ...pill(!!(lQty&&lPrice&&!isNaN(parseG(lPrice))),C.blue), padding:"8px 18px", flexShrink:0 }}>
                        🛒 ACQUISTO
                      </button>
                    </div>
                  </div>

                  {/* lots list */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:8 }}>ACQUISTI IN STOCK</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:14 }}>
                      {lots.filter(l=>!l.sold).length===0 && <div style={{ color:C.muted, fontSize:11, padding:"14px 0" }}>Nessun acquisto in stock</div>}
                      {lots.map((l, i) => {
                        if (l.sold) return null
                        const ev = allEVT[l.eventId] || EVT.none
                        const realPs = prices.filter(p => !p.esaurito)
                        const currentP = realPs.length ? realPs[realPs.length-1].price : null
                        const profit   = currentP ? (currentP - l.price) * l.qty : null
                        return (
                          <div key={i} className="r" style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:7, padding:"9px 12px", gap:10, flexWrap:"wrap" }}>
                            <span style={{ fontSize:12, color:C.muted, minWidth:118, flexShrink:0 }}>{fmtFull(l.timestamp)}</span>
                            <span style={{ fontSize:14, color:C.blue, fontWeight:700, fontFamily:"monospace", minWidth:50, flexShrink:0 }}>×{l.qty}</span>
                            <span style={{ fontSize:14, color:C.text, fontFamily:"monospace", minWidth:90, flexShrink:0 }}>@ {fmtG(l.price)}</span>
                            <span style={{ fontSize:13, color:C.muted, minWidth:90, fontFamily:"monospace", flexShrink:0 }}>= {fmtG(l.price*l.qty)}</span>
                            {profit !== null && (
                              <span style={{ fontSize:13, color:profit>=0?C.green:C.red, fontFamily:"monospace", minWidth:100, flexShrink:0 }}>
                                {profit>=0?"▲":"▼"} {fmtG(profit)}
                              </span>
                            )}
                            {ev.id !== "none" && <span style={{ fontSize:12, color:ev.color }}>{ev.icon}</span>}
                            <span style={{ fontSize:12, color:"#7b8ba6", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.note}</span>
                            <button onClick={()=>delLot(i)} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:13 }}>✕</button>
                          </div>
                        )
                      })}
                    </div>

                  </div>
                </div>
              )}

              {/* ══════════════ IN VENDITA TAB ══════════════ */}
              {subPage === "vendite" && (
                <div>
                  {/* stat bar */}
                  {listingStats && (
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                      {[
                        { l:"IN VENDITA",        v:listingStats.activeQty + " pz",                                                c:C.gold  },
                        { l:"VALORE AL BAZAR",   v:fmtG(listingStats.activeValue),                                                c:C.text  },
                        { l:"VENDITE CHIUSE",    v:listingStats.sold.length + " listing",                                         c:C.green },
                        { l:"PROFITTO TOTALE",   v:listingStats.profitableSales.length ? fmtG(listingStats.totalProfit) : "—",    c:listingStats.totalProfit>=0?C.green:C.red },
                        { l:"TEMPO MEDIO VEND.", v:listingStats.avgMs!=null ? fmtDurationMs(listingStats.avgMs) : "—",           c:C.blue  },
                      ].map(s => (
                        <div key={s.l} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 13px", flex:"1 1 90px" }}>
                          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>{s.l}</div>
                          <div style={{ fontSize:16, color:s.c, fontWeight:700, marginTop:3, fontFamily:"monospace" }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* form nuovo listing */}
                  <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:11, padding:18, marginBottom:14 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
                      <div style={{ flex:"0 0 90px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>QUANTITÀ</div>
                        <input type="number" min="1" max="999" value={lsQty} onChange={e=>setLsQty(e.target.value)} placeholder="10" style={inp()}/>
                      </div>
                      <div style={{ flex:"0 0 160px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>PREZZO BAZAR</div>
                        <input value={lsPrice} onChange={e=>setLsPrice(e.target.value)} placeholder="150k" style={inp({ color:C.gold })}/>
                        {lsPrice && !isNaN(parseG(lsPrice)) && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{fmtG(parseG(lsPrice))}</div>
                        )}
                      </div>
                      <div style={{ flex:"0 0 130px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>TASSE BAZAR</div>
                        <input value={lsTax} onChange={e=>setLsTax(e.target.value)} placeholder="es. 50k" style={inp({ color:C.red })}/>
                        {lsTax && !isNaN(parseG(lsTax)) && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{fmtG(parseG(lsTax))}</div>
                        )}
                      </div>
                      <button onClick={addListing} disabled={!lsQty||!lsPrice||isNaN(parseG(lsPrice))}
                        style={{ ...pill(!!(lsQty&&lsPrice&&!isNaN(parseG(lsPrice))),C.gold), padding:"8px 18px", flexShrink:0 }}>
                        🏷️ METTI IN VENDITA
                      </button>
                    </div>

                    {/* Lot matching preview */}
                    {lotPreview && lotPreview.links.length > 0 && (
                      <div style={{ marginTop:12, background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px" }}>
                        <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>LOTTI DAL MAGAZZINO (FIFO)</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                          {lotPreview.links.map((lk, i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                              <span style={{ color:C.blue, fontWeight:700, fontFamily:"monospace", minWidth:50 }}>x{lk.qty}</span>
                              <span style={{ color:C.text, fontFamily:"monospace" }}>@ {fmtG(lk.unitPrice)}</span>
                              <span style={{ color:C.muted, fontFamily:"monospace" }}>= {fmtG(lk.qty * lk.unitPrice)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop:8, display:"flex", gap:14, flexWrap:"wrap", fontSize:12 }}>
                          <span style={{ color:C.muted }}>Coperti: <b style={{ color:C.blue }}>{lotPreview.coveredQty} pz</b></span>
                          <span style={{ color:C.muted }}>Costo totale: <b style={{ color:C.text }}>{fmtG(lotPreview.totalCost)}</b></span>
                          <span style={{ color:C.muted }}>Media acquisto: <b style={{ color:C.text }}>{fmtG(lotPreview.avgBuyPrice)}</b></span>
                          {lotPreview.uncoveredQty > 0 && (
                            <span style={{ color:C.red, fontWeight:700 }}>⚠ {lotPreview.uncoveredQty} pz non coperti da magazzino</span>
                          )}
                        </div>
                        {lsPrice && !isNaN(parseG(lsPrice)) && lotPreview.avgBuyPrice && (() => {
                          const sellP = parseG(lsPrice)
                          const taxVal = lsTax && !isNaN(parseG(lsTax)) ? parseG(lsTax) : 0
                          const profit = (sellP - lotPreview.avgBuyPrice) * lotPreview.coveredQty - taxVal
                          return (
                            <div style={{ marginTop:6, fontSize:13, fontWeight:700, fontFamily:"monospace", color:profit>=0?C.green:C.red }}>
                              {profit>=0?"▲":"▼"} {fmtG(Math.abs(profit))} profitto stimato{taxVal > 0 ? " (tasse incluse)" : ""}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    {lotPreview && lotPreview.links.length === 0 && parseInt(lsQty, 10) > 0 && (
                      <div style={{ marginTop:8, fontSize:11, color:C.muted }}>Nessun lotto disponibile in magazzino per questo item</div>
                    )}
                  </div>

                  {/* listing attivi */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:8 }}>AL BAZAR ORA</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:16 }}>
                      {listings.filter(l=>!l.sold).length===0 && (
                        <div style={{ color:C.muted, fontSize:12, padding:"14px 0" }}>Nessun oggetto in vendita al momento</div>
                      )}
                      {listings.map((l, i) => {
                        if (l.sold) return null
                        const daysActive = ((Date.now() - new Date(l.listedAt)) / 86400000)
                        const covered = l.coveredQty || 0
                        const profitOnCovered = covered > 0 ? calcListingProfit(l) : null
                        return (
                          <div key={i} className="r" style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", gap:10, flexWrap:"wrap" }}>
                            <div style={{ display:"flex", flexDirection:"column", minWidth:118, flexShrink:0 }}>
                              <span style={{ fontSize:11, color:C.muted }}>{fmtFull(l.listedAt)}</span>
                              <span style={{ fontSize:11, color:daysActive>=3?C.red:daysActive>=1?C.gold:C.green }}>
                                {daysActive < 1 ? "⏱ da oggi" : `⏳ da ${Math.floor(daysActive)}g`}
                              </span>
                            </div>
                            <span style={{ fontSize:14, color:C.blue, fontWeight:700, fontFamily:"monospace", minWidth:45, flexShrink:0 }}>×{l.qty}</span>
                            <span style={{ fontSize:16, color:C.gold, fontWeight:700, fontFamily:"monospace", minWidth:100, flexShrink:0 }}>@ {fmtG(l.listPrice)}</span>
                            <span style={{ fontSize:13, color:C.muted, fontFamily:"monospace", minWidth:90, flexShrink:0 }}>= {fmtG(l.listPrice*l.qty)}</span>
                            {profitOnCovered != null && (
                              <span style={{ fontSize:13, color:profitOnCovered>=0?C.green:C.red, fontFamily:"monospace", minWidth:100, flexShrink:0 }}>
                                {profitOnCovered>=0?"▲":"▼"} {fmtG(profitOnCovered)}
                              </span>
                            )}
                            {l.buyPrice && <span style={{ fontSize:11, color:C.muted }}>media acq. {fmtG(l.buyPrice)}</span>}
                            {l.lotLinks && l.lotLinks.length > 0 && (
                              <span style={{ fontSize:11, color:C.muted2, flexShrink:0 }} title={l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}>
                                [{l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}]
                              </span>
                            )}
                            {covered < l.qty && covered > 0 && (
                              <span style={{ fontSize:11, color:C.red }}>⚠ {l.qty - covered} non coperti</span>
                            )}
                            {l.tax > 0 && <span style={{ fontSize:11, color:C.red, flexShrink:0 }}>tasse: {fmtG(l.tax)}</span>}
                            <div style={{ flex:1 }}/>
                            {partialIdx === i ? (
                              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, background:C.inputBg, border:`1px solid ${C.border2}`, borderRadius:8, padding:"6px 10px" }}>
                                <span style={{ fontSize:11, color:C.muted }}>Venduti:</span>
                                <input type="number" min="1" max={l.qty-1} value={partialQty} onChange={e=>setPartialQty(e.target.value)}
                                  onKeyDown={e=>{ if(e.key==="Enter"){ const q=parseInt(partialQty, 10); if(q>0&&q<l.qty) markListingSold(i,q) } if(e.key==="Escape"){setPartialIdx(null);setPartialQty("")} }}
                                  autoFocus style={{ ...inp({ width:65, padding:"4px 8px", fontSize:13, textAlign:"center" }) }}/>
                                <span style={{ fontSize:11, color:C.muted }}>/ {l.qty}</span>
                                {partialQty && !isNaN(parseInt(partialQty, 10)) && parseInt(partialQty, 10) > 0 && parseInt(partialQty, 10) < l.qty && l.buyPrice != null && (() => {
                                  const sq = parseInt(partialQty, 10)
                                  const pTax = l.tax ? Math.round(l.tax * sq / l.qty) : 0
                                  const pProfit = (l.listPrice - l.buyPrice) * Math.min(sq, l.coveredQty || 0) - pTax
                                  return <span style={{ fontSize:11, color:pProfit>=0?C.green:C.red, fontFamily:"monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                                    {pProfit>=0?"▲":"▼"}{fmtG(Math.abs(pProfit))}
                                  </span>
                                })()}
                                <button onClick={()=>{ const q=parseInt(partialQty, 10); if(q>0&&q<l.qty) markListingSold(i,q) }}
                                  disabled={!partialQty||isNaN(parseInt(partialQty, 10))||parseInt(partialQty, 10)<=0||parseInt(partialQty, 10)>=l.qty}
                                  style={{ ...pill(!!(partialQty&&!isNaN(parseInt(partialQty, 10))&&parseInt(partialQty, 10)>0&&parseInt(partialQty, 10)<l.qty), C.green, { padding:"4px 10px", fontSize:11 }), flexShrink:0 }}>CONFERMA</button>
                                <button onClick={()=>{setPartialIdx(null);setPartialQty("")}} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:13 }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                                <button onClick={()=>markListingSold(i)} title="Venduto tutto"
                                  style={{ ...pill(false, C.green, { padding:"5px 12px", fontSize:12 }) }}>✓ TUTTO</button>
                                {l.qty > 1 && <button onClick={()=>{setPartialIdx(i);setPartialQty("")}} title="Vendita parziale"
                                  style={{ ...pill(false, C.blue, { padding:"5px 10px", fontSize:12 }) }}>½</button>}
                              </div>
                            )}
                            <button onClick={()=>delListing(i)} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
                          </div>
                        )
                      })}
                    </div>

                    {/* storico vendite */}
                    {listings.filter(l=>l.sold).length > 0 && (<>
                      <div style={{ fontSize:12, color:C.muted, letterSpacing:3, marginBottom:8 }}>STORICO VENDITE</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:240, overflowY:"auto" }}>
                        {listings.map((l, i) => {
                          if (!l.sold) return null
                          const timeToSell   = fmtSellTime(l.listedAt, l.soldAt)
                          const msToSell     = new Date(l.soldAt) - new Date(l.listedAt)
                          const covered      = l.coveredQty || 0
                          const profitTotal  = covered > 0 ? calcListingProfit(l) : null
                          return (
                            <div key={i} className="r" style={{ display:"flex", alignItems:"center", background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:7, padding:"9px 14px", gap:10, flexWrap:"wrap" }}>
                              <span style={{ fontSize:11, color:C.muted, minWidth:118, flexShrink:0 }}>{fmtFull(l.listedAt)}</span>
                              <span style={{ fontSize:13, color:C.muted, fontFamily:"monospace", fontWeight:700, flexShrink:0 }}>×{l.qty} @ {fmtG(l.listPrice)}</span>
                              <div style={{ display:"flex", flexDirection:"column", flexShrink:0 }}>
                                <span style={{ fontSize:12, color:C.green }}>✓ venduto</span>
                                <span style={{ fontSize:12, color:msToSell<86400000?C.green:msToSell<3*86400000?C.gold:C.red, fontWeight:700 }}>
                                  ⏱ {timeToSell}
                                </span>
                              </div>
                              {profitTotal != null && (
                                <span style={{ fontSize:13, color:profitTotal>=0?C.green:C.red, fontFamily:"monospace", fontWeight:700 }}>
                                  {profitTotal>=0?"▲":"▼"} {fmtG(profitTotal)}
                                </span>
                              )}
                              {l.lotLinks && l.lotLinks.length > 0 && (
                                <span style={{ fontSize:11, color:C.muted2, flexShrink:0 }}>
                                  [{l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}]
                                </span>
                              )}
                              {l.tax > 0 && <span style={{ fontSize:11, color:C.red, flexShrink:0 }}>tasse: {fmtG(l.tax)}</span>}
                              <div style={{ flex:1 }}/>
                              <button onClick={()=>delListing(i)} style={{ background:"none", border:"none", color:C.muted2, cursor:"pointer", fontSize:14 }}>✕</button>
                            </div>
                          )
                        })}
                      </div>
                    </>)}
                  </div>
                </div>
              )}

              {/* ══════════════ CHARTS TAB ══════════════ */}
              {subPage === "charts" && (
                <div>
                  {/* day picker */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
                    <span style={{ fontSize:12, color:C.muted, letterSpacing:3 }}>GIORNO:</span>
                    {allDays.length === 0 && <span style={{ fontSize:11, color:C.muted }}>Nessun dato ancora</span>}
                    {allDays.map(d => {
                      const evId = data.events?.[d]
                      const ev   = evId && evId !== "none" ? allEVT[evId] : null
                      return (
                        <button key={d} onClick={()=>setChartDay(d)} style={pill(chartDay===d, ev?ev.color:C.gold, { padding:"5px 10px", fontSize:12 })}>
                          {d}{ev ? " "+ev.icon : ""}
                        </button>
                      )
                    })}
                  </div>

                  {/* day stats */}
                  {dayStats && (
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                      {[
                        { l:"ULTIMO",   v:fmtG(dayStats.last),  c:C.gold },
                        { l:"MIN",      v:fmtG(dayStats.min),   c:C.green },
                        { l:"MAX",      v:fmtG(dayStats.max),   c:C.red },
                        { l:"MEDIA",    v:fmtG(dayStats.avg),   c:C.text },
                        { l:"DELTA",    v:(dayStats.delta>=0?"+":"")+fmtG(dayStats.delta), c:dayStats.delta>=0?C.green:C.red },
                      ].map(s => (
                        <div key={s.l} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 12px", flex:"1 1 80px" }}>
                          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>{s.l}</div>
                          <div style={{ fontSize:17, color:s.c, fontWeight:700, marginTop:3, fontFamily:"monospace" }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* intraday chart */}
                  <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:11, padding:16, marginBottom:12 }}>
                    <div style={{ fontSize:11, color:C.muted, letterSpacing:3, marginBottom:12 }}>
                      INTRADAY — {chartDay}
                      {data.events?.[chartDay] && data.events[chartDay]!=="none" && (
                        <span style={{ marginLeft:10, color:allEVT[data.events[chartDay]]?.color }}>
                          {allEVT[data.events[chartDay]]?.icon} {allEVT[data.events[chartDay]]?.label}
                        </span>
                      )}
                    </div>
                    {chartPoints.length < 2 ? (
                      <div style={{ textAlign:"center", color:C.muted, padding:40, fontSize:12 }}>
                        {chartPoints.length===0 ? "Nessun dato per questo giorno" : "Registra almeno 2 prezzi per il grafico"}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={chartPoints} margin={{ top:5, right:20, left:10, bottom:5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                          <XAxis dataKey="time" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }}/>
                          <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickFormatter={v=>fmtG(v)}/>
                          <Tooltip
                            contentStyle={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:8, fontSize:12, color:C.text }}
                            labelStyle={{ color:C.muted }}
                            formatter={(v,_,p) => [
                              `${v.toLocaleString("it-IT")} ori (${fmtG(v)})${p.payload.eventId&&p.payload.eventId!=="none"?" "+allEVT[p.payload.eventId]?.icon:""}${p.payload.note?" — "+p.payload.note:""}`,
                              "Prezzo"
                            ]}
                          />
                          <Line type="monotone" dataKey="price" stroke={C.gold} strokeWidth={2.5}
                            dot={(props) => {
                              const { cx, cy, payload } = props
                              const ev = payload.eventId && payload.eventId !== "none"
                              const col = ev ? allEVT[payload.eventId]?.color || C.gold : C.gold
                              return <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={ev?7:4} fill={ev?col:C.panel} stroke={col} strokeWidth={2}/>
                            }}
                            activeDot={{ r:8, fill:C.gold }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* multi-day chart: media normale vs evento */}
                  {multiDayChart.length >= 2 && (
                    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:11, padding:16 }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:3, marginBottom:6 }}>STORICO MULTI-GIORNO — NORMALE vs EVENTO</div>
                      <div style={{ fontSize:12, color:C.muted2, marginBottom:12 }}>
                        Linea oro = media giornaliera · Verde = giorni normali · Arancio = giorni con evento
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={multiDayChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                          <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }}/>
                          <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickFormatter={v=>fmtG(v)}/>
                          <Tooltip
                            contentStyle={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:8, fontSize:12, color:C.text }}
                            formatter={(v,n) => v!=null ? [`${v.toLocaleString("it-IT")} ori (${fmtG(v)})`, n==="media"?"Media tot":n==="normale"?"Giorni normali":"Giorni evento"] : ["—"]}
                          />
                          <Legend formatter={v=><span style={{ color:C.muted, fontSize:11 }}>{v==="media"?"Media":v==="normale"?"Normale":"Evento"}</span>}/>
                          <Line type="monotone" dataKey="media"   stroke={C.gold}  strokeWidth={2}   dot={(p)=>{const{cx,cy,payload}=p;return<circle key={`m${cx}`} cx={cx} cy={cy} r={payload.hasEvent?7:4} fill={payload.hasEvent?C.gold:C.panel} stroke={C.gold} strokeWidth={2}/>}}/>
                          <Line type="monotone" dataKey="normale" stroke={C.green} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                          <Line type="monotone" dataKey="evento"  stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                        </LineChart>
                      </ResponsiveContainer>
                      {allStats?.avgEvent && allStats?.avgNormal && (
                        <div style={{ marginTop:10, fontSize:12, color:C.muted }}>
                          Diff. media evento vs normale:{" "}
                          <span style={{ color:allStats.avgEvent>allStats.avgNormal?C.green:C.red, fontWeight:700 }}>
                            {allStats.avgEvent>allStats.avgNormal?"+":""}{fmtG(allStats.avgEvent-allStats.avgNormal)}
                            {" "}({allStats.avgNormal ? ((allStats.avgEvent/allStats.avgNormal-1)*100).toFixed(1)+"%" : "—"})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ SETTINGS MODAL ══ */}
      {showSettings && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9997 }}>
          <div className="up" style={{ width:"80%", height:"80%", maxWidth:900, maxHeight:700, background:C.panel, border:`1px solid ${C.border2}`, borderRadius:14, display:"flex", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.6)" }}>

            {/* Sidebar sinistra */}
            <div style={{ width:180, background:C.inputBg, borderRight:`1px solid ${C.border}`, padding:"20px 0", display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
              <div style={{ padding:"0 16px 14px", fontSize:14, color:C.gold, fontWeight:700, letterSpacing:2 }}>⚙️ SETTINGS</div>
              {[
                { k:"salvataggio",    l:"💾 Salvataggio" },
                { k:"strategia",      l:"📊 Strategia"   },
                { k:"personalizza",   l:"🎨 Personalizza" },
                { k:"tema",           l:"🌗 Tema" },
              ].map(({ k, l }) => (
                <div key={k} onClick={()=>setSettingsCategory(k)}
                  style={{ padding:"10px 16px", fontSize:13, color:settingsCategory===k?C.gold:C.muted, background:settingsCategory===k?`${C.gold}1a`:"transparent", borderLeft:`3px solid ${settingsCategory===k?C.gold:"transparent"}`, cursor:"pointer", transition:"all .15s", fontWeight:settingsCategory===k?700:400 }}>
                  {l}
                </div>
              ))}
              <div style={{ flex:1 }}/>
              <div style={{ padding:"10px 16px" }}>
                <button onClick={()=>setShowSettings(false)} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:6, color:C.muted, cursor:"pointer", padding:"6px 14px", fontSize:12, width:"100%" }}>Chiudi</button>
              </div>
            </div>

            {/* Area contenuto destra */}
            <div style={{ flex:1, padding:28, overflowY:"auto" }}>

              {/* ── SALVATAGGIO ── */}
              {settingsCategory === "salvataggio" && (
                <div className="up">
                  <div style={{ fontSize:14, color:C.gold, fontWeight:700, letterSpacing:2, marginBottom:20 }}>💾 SALVATAGGIO</div>

                  <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                    {/* Stato salvataggio */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>STATO SALVATAGGIO</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>{saveStatus==="saving"?"⏳":saveStatus==="ok"?"✅":saveStatus==="error"?"⚠️":"💾"}</span>
                        <div>
                          <div style={{ fontSize:15, color:saveStatus==="saving"?C.gold:saveStatus==="ok"?C.green:saveStatus==="error"?C.red:C.text, fontWeight:700 }}>
                            {saveStatus==="saving"?"Salvataggio in corso...":saveStatus==="ok"?"Salvato con successo":saveStatus==="error"?"Errore di salvataggio":"Pronto"}
                          </div>
                          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Data: {todayStr()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Path dati */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>PERCORSO DATI</div>
                      <div style={{ fontSize:13, color:C.text, fontFamily:"monospace", wordBreak:"break-all", marginBottom:10 }}>{dataPath}</div>
                      <button onClick={()=>window.api.openDataFolder()} style={{ ...pill(false, C.gold, { padding:"6px 14px", fontSize:12 }) }}>📁 Apri cartella dati</button>
                    </div>

                    {/* Info */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>INFORMAZIONI</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:13, color:C.muted }}>
                        <div>Versione: <b style={{ color:C.text }}>v{appVersion}</b></div>
                        <div>Salvataggio automatico con backup (data.backup.json)</div>
                        <div>Item tracciati: <b style={{ color:C.text }}>{Object.keys(data?.items || {}).length}</b></div>
                        <div>Prezzi registrati: <b style={{ color:C.text }}>{Object.values(data?.items || {}).reduce((a,it)=>a+(it.prices?.length||0),0)}</b></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STRATEGIA ── */}
              {settingsCategory === "strategia" && (
                <div className="up">
                  <div style={{ fontSize:14, color:C.gold, fontWeight:700, letterSpacing:2, marginBottom:8 }}>📊 STRATEGIA — CONFIGURAZIONE SEGNALI</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>
                    Configura le soglie percentuali per i segnali di trading. I segnali vengono calcolati confrontando il prezzo attuale con la media storica dell'item.
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      { k:"strongBuy",  label:"FORTE COMPRA",  icon:"🟢", desc:"Prezzo molto sotto la media", color:"#10b981", suffix:"% sotto media" },
                      { k:"buy",        label:"COMPRA",        icon:"🟢", desc:"Prezzo sotto la media",       color:"#34d399", suffix:"% sotto media" },
                      { k:"high",       label:"SOPRA MEDIA",   icon:"🟠", desc:"Prezzo sopra la media",       color:"#f97316", suffix:"% sopra media" },
                      { k:"overpriced", label:"TROPPO CARO",   icon:"🔴", desc:"Prezzo molto sopra la media", color:"#ef4444", suffix:"% sopra media" },
                      { k:"sell",       label:"VENDI",         icon:"🔵", desc:"Prezzo sopra il costo medio di acquisto", color:"#3b82f6", suffix:"% sopra costo acq." },
                    ].map(s => {
                      const cfg = data?.signalConfig || SIGNAL_DEFAULTS
                      const val = cfg[s.k] ?? SIGNAL_DEFAULTS[s.k]
                      return (
                        <div key={s.k} style={{ background:C.inputBg, border:`1px solid ${s.color}33`, borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                          <span style={{ fontSize:22 }}>{s.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:s.color, fontWeight:700, letterSpacing:1 }}>{s.label}</div>
                            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.desc}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <input
                              type="number" min="1" max="99" step="1"
                              value={val}
                              onChange={e => {
                                const v = parseInt(e.target.value, 10)
                                if (isNaN(v) || v < 1 || v > 99) return
                                const newCfg = { ...(data?.signalConfig || SIGNAL_DEFAULTS), [s.k]: v }
                                upd({ ...data, signalConfig: newCfg })
                              }}
                              style={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:6, color:s.color, padding:"8px 10px", fontSize:16, fontWeight:700, fontFamily:"monospace", width:70, textAlign:"center", outline:"none" }}
                            />
                            <span style={{ fontSize:12, color:C.muted, minWidth:110 }}>{s.suffix}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Reset defaults */}
                  <div style={{ marginTop:18, display:"flex", gap:10, alignItems:"center" }}>
                    <button onClick={() => upd({ ...data, signalConfig: { ...SIGNAL_DEFAULTS } })}
                      style={{ ...pill(false, C.muted, { padding:"8px 16px", fontSize:12 }) }}>
                      Ripristina valori predefiniti
                    </button>
                    <span style={{ fontSize:11, color:C.muted }}>
                      Default: Forte Compra {SIGNAL_DEFAULTS.strongBuy}% · Compra {SIGNAL_DEFAULTS.buy}% · Sopra {SIGNAL_DEFAULTS.high}% · Caro {SIGNAL_DEFAULTS.overpriced}% · Vendi {SIGNAL_DEFAULTS.sell}%
                    </span>
                  </div>
                </div>
              )}

              {/* ── PERSONALIZZA ── */}
              {settingsCategory === "personalizza" && (
                <div className="up">
                  <div style={{ fontSize:14, color:C.gold, fontWeight:700, letterSpacing:2, marginBottom:20 }}>🎨 PERSONALIZZA</div>

                  <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                    {/* Trend days */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>GIORNI TREND</div>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Numero di giorni usati per calcolare la tendenza dei prezzi.</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {[3, 5, 7, 14, 30].map(d => (
                          <button key={d} onClick={() => upd({ ...data, trendDays: d })}
                            style={pill(trendDays === d, C.gold, { padding:"7px 14px", fontSize:13 })}>
                            {d} giorni
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Lot strategy */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>STRATEGIA LOTTI</div>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Come vengono abbinati i lotti dal magazzino quando crei un listing al bazar.</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {LOT_STRATEGIES.map(s => (
                          <button key={s.id} onClick={() => upd({ ...data, lotStrategy: s.id })}
                            style={pill(lotStrategy === s.id, C.gold, { padding:"7px 14px", fontSize:13 })}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom categories */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>CATEGORIE PERSONALIZZATE</div>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Aggiungi categorie extra oltre a quelle predefinite.</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                        {(data?.customCategories || []).map(cat => (
                          <span key={cat} style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.panel, border:`1px solid ${C.border2}`, borderRadius:6, padding:"5px 10px", fontSize:12, color:C.text }}>
                            {cat}
                            <button onClick={() => upd({ ...data, customCategories: (data.customCategories || []).filter(c => c !== cat) })}
                              style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13, padding:0 }}>✕</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <input value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { const v = newCategoryInput.trim(); if (v && !allCategories.includes(v)) { upd({ ...data, customCategories: [...(data.customCategories || []), v] }); setNewCategoryInput("") } } }}
                          placeholder="Nuova categoria..." style={inp({ width:200, fontSize:13 })}/>
                        <button onClick={() => { const v = newCategoryInput.trim(); if (v && !allCategories.includes(v)) { upd({ ...data, customCategories: [...(data.customCategories || []), v] }); setNewCategoryInput("") } }}
                          style={pill(!!newCategoryInput.trim(), C.gold, { padding:"7px 14px", fontSize:12 })}>+ Aggiungi</button>
                      </div>
                    </div>

                    {/* Custom ND discounts */}
                    <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>SCONTI ND PERSONALIZZATI</div>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Aggiungi percentuali di sconto extra per i NosDollari.</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
                        {allNdDiscounts.map(d => {
                          const isCustom = !ND_DISCOUNTS.includes(d)
                          return (
                            <span key={d} style={{ display:"inline-flex", alignItems:"center", gap:4, background:isCustom ? `${C.gold}1a` : C.panel, border:`1px solid ${isCustom ? C.gold + "55" : C.border2}`, borderRadius:6, padding:"4px 8px", fontSize:12, color:isCustom ? C.gold : C.muted }}>
                              {d}%
                              {isCustom && <button onClick={() => upd({ ...data, customNdDiscounts: (data.customNdDiscounts || []).filter(v => v !== d) })}
                                style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:11, padding:0 }}>✕</button>}
                            </span>
                          )
                        })}
                      </div>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <input type="number" min="1" max="99" value={newNdDiscInput} onChange={e => setNewNdDiscInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { const v = parseInt(newNdDiscInput, 10); if (v > 0 && v < 100 && !allNdDiscounts.includes(v)) { upd({ ...data, customNdDiscounts: [...(data.customNdDiscounts || []), v] }); setNewNdDiscInput("") } } }}
                          placeholder="es. 35" style={inp({ width:100, fontSize:13 })}/>
                        <span style={{ fontSize:12, color:C.muted }}>%</span>
                        <button onClick={() => { const v = parseInt(newNdDiscInput, 10); if (v > 0 && v < 100 && !allNdDiscounts.includes(v)) { upd({ ...data, customNdDiscounts: [...(data.customNdDiscounts || []), v] }); setNewNdDiscInput("") } }}
                          style={pill(!!newNdDiscInput, C.gold, { padding:"7px 14px", fontSize:12 })}>+ Aggiungi</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TEMA ── */}
              {settingsCategory === "tema" && (
                <div className="up">
                  <div style={{ fontSize:14, color:C.gold, fontWeight:700, letterSpacing:2, marginBottom:20 }}>🌗 TEMA</div>

                  <div style={{ background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:10, padding:"20px 24px" }}>
                    <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:12 }}>SELEZIONA TEMA</div>
                    <div style={{ display:"flex", gap:12 }}>
                      {[
                        { id:"dark",  label:"Dark Mode",  icon:"🌙", desc:"Tema scuro — ideale per sessioni notturne",  bg:"#13151f", fg:"#dde6f0", accent:"#e8a838" },
                        { id:"light", label:"Light Mode", icon:"☀️", desc:"Tema chiaro — migliore leggibilità di giorno", bg:"#e4e7ed", fg:"#111827", accent:"#a06510" },
                      ].map(t => (
                        <div key={t.id}
                          onClick={() => { setTheme(t.id); upd({ ...data, theme: t.id }) }}
                          style={{ flex:1, border:`2px solid ${theme===t.id?C.gold:C.border2}`, borderRadius:10, padding:16, cursor:"pointer", transition:"all .15s", background:theme===t.id?`${C.gold}11`:"transparent" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                            <span style={{ fontSize:24 }}>{t.icon}</span>
                            <div>
                              <div style={{ fontSize:14, color:theme===t.id?C.gold:C.text, fontWeight:700 }}>{t.label}</div>
                              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{t.desc}</div>
                            </div>
                          </div>
                          {/* preview */}
                          <div style={{ background:t.bg, borderRadius:6, padding:10, border:`1px solid ${theme===t.id?C.gold+"55":C.border}` }}>
                            <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444" }}/>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:"#f59e0b" }}/>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e" }}/>
                            </div>
                            <div style={{ height:6, width:"60%", background:t.accent, borderRadius:3, marginBottom:4 }}/>
                            <div style={{ height:4, width:"80%", background:t.fg+"33", borderRadius:2, marginBottom:3 }}/>
                            <div style={{ height:4, width:"45%", background:t.fg+"22", borderRadius:2 }}/>
                          </div>
                          {theme === t.id && (
                            <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:C.gold, fontWeight:700, letterSpacing:1 }}>ATTIVO</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ QUICK-ADD MODAL ══ */}
      {showQuick && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowQuick(false) }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div className="up" style={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width:520, maxWidth:"95vw", boxShadow:"0 20px 60px rgba(0,0,0,.6)" }}>

            {/* header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div>
                <div style={{ fontSize:17, color:C.gold, fontWeight:700, letterSpacing:2 }}>⚡ QUICK-ADD</div>
              </div>
              <button onClick={()=>setShowQuick(false)} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:5, color:C.muted, cursor:"pointer", fontSize:14, padding:"2px 8px" }}>✕</button>
            </div>

            {/* form */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {/* item selector + copy */}
              <div>
                <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>ITEM</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <select value={qItem} onChange={e=>{ setQItem(e.target.value); navigator.clipboard.writeText(e.target.value) }} style={{ ...inp(), fontSize:14, color:C.gold, flex:1 }}>
                    {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={()=>{ if(qItem) navigator.clipboard.writeText(qItem) }} title="Copia nome"
                    style={{ background:`${C.gold}1a`, border:`1px solid ${C.gold}55`, borderRadius:7, color:C.gold, cursor:"pointer", padding:"8px 12px", fontSize:13, fontWeight:700, flexShrink:0 }}>
                    ⎘
                  </button>
                </div>
                {qItem && (() => {
                  const ps = data?.items?.[qItem]?.prices || []
                  const lastP = ps.filter(p => !p.esaurito)
                  const last = lastP.length ? lastP[lastP.length-1] : null
                  return last ? (
                    <div style={{ fontSize:13, color:C.muted, marginTop:5 }}>
                      Ultimo: <b style={{ color:C.gold }}>{fmtG(last.price)}</b> — {fmtFull(last.timestamp)}
                    </div>
                  ) : null
                })()}
              </div>

              {/* price + note row */}
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:"0 0 200px" }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>PREZZO</div>
                  <input
                    ref={qPriceRef}
                    value={qPrice}
                    onChange={e=>setQPrice(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter") quickSave(); if(e.key==="Escape") setShowQuick(false) }}
                    placeholder="150k · 1.5kk · 200000"
                    style={{ ...inp({ fontSize:18, color:C.gold }) }}
                    autoFocus
                  />
                  {qPrice && !isNaN(parseG(qPrice)) && (
                    <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                      = {parseG(qPrice).toLocaleString("it-IT")} ori · <span style={{ color:C.gold }}>{fmtG(parseG(qPrice))}</span>
                    </div>
                  )}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:5 }}>EVENTO</div>
                  <select value={curEventId} onChange={e=>setCurEvt(e.target.value)}
                    style={{ ...inp(), fontSize:14, color:curEvt.color }}>
                    {allEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.icon} {ev.label}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={quickSave}
                disabled={!qItem || !qPrice || isNaN(parseG(qPrice))}
                style={{ ...pill(!!(qItem && qPrice && !isNaN(parseG(qPrice))), C.gold), padding:"11px", fontSize:14, letterSpacing:2, marginTop:2 }}>
                ⚡ SALVA → PROSSIMO (Enter)
              </button>
            </div>

            {/* recent entries */}
            {qRecent.length > 0 && (
              <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:8 }}>APPENA REGISTRATI</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:200, overflowY:"auto" }}>
                  {qRecent.map((r, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 10px", background:C.inputBg, borderRadius:6, border:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:12, color:C.muted, minWidth:100 }}>{fmtTime(new Date(r.ts))}</span>
                      <span style={{ fontSize:13, color:C.gold, fontWeight:700, minWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
                      <span style={{ fontSize:14, color:C.text, fontFamily:"monospace", fontWeight:700 }}>{fmtG(r.price)}</span>
                      <span style={{ fontSize:11, color:C.green, marginLeft:"auto" }}>✓ salvato</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      {/* ══ UPDATE POPUP ══ */}
      {(updateStatus === "available" || updateStatus === "downloading" || updateStatus === "downloaded" || updateStatus === "error") && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9998 }}>
          <div className="up" style={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:14, padding:28, width:400, maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,.6)", textAlign:"center" }}>

            {updateStatus === "available" && (<>
              <div style={{ fontSize:40, marginBottom:12 }}>⬇️</div>
              <div style={{ fontSize:16, color:C.text, fontWeight:700, marginBottom:8 }}>Aggiornamento disponibile</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Download in preparazione...</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"6px 16px", fontSize:12 }}>CHIUDI</button>
            </>)}

            {updateStatus === "downloading" && (<>
              <div style={{ fontSize:40, marginBottom:12 }}>📥</div>
              <div style={{ fontSize:16, color:C.text, fontWeight:700, marginBottom:12 }}>Download in corso...</div>
              <div style={{ width:"100%", height:8, background:C.inputBg, borderRadius:4, overflow:"hidden", marginBottom:8 }}>
                <div style={{ width:`${downloadPct}%`, height:"100%", background:"#ffa726", borderRadius:4, transition:"width .3s" }}/>
              </div>
              <div style={{ fontSize:14, color:"#ffa726", fontWeight:700, fontFamily:"monospace", marginBottom:14 }}>{downloadPct}%</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"6px 16px", fontSize:12 }}>CHIUDI</button>
            </>)}

            {updateStatus === "downloaded" && (<>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, color:C.text, fontWeight:700, marginBottom:8 }}>Aggiornamento pronto!</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>L'app verrà chiusa e riavviata con la nuova versione.</div>
              <button onClick={() => window.api.flushAndInstallUpdate(data)}
                style={{ ...pill(true, C.green), padding:"12px 28px", fontSize:15, letterSpacing:2 }}>
                🔄 AGGIORNA E RIAVVIA
              </button>
            </>)}

            {updateStatus === "error" && (<>
              <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
              <div style={{ fontSize:16, color:C.red, fontWeight:700, marginBottom:8 }}>Aggiornamento fallito</div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:14, wordBreak:"break-word" }}>{updateError}</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"8px 20px", fontSize:13 }}>
                CHIUDI
              </button>
            </>)}

          </div>
        </div>
      )}
    </div>
  )
}
