import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend
} from "recharts"
import { fmtG, parseG, fmtDate, fmtTime, fmtFull, todayStr, breakDuration, fmtDurationMs, fmtSellTime, fmtAge } from "./utils/formatting"
import { EVENTS, EVT, SIGNAL_DEFAULTS, SIGNAL_GROUPS, CATEGORIES, ND_DISCOUNTS, LOT_STRATEGIES, mkInit } from "./utils/constants"
import { matchLotsForQty, calcTrend, calcVolatility, calcOpenQty, calcListingProfit, getSignal as _getSignal } from "./utils/analysis"
import * as api from "./services/api"
import { DARK, LIGHT, C, setActiveTheme, inp, pill } from "./utils/theme"
import NavigationContext from "./contexts/NavigationContext"
import DataContext from "./contexts/DataContext"
import ThemeContext from "./contexts/ThemeContext"
import Modal from "./components/Modal"
import StatBar from "./components/StatBar"
import Dashboard from "./pages/Dashboard"
import Analisi from "./pages/Analisi"
import Bazar from "./pages/Bazar"
import Magazzino from "./pages/Magazzino"
import NdCalc from "./pages/NdCalc"
import Crafting from "./pages/Crafting"
import ItemView from "./pages/ItemView"
import type { AppData, Item, PriceEntry, Lot, LotLink, Listing, SignalConfig, EventDef } from "./types"
import type { Signal, SignalType, TrendResult, Volatility } from "./types"
import type { NdItemsResult, NdItem } from "./pages/NdCalc"
import type { PageId, SubPageId } from "./contexts/NavigationContext"
import a from "./App.module.css"

// Extend CSSProperties to support WebkitAppRegion
declare module "react" {
  interface CSSProperties {
    WebkitAppRegion?: "drag" | "no-drag"
  }
}

// Electron bug: window.confirm() ruba il focus dal webContents, gli input smettono di funzionare
function safeConfirm(msg: string): boolean { const r = window.confirm(msg); setTimeout(() => window.focus(), 0); return r }

// getSignal wrapper: passa C (palette) come terzo argomento
function getSignal(it: Item | null | undefined, cfg: SignalConfig | null | undefined): Signal { return _getSignal(it, cfg, C) }

// Pure helper — moved outside component for stable references in useCallback
function processListingSold(itemName: string, allLots: Lot[], allListings: Listing[], idx: number, soldQty?: number) {
  const listing = allListings[idx]
  if (!listing || listing.sold) return null
  const isFullSale = !soldQty || soldQty >= listing.qty

  if (isFullSale) {
    const updatedLots = allLots.map((l: Lot) => ({ ...l }))
    if (!listing.lotsConsumed && listing.lotLinks) {
      for (const link of listing.lotLinks) {
        const lotIdx = updatedLots.findIndex((l: Lot) => l.id === link.lotId)
        if (lotIdx !== -1) {
          if (link.qty >= updatedLots[lotIdx].qty) updatedLots[lotIdx].sold = true
          else updatedLots[lotIdx].qty -= link.qty
        }
      }
    }
    const updatedListings = allListings.map((l: Listing, i: number) => i === idx ? { ...l, sold: true as const, soldAt: new Date().toISOString() } : l)
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
    let newLinks = listing.lotLinks ? listing.lotLinks.map((lk: LotLink) => ({...lk})) : [] as LotLink[]
    let rem = soldQty!
    for (let i = 0; i < newLinks.length && rem > 0; i++) {
      const take = Math.min(newLinks[i].qty, rem)
      newLinks[i].qty -= take
      rem -= take
    }
    newLinks = newLinks.filter((lk: LotLink) => lk.qty > 0)
    const remainingCovered = Math.max(0, (listing.coveredQty || 0) - soldQty!)
    const updatedListing = {
      ...listing, qty: listing.qty - soldQty!, coveredQty: remainingCovered,
      lotLinks: newLinks, totalCost: newLinks.reduce((a: number, lk: LotLink) => a + lk.qty * lk.unitPrice, 0),
      tax: (listing.tax || 0) - proportionalTax
    }
    const updatedListings = [...allListings]
    updatedListings[idx] = updatedListing
    updatedListings.push(soldEntry as Listing)
    return { lots: allLots.map((l: Lot) => ({ ...l })), listings: updatedListings }
  }
}

function migrateData(d: Record<string, unknown>): AppData {
  const defaults = mkInit()
  const raw = d as Record<string, any>
  for (const key of Object.keys(defaults)) {
    if (raw[key] === undefined) raw[key] = (defaults as unknown as Record<string, unknown>)[key]
  }
  if (raw.signalConfig) {
    for (const key of Object.keys(SIGNAL_DEFAULTS)) {
      if (raw.signalConfig[key] === undefined) raw.signalConfig[key] = (SIGNAL_DEFAULTS as unknown as Record<string, unknown>)[key]
    }
  }
  for (const it of Object.values(raw.items || {}) as any[]) {
    if (!it.meta) it.meta = {}
    if (!it.prices) it.prices = []
    if (!it.lots) it.lots = []
    if (!it.listings) it.listings = []
    for (const lot of it.lots) {
      if (!lot.id) lot.id = lot.timestamp + '_' + Math.random().toString(36).slice(2,6)
    }
  }
  return raw as AppData
}


/* ═══════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════ */
export default function App() {
  const [data,       setData]      = useState<AppData | null>(null)
  const [saveStatus, setSaveStatus]= useState("idle")
  const [dataPath,   setDataPath]  = useState("")
  const [appVersion, setAppVersion]= useState("")
  const [updateStatus, setUpdateStatus] = useState<string | null>(null) // null | "available" | "downloading" | "downloaded" | "error"
  const [downloadPct, setDownloadPct] = useState(0)
  const [updateError, setUpdateError] = useState("")

  // theme
  const [theme, setTheme] = useState(() => localStorage.getItem("nostale-theme") || "dark")
  setActiveTheme(theme)
  document.documentElement.setAttribute("data-theme", theme)

  // navigation
  const [page,    setPage]    = useState<PageId>("dashboard")
  const [selItem, setSelItem] = useState<string | null>(null)
  const [subPage, setSubPage] = useState<SubPageId>("prices")

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
  const [partialIdx, setPartialIdx] = useState<number | null>(null)
  const [partialQty, setPartialQty] = useState("")
  const [bazarPartialKey, setBazarPartialKey] = useState<string | null>(null)
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
  const setQItem = (v: string | ((prev: string) => string)) => { const val = typeof v === "function" ? v(qItemRef.current) : v; qItemRef.current = val; setQItem_(val) }
  const [qPrice,      setQPrice]      = useState("")
  const [qRecent,     setQRecent]     = useState<Array<{name:string,price:number,ts:string}>>([])
  const qPriceRef = useRef<HTMLInputElement | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── ITEM NAMES (must be before useEffect that references it) ── */
  const itemNames = useMemo(() => Object.keys(data?.items || {}).sort((a,b) => a.localeCompare(b)), [data?.items])

  /* ── KEYBOARD SHORTCUTS ── */
  const openQuickRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        const [loaded, dp] = await Promise.all([api.loadData(), api.getDataPath()])
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
          const nav = JSON.parse(localStorage.getItem("nostale-nav") || "null")
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
    api.getVersion().then(v => v && setAppVersion(v)).catch(() => {})
    const unsubs = [
      api.onUpdateAvailable(() => setUpdateStatus("available")),
      api.onDownloadProgress((info) => { setUpdateStatus("downloading"); setDownloadPct(Math.round(info.percent || 0)) }),
      api.onUpdateDownloaded(() => setUpdateStatus("downloaded")),
      api.onUpdateError((msg) => { setUpdateStatus("error"); setUpdateError(msg) }),
    ]
    return () => unsubs.forEach(fn => fn?.())
  }, [])

  /* ── SAVE (debounced) ── */
  const persist = useCallback((nd: AppData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus("saving")
    saveTimer.current = setTimeout(async () => {
      const r = await api.saveData(nd).catch(() => ({ ok: false }))
      setSaveStatus(r.ok ? "ok" : "error")
      setTimeout(() => setSaveStatus("idle"), 2000)
    }, 600)
  }, [])

  // Clear debounce timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Track latest data + selItem for flush-on-close & stable callbacks
  const dataRef = useRef<AppData | null>(null)
  const selItemRef = useRef(selItem)
  selItemRef.current = selItem
  const upd = useCallback((nd: AppData) => { setData(nd); dataRef.current = nd; persist(nd) }, [persist])

  // Flush pending save on window close
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current && dataRef.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        api.saveData(dataRef.current).catch(() => {})
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
  const setCurEvt  = (id: string) => upd({ ...data!, events: { ...data!.events, [todayStr()]: id } })

  /* ── ITEM HELPERS ── */
  const item      = selItem ? data?.items?.[selItem] : null
  const prices    = item?.prices   || []
  const lots      = item?.lots     || []
  const listings  = item?.listings || []

  /* ── SIGNAL CACHE ── */
  const signalCache = useMemo((): Record<string, Signal> => {
    const cache: Record<string, Signal> = {}
    for (const name of itemNames) {
      cache[name] = getSignal(data?.items?.[name], data?.signalConfig)
    }
    return cache
  }, [data?.items, data?.signalConfig, itemNames])
  const filtered  = useMemo(() => {
    let names = itemNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    if (sideCategory !== "__all__") names = names.filter(n => (data?.items?.[n]?.meta?.category || "—") === sideCategory)
    if (sideSort === "price") {
      names = [...names].sort((a, b) => {
        const pa = (data?.items?.[a]?.prices || []).filter(p => !p.esaurito)
        const pb = (data?.items?.[b]?.prices || []).filter(p => !p.esaurito)
        return (pb.length ? pb[pb.length-1].price! : -1) - (pa.length ? pa[pa.length-1].price! : -1)
      })
    } else if (sideSort === "signal") {
      const ord: Record<string, number> = { strong_buy:0, buy:1, buy_target:0, hold:2, esaurito:3, high:4, sell:5, overpriced:6, sell_target:5, nodata:7 }
      names = [...names].sort((a, b) => (ord[signalCache[a]?.type]??7) - (ord[signalCache[b]?.type]??7))
    } else {
      names = [...names].sort((a, b) => a.localeCompare(b))
    }
    return names
  }, [itemNames, search, sideCategory, sideSort, data?.items, signalCache])

  /* ── PRICE ANALYTICS ── */
  const allDays = useMemo(() => {
    if (!prices.length) return []
    const s = new Set(prices.map(p => fmtDate(new Date(p.timestamp))))
    const parseDate = (s: string) => { const [d,m,y] = s.split("/"); return new Date(+y,+m-1,+d).getTime() }
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
      price:   p.price!,
      eventId: p.eventId,
      note:    p.note,
    })), [dayPrices])

  const allStats = useMemo(() => {
    if (!prices.length) return null
    // Escludi le voci "esaurito" dai calcoli di prezzo
    const realPrices   = prices.filter(p => !p.esaurito)
    if (!realPrices.length) return null
    const vals         = realPrices.map(p => p.price!)
    const eventPrices  = realPrices.filter(p => p.eventId !== "none").map(p => p.price!)
    const normalPrices = realPrices.filter(p => p.eventId === "none").map(p => p.price!)
    const avg          = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null
    // Stato attuale: l'ultima entry in assoluto (incluse esaurito)
    const lastEntry    = prices[prices.length - 1]
    const isEsaurito   = lastEntry?.esaurito === true
    const lastRealPrice = realPrices[realPrices.length - 1]?.price
    const esauritoCount = prices.filter(p => p.esaurito).length
    return {
      current:      (isEsaurito ? lastRealPrice! : vals[vals.length-1]),
      isEsaurito,
      esauritoCount,
      avg:          avg(vals)!,
      min:          Math.min(...vals),
      max:          Math.max(...vals),
      avgEvent:     avg(eventPrices),
      avgNormal:    avg(normalPrices),
      count:        realPrices.length,
    }
  }, [prices])

  const dayStats = useMemo(() => {
    if (!dayPrices.length) return null
    const vals = dayPrices.map(p => p.price!)
    return {
      min: Math.min(...vals), max: Math.max(...vals),
      avg: Math.round(vals.reduce((a: number,b: number)=>a+b,0)/vals.length),
      delta: vals.length > 1 ? vals[vals.length-1] - vals[0] : 0,
      last: vals[vals.length-1],
    }
  }, [dayPrices])

  const multiDayChart = useMemo(() => {
    if (!selItem || !data || allDays.length < 2) return []
    return [...allDays].reverse().map(d => {
      const entries = prices.filter(p => !p.esaurito && fmtDate(new Date(p.timestamp)) === d)
      if (!entries.length) return null
      const vals = entries.map(e => e.price!)
      const evP  = entries.filter(e => e.eventId !== "none").map(e => e.price!)
      const norP = entries.filter(e => e.eventId === "none").map(e => e.price!)
      const avg  = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : undefined
      return {
        day:       d.slice(0,5),
        media:     avg(vals),
        evento:    avg(evP),
        normale:   avg(norP),
        min:       Math.min(...vals),
        max:       Math.max(...vals),
        hasEvent:  !!(data.events?.[d] && data.events[d] !== "none"),
        eventColor: data.events?.[d] ? allEVT[data.events[d]]?.color : undefined,
      }
    }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  }, [prices, allDays, data?.events, allEVT, selItem])

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
    const sellTimesMs = sold.map(l => new Date(l.soldAt!).getTime() - new Date(l.listedAt).getTime())
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
  }, [data?.items])

  /* ── BAZAR OVERVIEW — all active listings across items ── */
  const bazarOverview = useMemo(() => {
    if (!data) return { rows: [], totalQty: 0, totalValue: 0, totalTax: 0, totalProfit: 0, totalCost: 0 }
    const rows = []
    for (const name of Object.keys(data.items || {})) {
      const it = data.items[name]
      const lsList = it.listings || []
      for (let i = 0; i < lsList.length; i++) {
        const l = lsList[i]
        if (l.sold) continue
        const covered = l.coveredQty || 0
        const profit = covered > 0 ? calcListingProfit(l) : null
        const daysActive = (Date.now() - new Date(l.listedAt).getTime()) / 86400000
        rows.push({ name, listingIdx: i, listing: l, covered, profit, daysActive })
      }
    }
    const totalQty   = rows.reduce((a,r) => a + r.listing.qty, 0)
    const totalValue = rows.reduce((a,r) => a + r.listing.qty * r.listing.listPrice, 0)
    const totalTax   = rows.reduce((a,r) => a + (r.listing.tax || 0), 0)
    const totalProfit = rows.reduce((a,r) => a + (r.profit || 0), 0)
    const totalCost = rows.reduce((a,r) => a + (r.listing.buyPrice != null ? r.listing.buyPrice * (r.listing.coveredQty || r.listing.qty) : 0), 0)
    return { rows, totalQty, totalValue, totalTax, totalProfit, totalCost }
  }, [data?.items])

  /* ── MAGAZZINO OVERVIEW — all open lots across items with aging ── */
  const magazzinoOverview = useMemo(() => {
    if (!data) return { rows: [], totalQty: 0, totalSpent: 0, totalEstValue: 0, totalEstProfit: 0, itemCount: 0 }
    const rows = []
    const itemSet = new Set()
    for (const name of Object.keys(data.items || {})) {
      const it = data.items[name]
      const lots = it.lots || []
      const ps = it.prices || []
      // Ultimo prezzo reale (per colonna ATTUALE)
      const realPrices = ps.filter(p => !p.esaurito)
      const currentPrice = realPrices.length ? realPrices[realPrices.length - 1].price : null
      // Media vendita: media listPrice dei listing venduti (per profitto stimato)
      const soldListings = (it.listings || []).filter(l => l.sold)
      const avgSellPrice = soldListings.length
        ? Math.round(soldListings.reduce((a, l) => a + l.listPrice, 0) / soldListings.length)
        : null
      // Riferimento profitto: media vendita se disponibile, altrimenti ultimo prezzo
      const refPrice = avgSellPrice ?? currentPrice
      // One row per open lot
      for (const lot of lots) {
        if (lot.sold) continue
        const lotCost = lot.qty * lot.price
        // Profitto stimato = qty * (media vendita - prezzo acquisto)
        const estValue = refPrice != null ? lot.qty * refPrice : null
        const estProfit = refPrice != null ? lot.qty * (refPrice - lot.price) : null
        const ageDays = (Date.now() - new Date(lot.timestamp).getTime()) / 86400000
        rows.push({ name, lot, qty: lot.qty, price: lot.price, lotCost, estValue, estProfit, ageDays, currentPrice, refPrice, note: lot.note })
        itemSet.add(name)
      }
    }
    const totalQty = rows.reduce((a, r) => a + r.qty, 0)
    const totalSpent = rows.reduce((a, r) => a + r.lotCost, 0)
    const totalEstValue = rows.reduce((a, r) => a + (r.estValue || 0), 0)
    const totalEstProfit = rows.reduce((a, r) => a + (r.estProfit || 0), 0)
    const itemCount = itemSet.size
    return { rows, totalQty, totalSpent, totalEstValue, totalEstProfit, itemCount }
  }, [data?.items])

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
            const days = (new Date(ls.listedAt).getTime() - new Date(lot.timestamp).getTime()) / 86400000
            stagingDays.push(days)
          }
        }
      }
      const avgStaging = stagingDays.length ? stagingDays.reduce((a, b) => a + b, 0) / stagingDays.length : null
      const minStaging = stagingDays.length ? Math.min(...stagingDays) : null
      const maxStaging = stagingDays.length ? Math.max(...stagingDays) : null

      // Sell time: listing to sold
      const sellDays = soldListings.filter(l => l.soldAt).map(l => (new Date(l.soldAt!).getTime() - new Date(l.listedAt).getTime()) / 86400000)
      const avgSell = sellDays.length ? sellDays.reduce((a, b) => a + b, 0) / sellDays.length : null
      const minSell = sellDays.length ? Math.min(...sellDays) : null
      const maxSell = sellDays.length ? Math.max(...sellDays) : null

      // Full cycle: lot purchase to sold listing
      const cycleDays = []
      for (const ls of soldListings) {
        if (!ls.soldAt || !ls.lotLinks) continue
        for (const lk of ls.lotLinks) {
          const lot = lotMap.get(lk.lotId)
          if (lot) cycleDays.push((new Date(ls.soldAt!).getTime() - new Date(lot.timestamp).getTime()) / 86400000)
        }
      }
      const avgCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : null

      // ROI
      const soldWithBuy = soldListings.filter(l => l.buyPrice != null)
      const totalRevenue = soldWithBuy.reduce((a, l) => a + l.listPrice * (l.coveredQty || l.qty), 0)
      const totalCost = soldWithBuy.reduce((a, l) => a + l.buyPrice! * (l.coveredQty || l.qty), 0)
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
  }, [data?.items])

  /* ── SELL TIME DATA (extracted from IIFE) ── */
  const sellTimeData = useMemo(() => {
    const rows = performanceAnalytics.byItem
      .filter(r => r.avgSell != null)
      .map(r => ({ name: r.name, days: r.avgSell!, ms: r.avgSell! * 86400000 }))
      .sort((a, b) => b.days - a.days)
    if (!rows.length) return null
    const avgDays = rows.reduce((a, r) => a + r.days, 0) / rows.length
    const chartData = rows.map(r => ({ name: r.name, giorni: Math.round(r.days * 10) / 10 }))
    return { rows, avgDays, chartData }
  }, [performanceAnalytics])

  /* ── STAGING TIME DATA (extracted from IIFE) ── */
  const stagingTimeData = useMemo(() => {
    if (!magazzinoOverview.rows.length) return null
    const stagingMap: Record<string, { name: string; ageDays: number; ageMs: number }> = {}
    const stagingAll: Record<string, number[]> = {}
    for (const r of magazzinoOverview.rows) {
      if (!stagingAll[r.name]) stagingAll[r.name] = []
      stagingAll[r.name].push(r.ageDays)
      if (!stagingMap[r.name] || r.ageDays > stagingMap[r.name].ageDays) {
        stagingMap[r.name] = { name: r.name, ageDays: r.ageDays, ageMs: Date.now() - new Date(r.lot.timestamp).getTime() }
      }
    }
    const rows = Object.values(stagingMap).map((r) => {
      const all = stagingAll[r.name]
      const avg = all.reduce((a: number, b: number) => a + b, 0) / all.length
      return { ...r, avgDays: avg }
    }).sort((a, b) => b.ageDays - a.ageDays)
    if (!rows.length) return null
    const globalAvg = rows.reduce((a, r) => a + r.ageDays, 0) / rows.length
    const chartData = rows.map(r => ({ name: r.name, giorni: Math.round(r.ageDays * 10) / 10, media: Math.round(r.avgDays * 10) / 10 }))
    return { rows, globalAvg, chartData }
  }, [magazzinoOverview])

  /* ── NOS DOLLARI — items with category "Item Shop ND" ── */
  const ndItems = useMemo((): NdItemsResult => {
    if (!data) return { list: [], profitable: 0, losing: 0, bestProfit: null }
    const rate = data.ndRate || 0
    const list: NdItem[] = Object.keys(data.items || {})
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
    const best       = list.filter(r => r.profit != null).sort((a,b) => (b.profit ?? 0) - (a.profit ?? 0))[0]
    return { list, profitable, losing, bestProfit: best ? best.profit : null }
  }, [data?.items, data?.ndRate, globalNdDisc])

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
      const signal     = signalCache[name] || getSignal(it, data.signalConfig)

      const openLots   = ls.filter(l => !l.sold)
      const stockQty   = openLots.reduce((a,l) => a+l.qty, 0)
      const stockValue = openLots.reduce((a,l) => a+l.qty*l.price, 0)

      const activeL    = lsList.filter(l => !l.sold)
      const bazarQty   = activeL.reduce((a,l) => a+l.qty, 0)
      const bazarValue = activeL.reduce((a,l) => a+l.qty*l.listPrice, 0)

      const soldBuy    = lsList.filter(l => l.sold && l.buyPrice != null)
      const totalRevenue = soldBuy.reduce((a,l) => a + l.listPrice * (l.coveredQty || l.qty), 0)
      const totalCostA  = soldBuy.reduce((a,l) => a + l.buyPrice! * (l.coveredQty || l.qty), 0)
      const totalTaxA   = soldBuy.reduce((a,l) => a + (l.tax || 0), 0)
      const totalProfit = totalRevenue - totalCostA - totalTaxA
      const roiPct     = totalCostA > 0 ? (totalProfit / totalCostA) * 100 : null

      const soldL      = lsList.filter(l => l.sold)
      const avgSellMs  = soldL.length
        ? soldL.reduce((a,l) => a + (new Date(l.soldAt!).getTime() - new Date(l.listedAt).getTime()), 0) / soldL.length
        : null

      const trend7 = calcTrend(ps, trendDays)
      const vol    = calcVolatility(ps)
      return { name, current, signal, stockQty, stockValue, bazarQty, bazarValue, roiPct, avgSellMs, totalProfit, priceCount: ps.length, trend7, vol }
    })
  }, [data?.items, data?.signalConfig, itemNames, signalCache, trendDays])

  /* ── SIDEBAR CARD STATS (memoized) ── */
  const sideStatsMap = useMemo(() => {
    const defaults = { last: null as number | null | undefined, trend: null as string | null, tColor: C.flat, openQty: 0, count: 0, isEsaurito: false }
    const map: Record<string, typeof defaults> = {}
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
    return map as Record<string, typeof defaults>
  }, [data?.items, itemNames, trendDays])

  /* ── ACTIONS ── */
  const addItem = () => {
    const n = newName.trim()
    if (!n || data!.items[n]) return
    const cat = newCat !== "—" ? newCat : undefined
    upd({ ...data!, items: { ...data!.items, [n]: { meta: { category: cat }, prices: [], lots: [], listings: [] } } })
    setNewName(""); setNewCat("—")
    setSelItem(n); setPage("item"); setSubPage("prices")
  }

  const recordPrice = () => {
    const price = parseG(pVal)
    if (!selItem || isNaN(price) || price <= 0) return
    // Anomaly check: usa dataRef per dati freschi
    const pre = dataRef.current || data!
    const prePrices = pre.items[selItem!]?.prices || []
    const realPrices = prePrices.filter(p => !p.esaurito)
    if (realPrices.length >= 3) {
      const avg    = realPrices.reduce((a, p) => a + p.price!, 0) / realPrices.length
      const devPct = Math.abs(price - avg) / avg
      if (devPct > 0.40) {
        const dir = price > avg ? "sopra" : "sotto"
        if (!safeConfirm(`⚠️ Prezzo anomalo!\n\n${fmtG(Math.round(price))} è ${(devPct*100).toFixed(0)}% ${dir} la media storica (${fmtG(Math.round(avg))}).\n\nConfermi questo prezzo?`)) return
      }
    }
    // Ri-leggi dataRef DOPO il confirm (il dialog blocca il thread, lo stato potrebbe essere cambiato)
    const d = dataRef.current || data!
    const curPrices = d.items[selItem!]?.prices || []
    const entry: PriceEntry = { price: Math.round(price), timestamp: new Date().toISOString(), eventId: curEventId, note: pNote.trim() }
    const it = { ...d.items[selItem!], prices: [...curPrices, entry] }
    upd({ ...d, items: { ...d.items, [selItem!]: it } })
    setPVal(""); setPNote("")
  }

  const recordEsaurito = () => {
    if (!selItem) return
    const d = dataRef.current || data!
    const curPrices = d.items[selItem]?.prices || []
    // Non aggiungere doppio esaurito consecutivo
    if (curPrices.length && curPrices[curPrices.length-1].esaurito) return
    const entry: PriceEntry = { price: null, esaurito: true, timestamp: new Date().toISOString(), eventId: curEventId, note: "" }
    const it = { ...d.items[selItem], prices: [...curPrices, entry] }
    upd({ ...d, items: { ...d.items, [selItem]: it } })
  }

  const delPrice = useCallback((idx: number) => {
    if (!safeConfirm("Eliminare questa registrazione di prezzo?")) return
    const d = dataRef.current!
    const si = selItemRef.current!
    const curPrices = d.items[si]?.prices || []
    const it = { ...d.items[si], prices: curPrices.filter((_: PriceEntry, i: number) => i !== idx) }
    upd({ ...d, items: { ...d.items, [si]: it } })
  }, [upd])

  const recordLot = () => {
    const qty   = parseInt(lQty, 10)
    const price = parseG(lPrice)
    if (!selItem || isNaN(qty) || qty <= 0 || qty > 999 || isNaN(price) || price <= 0) return
    const roundedPrice = Math.round(price)
    // Anomaly check: se il prezzo devia >40% dalla media storica, chiedi conferma
    const realPrices = prices.filter(p => !p.esaurito)
    if (realPrices.length >= 3) {
      const avg    = realPrices.reduce((a, p) => a + p.price!, 0) / realPrices.length
      const devPct = Math.abs(roundedPrice - avg) / avg
      if (devPct > 0.40) {
        const dir = roundedPrice > avg ? "sopra" : "sotto"
        if (!safeConfirm(`⚠️ Prezzo acquisto anomalo!\n\n${fmtG(roundedPrice)} è ${(devPct*100).toFixed(0)}% ${dir} la media storica (${fmtG(Math.round(avg))}).\n\nConfermi questo prezzo?`)) return
      }
    }
    // Se esiste un lotto aperto con lo stesso prezzo e c'è spazio, somma le quantità
    const existingIdx = lots.findIndex(l => !l.sold && l.price === roundedPrice)
    if (existingIdx !== -1 && lots[existingIdx].qty + qty <= 999) {
      const updatedLots = lots.map((l, i) => i === existingIdx ? { ...l, qty: l.qty + qty } : l)
      const it = { ...data!.items[selItem!], lots: updatedLots }
      upd({ ...data!, items: { ...data!.items, [selItem!]: it } })
      setLQty(""); setLPrice("")
      return
    }
    // Altrimenti crea un nuovo lotto (anche se stesso prezzo — non c'è spazio per il merge)
    const lot: Lot = { id: Date.now() + '_' + Math.random().toString(36).slice(2,6), qty, price: roundedPrice, timestamp: new Date().toISOString(), eventId: curEventId, note: "", sold: false }
    const it  = { ...data!.items[selItem!], lots: [...lots, lot] }
    upd({ ...data!, items: { ...data!.items, [selItem!]: it } })
    setLQty(""); setLPrice("")
  }

  const delLot = useCallback((idx: number) => {
    const d = dataRef.current!
    const si = selItemRef.current!
    const curLots = d.items[si]?.lots || []
    const curListings = d.items[si]?.listings || []
    const lot = curLots[idx]
    const linkedListings = curListings.filter((l: Listing) => !l.sold && l.lotLinks?.some(lk => lk.lotId === lot.id))
    if (linkedListings.length > 0) {
      if (!safeConfirm(`Questo lotto è collegato a ${linkedListings.length} listing attiv${linkedListings.length===1?"o":"i"}. Eliminare comunque?`)) return
    }
    const cleanedListings = curListings.map((l: Listing) => {
      if (l.sold || !l.lotLinks) return l
      const cleaned = l.lotLinks.filter(lk => lk.lotId !== lot.id)
      if (cleaned.length === l.lotLinks.length) return l
      const removedQty = l.lotLinks.filter(lk => lk.lotId === lot.id).reduce((a: number, lk) => a + lk.qty, 0)
      const newCovered = Math.max(0, (l.coveredQty || 0) - removedQty)
      const newCost = cleaned.reduce((a: number, lk) => a + lk.qty * lk.unitPrice, 0)
      return { ...l, lotLinks: cleaned, coveredQty: newCovered, totalCost: newCost, buyPrice: newCovered > 0 ? Math.round(newCost / newCovered) : null }
    })
    const it = { ...d.items[si], lots: curLots.filter((_: Lot, i: number) => i !== idx), listings: cleanedListings }
    upd({ ...d, items: { ...d.items, [si]: it } })
  }, [upd])

  const delItem = useCallback((name: string) => {
    if (!safeConfirm(`Eliminare "${name}" e tutti i suoi dati?`)) return
    const d = dataRef.current!
    const items = { ...d.items }
    delete items[name]
    upd({ ...d, items })
    setSelItem(Object.keys(items).sort((a, b) => a.localeCompare(b))[0] || null)
    setPage("dashboard")
  }, [upd])

  const renameItem = useCallback((oldName: string, newVal: string) => {
    const trimmed = newVal.trim()
    if (!trimmed || trimmed === oldName) { setRenaming(false); return }
    const d = dataRef.current!
    if (d.items[trimmed]) { alert(`Esiste già un item chiamato "${trimmed}"`); return }
    const items = { ...d.items }
    items[trimmed] = items[oldName]
    delete items[oldName]
    upd({ ...d, items })
    setSelItem(trimmed)
    setRenaming(false)
    setRenameVal("")
  }, [upd])

  const copyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopyFlash(true)
    copyTimer.current = setTimeout(() => setCopyFlash(false), 1200)
  }, [])

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
    const it = { ...data!.items[selItem!], lots: updatedLots, listings: [...listings, entry] }
    upd({ ...data!, items: { ...data!.items, [selItem!]: it } })
    setLsQty(""); setLsPrice(""); setLsTax("")
  }

  const markListingSold = useCallback((idx: number, soldQty?: number) => {
    const d = dataRef.current!
    const si = selItemRef.current!
    const curLots = d.items[si]?.lots || []
    const curListings = d.items[si]?.listings || []
    const result = processListingSold(si, curLots, curListings, idx, soldQty)
    if (!result) return
    const it = { ...d.items[si], lots: result.lots, listings: result.listings }
    upd({ ...d, items: { ...d.items, [si]: it } })
    setPartialIdx(null)
    setPartialQty("")
  }, [upd])

  const markBazarListingSold = useCallback((itemName: string, listingIdx: number, soldQty?: number) => {
    const d = dataRef.current!
    const it = d.items[itemName]
    if (!it) return
    const result = processListingSold(itemName, it.lots || [], it.listings || [], listingIdx, soldQty)
    if (!result) return
    upd({ ...d, items: { ...d.items, [itemName]: { ...it, lots: result.lots, listings: result.listings } } })
    setBazarPartialKey(null)
    setBazarPartialQty("")
  }, [upd])

  const delListing = useCallback((idx: number) => {
    const d = dataRef.current!
    const si = selItemRef.current!
    const curLots = d.items[si]?.lots || []
    const curListings = d.items[si]?.listings || []
    const listing = curListings[idx]
    const updatedLots = curLots.map((l: Lot) => ({ ...l }))
    if (listing.lotsConsumed && !listing.sold && listing.lotLinks) {
      for (const link of listing.lotLinks) {
        const lotIdx = updatedLots.findIndex((l: Lot) => l.id === link.lotId)
        if (lotIdx !== -1) {
          if (updatedLots[lotIdx].sold) {
            updatedLots[lotIdx].sold = false
            updatedLots[lotIdx].qty = link.qty
          } else {
            updatedLots[lotIdx].qty += link.qty
          }
        }
      }
    }
    const it = { ...d.items[si], lots: updatedLots, listings: curListings.filter((_: Listing, i: number) => i !== idx) }
    upd({ ...d, items: { ...d.items, [si]: it } })
  }, [upd])

  const saveTargets = () => {
    const buyT  = tBuy.trim()  ? parseG(tBuy)  : null
    const sellT = tSell.trim() ? parseG(tSell) : null
    const meta  = { ...data!.items[selItem!].meta, buyTarget: buyT ?? undefined, sellTarget: sellT ?? undefined }
    const it    = { ...data!.items[selItem!], meta }
    upd({ ...data!, items: { ...data!.items, [selItem!]: it } })
    setShowTargetEdit(false)
  }

  const quickSave = () => {
    const price = parseG(qPrice)
    const cur = qItemRef.current
    if (!cur || isNaN(price) || price <= 0) return
    const d = dataRef.current || data!
    const entry: PriceEntry = { price: Math.round(price), timestamp: new Date().toISOString(), eventId: curEventId, note: "" }
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

  const sortAnalysis = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => -d); return prev }
      setSortDir(1)
      return col
    })
  }, [])

  const exportCSV = useCallback(async () => {
    const d = dataRef.current!
    const si = selItemRef.current!
    const ps = d.items[si]?.prices || []
    const r = await api.exportCsv({ name: si, entries: ps.filter((p: PriceEntry) => !p.esaurito) })
    if (r.ok) alert(`Esportato: ${r.path}`)
  }, [])

  /* ── DASHBOARD CARDS (memoized) ── */
  const dashboardCards = useMemo(() => {
    if (!data) return []
    return itemNames.map(name => {
      const it      = data.items[name]
      const ps      = it.prices || []
      const ls      = it.lots   || []
      const lsList  = it.listings || []
      const sig     = signalCache[name] || getSignal(it, data.signalConfig)
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
      const sellTimes  = soldL.map(l=>new Date(l.soldAt!).getTime()-new Date(l.listedAt).getTime())
      const avgMs      = sellTimes.length ? sellTimes.reduce((a,b)=>a+b,0)/sellTimes.length : null
      const buyT   = it.meta?.buyTarget ?? undefined
      const sellT  = it.meta?.sellTarget ?? undefined
      const trend7 = calcTrend(ps, trendDays)
      return { name, ps, ls, lsList, sig, last, prev, trend, tCol, openQty, spent, estProfit, activeQtyL, avgMs, buyT, sellT, trend7 }
    })
  }, [data?.items, itemNames, signalCache, trendDays])

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
      rows = rows.filter(r => group.types!.includes(r.signal.type))
    }
    return [...rows].sort((a,b) => {
      let va = (a as any)[sortCol], vb = (b as any)[sortCol]
      if (sortCol === "signal") { va = a.signal.diffPct ?? 0; vb = b.signal.diffPct ?? 0 }
      if (sortCol === "trend7") { va = a.trend7?.pct ?? null; vb = b.trend7?.pct ?? null }
      if (sortCol === "vol")    { va = a.vol?.cv    ?? null; vb = b.vol?.cv    ?? null }
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === "string") return va.localeCompare(vb) * sortDir
      return (va - vb) * sortDir
    })
  }, [analysisRows, sortCol, sortDir, analSearch, analSignalFilter])

  /* ── CONTEXT MEMOS (must be before early return to respect Rules of Hooks) ── */
  const navCtx = useMemo(() => ({ page, setPage, subPage, setSubPage, selItem, setSelItem }), [page, subPage, selItem])
  const dataCtx = useMemo(() => ({ data: data!, upd }), [data, upd])
  const themeCtx = useMemo(() => ({ theme, setTheme }), [theme])

  /* ── LOADING ── */
  if (!data) return (
    <div className={a.loadingScreen} style={{ WebkitAppRegion:"drag" }}>
      <div className={a.loadingSpinner}/>
      <div className={a.loadingText}>CARICAMENTO</div>
    </div>
  )

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */

  return (
    <ThemeContext.Provider value={themeCtx}>
    <DataContext.Provider value={dataCtx}>
    <NavigationContext.Provider value={navCtx}>
    <div className={a.root}>
      {/* ══ TITLEBAR ══ */}
      <div className={a.titlebar} style={{ WebkitAppRegion:"drag" }}>
        <span className={a.titlebarLogo}>⚔️</span>
        <span className={a.titlebarTitle}>NOSTALE TRACKER</span>
        <span className={a.titlebarVersion}>v{appVersion}</span>
        {saveStatus === "error" && <span className={a.saveError} style={{ WebkitAppRegion:"no-drag" }}>⚠ ERRORE SALVATAGGIO</span>}
        {saveStatus === "saving" && <span className={a.saveSaving} style={{ WebkitAppRegion:"no-drag" }}>💾</span>}
        {saveStatus === "ok" && <span className={a.saveOk} style={{ WebkitAppRegion:"no-drag" }}>✓</span>}

        <button onClick={()=>setPage("analisi")} title="Analisi comparativa item"
          className={a.titlebarBtn}
          style={{ background:page==="analisi"?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${page==="analisi"?C.gold:`${C.gold}55`}`, color:page==="analisi"?C.gold:C.muted, WebkitAppRegion:"no-drag" }}>
          📊 Analisi
        </button>

        <div className={a.titlebarSpacer}/>

        <button onClick={openQuick} title="Quick-add prezzi (Ctrl+Q)"
          className={a.titlebarBtnQuick}
          style={{ background:showQuick?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${showQuick?C.gold:`${C.gold}55`}`, color:C.gold, WebkitAppRegion:"no-drag" }}>
          ⚡ Prezzo Rapido
        </button>

        <button onClick={()=>setPage("bazar")} title="Listing attivi al bazar"
          className={a.titlebarBtnFlex}
          style={{ background:page==="bazar"?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${page==="bazar"?C.gold:`${C.gold}55`}`, color:C.gold, WebkitAppRegion:"no-drag" }}>
          🏷️ Bazar
        </button>

        <button onClick={()=>setPage("magazzino")} title="Magazzino globale — stock e aging"
          className={a.titlebarBtnFlex}
          style={{ background:page==="magazzino"?`${C.blue}2e`:`${C.blue}14`, border:`1px solid ${page==="magazzino"?C.blue:`${C.blue}55`}`, color:C.blue, WebkitAppRegion:"no-drag" }}>
          📦 Magazzino
        </button>

        <button onClick={()=>setPage("crafting")} title="Gestione ricette crafting"
          className={a.titlebarBtnFlex}
          style={{ background:page==="crafting"?`${C.orange}2e`:`${C.orange}14`, border:`1px solid ${page==="crafting"?C.orange:`${C.orange}55`}`, color:C.orange, WebkitAppRegion:"no-drag" }}>
          🔨 Crafting
        </button>

        <button onClick={()=>setPage("nd")} title="Calcolo costo Nos Dollari in gold"
          className={a.titlebarBtnFlex}
          style={{ background:page==="nd"?`${C.purple}2e`:`${C.purple}14`, border:`1px solid ${page==="nd"?C.purple:`${C.purple}55`}`, color:C.purple, WebkitAppRegion:"no-drag" }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" fill={C.purple} stroke={C.purple} strokeWidth="1.5"/>
            <text x="10" y="14.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" fontFamily="monospace">$</text>
          </svg>
          Nos Dollari
        </button>

        <button onClick={()=>setShowSettings(true)} title="Impostazioni"
          className={a.titlebarBtn}
          style={{ background:showSettings?`${C.gold}2e`:`${C.gold}14`, border:`1px solid ${showSettings?C.gold:`${C.gold}55`}`, color:showSettings?C.gold:C.muted, WebkitAppRegion:"no-drag" }}>
          ⚙️ Settings
        </button>

        {/* window controls */}
        <div className={a.winControls} style={{ WebkitAppRegion:"no-drag" }}>
          {[
            { l:"−", a:()=>api.winMinimize(), h:C.muted },
            { l:"□", a:()=>api.winMaximize(), h:C.muted },
            { l:"✕", a:()=>api.winClose(),    h:C.red   },
          ].map(b => (
            <button key={b.l} onClick={b.a} className={a.winBtn} style={{ color:b.h }}>{b.l}</button>
          ))}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className={a.body}>

        {/* ── SIDEBAR ── */}
        <div className={a.sidebar} style={{ width:sidebarW }}>
          {/* resize handle */}
          <div
            onMouseDown={e => {
              e.preventDefault()
              sideResizing.current = true
              const startX = e.clientX
              const startW = sidebarW
              const onMove = (ev: MouseEvent) => { if (sideResizing.current) setSidebarW(Math.max(180, Math.min(400, startW + ev.clientX - startX))) }
              const onUp = () => { sideResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
              window.addEventListener("mousemove", onMove)
              window.addEventListener("mouseup", onUp)
            }}
            className={a.sidebarResize}
          />

          {/* top nav */}
          <div className={a.sidebarNav}>
            {([["dashboard","🏠"],["new","＋"]] as const).map(([t,l]) => (
              <div key={t} onClick={()=>setPage(t)} className={a.sidebarNavItem} style={{ color:page===t?C.gold:C.muted, borderBottom:`2px solid ${page===t?C.gold:"transparent"}` }}>{l}</div>
            ))}
          </div>

          {page === "new" ? (
            /* ── NEW ITEM FORM ── */
            <div className={`up ${a.newItemForm}`}>
              <div className={a.formLabel}>NOME ITEM</div>
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="es. Amuleto Elementale" style={inp()}/>
              <div className={a.formLabelNoMargin}>CATEGORIA</div>
              <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={inp()}>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addItem} disabled={!newName.trim()} style={{ ...pill(!!newName.trim()), marginTop:4, padding:"10px" }}>AGGIUNGI ITEM</button>
            </div>
          ) : (
            /* ── ITEM LIST ── */
            <>
              <div className={a.sidebarSearch}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 cerca item..." style={inp({ padding:"6px 10px", fontSize:11 })}/>
                <div className={a.sortRow}>
                  {[["name","A-Z"],["price","Prezzo"],["signal","Segnale"]].map(([k,l]) => (
                    <button key={k} onClick={()=>setSideSort(k)}
                      className={a.sortBtn}
                      style={{ background:sideSort===k?C.gold:"transparent", color:sideSort===k?C.pillTxt:C.muted, border:`1px solid ${sideSort===k?C.gold:C.border}` }}>
                      {l}
                    </button>
                  ))}
                </div>
                <select value={sideCategory} onChange={e=>setSideCategory(e.target.value)} style={inp({ padding:"4px 7px", fontSize:12 })}>
                  <option value="__all__">Tutte le categorie</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={a.itemList}>
                {filtered.length === 0 && (
                  <div className={a.emptyList}>
                    {itemNames.length === 0 ? "Aggiungi il primo item →" : "Nessun risultato"}
                  </div>
                )}
                {filtered.map(name => {
                  const { last, trend, tColor, openQty, count, isEsaurito } = sideStatsMap[name] ?? { last: null, trend: null, tColor: C.flat, openQty: 0, count: 0, isEsaurito: false }
                  const active = selItem === name && page === "item"
                  const sig    = signalCache[name] || { type:"nodata", color:"#5a6a8a", icon:"·", label:"" }
                  const cat    = data?.items?.[name]?.meta?.category
                  return (
                    <div key={name} className={`si ${a.sideItem}`}
                      onClick={()=>{ setSelItem(name); setPage("item"); setSubPage("prices"); if(allDays.length) setChartDay(allDays[0]); copyName(name) }}
                      style={{ background:active?`${C.gold}1a`:"transparent", border:`1px solid ${active?C.gold+"55":isEsaurito?C.purple+"33":"transparent"}`, borderLeft:`3px solid ${sig.color}44` }}>
                      <div className={a.sideItemRow}>
                        <span className={a.sideItemName} style={{ color:active?C.gold:C.text, fontWeight:active?700:400, maxWidth:sidebarW - 100 }}>{name}</span>
                        {isEsaurito
                          ? <span className={a.sideItemEsaurito}>📭</span>
                          : sig.type !== "nodata" && <span className={a.sideItemSignal} style={{ color:sig.color }}>{sig.icon}</span>}
                      </div>
                      <div className={a.sideItemPriceRow}>
                        <span className={a.sideItemPrice} style={{ color:isEsaurito?C.purple:C.muted }}>{last != null ? fmtG(last) : "—"}</span>
                        <div className={a.sideItemBadges}>
                          {openQty > 0 && <span className={a.sideItemQty}>×{openQty}</span>}
                          {!isEsaurito && <span className={a.sideItemTrend} style={{ color:tColor }}>{trend}</span>}
                        </div>
                      </div>
                      <div className={a.sideItemMeta}>
                        {count} prezzi{cat ? ` · ${cat}` : ""}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={a.sidebarFooter}>
                <span>{itemNames.length} item</span>
                <span>{Object.values(data.items).reduce((a,it)=>a+(it.prices?.length||0),0)} prezzi</span>
              </div>
            </>
          )}
        </div>

        {/* ══ MAIN ══ */}
        <div className={a.main}>

          {/* ── DASHBOARD ── */}
          {page === "dashboard" && <Dashboard itemNames={itemNames} capitalOverview={capitalOverview} dashboardCards={dashboardCards}/>}

          {/* ── ANALISI PAGE ── */}
          {page === "analisi" && <Analisi itemNames={itemNames} analysisRows={analysisRows} sortedAnalysis={sortedAnalysis} analSearch={analSearch} setAnalSearch={setAnalSearch} analSignalFilter={analSignalFilter} setAnalSignalFilter={setAnalSignalFilter} sortCol={sortCol} sortDir={sortDir} sortAnalysis={sortAnalysis} analNameW={analNameW} setAnalNameW={setAnalNameW} analResizing={analResizing}/>}

          {/* ── BAZAR PAGE ── */}
          {page === "bazar" && <Bazar bazarOverview={bazarOverview} bazarPartialKey={bazarPartialKey} setBazarPartialKey={setBazarPartialKey} bazarPartialQty={bazarPartialQty} setBazarPartialQty={setBazarPartialQty} markBazarListingSold={markBazarListingSold} performanceAnalytics={performanceAnalytics} sellTimeData={sellTimeData}/>}

          {/* ── MAGAZZINO PAGE ── */}
          {page === "magazzino" && <Magazzino magazzinoOverview={magazzinoOverview} performanceAnalytics={performanceAnalytics} stagingTimeData={stagingTimeData}/>}

          {/* ── CRAFTING PAGE ── */}
          {page === "crafting" && <Crafting/>}

          {/* ── NOS DOLLARI PAGE ── */}
          {page === "nd" && <NdCalc ndRateInput={ndRateInput} setNdRateInput={setNdRateInput} ndBuyQty={ndBuyQty} setNdBuyQty={setNdBuyQty} globalNdDisc={globalNdDisc} setGlobalNdDisc={setGlobalNdDisc} allNdDiscounts={allNdDiscounts} ndItems={ndItems}/>}

          {/* ── ITEM VIEW ── */}
          {page === "item" && selItem && <ItemView
            renaming={renaming} setRenaming={setRenaming} renameVal={renameVal} setRenameVal={setRenameVal} renameItem={renameItem} copyName={copyName} copyFlash={copyFlash}
            item={item ?? null} prices={prices} lots={lots} listings={listings}
            allStats={allStats} dayStats={dayStats} multiDayChart={multiDayChart} chartDay={chartDay} setChartDay={setChartDay} chartPoints={chartPoints} allDays={allDays} trendDays={trendDays}
            allEVT={allEVT} allCategories={allCategories} signalCache={signalCache} getSignal={getSignal}
            pVal={pVal} setPVal={setPVal} recordPrice={recordPrice} recordEsaurito={recordEsaurito} delPrice={delPrice} delItem={delItem}
            lQty={lQty} setLQty={setLQty} lPrice={lPrice} setLPrice={setLPrice} recordLot={recordLot} delLot={delLot}
            lsQty={lsQty} setLsQty={setLsQty} lsPrice={lsPrice} setLsPrice={setLsPrice} lsTax={lsTax} setLsTax={setLsTax} addListing={addListing} delListing={delListing}
            lotPreview={lotPreview} lotStats={lotStats} listingStats={listingStats}
            partialIdx={partialIdx} setPartialIdx={setPartialIdx} partialQty={partialQty} setPartialQty={setPartialQty} markListingSold={markListingSold}
            exportCSV={exportCSV} showTargetEdit={showTargetEdit} setShowTargetEdit={setShowTargetEdit}
          />}

        </div>
      </div>

      {/* ══ SETTINGS MODAL ══ */}
      {showSettings && (
        <Modal open={showSettings} onClose={() => setShowSettings(false)} width="80%" height="80%" maxWidth="900px" maxHeight="700px" innerStyle={{ display:"flex" }}>

            {/* Sidebar sinistra */}
            <div className={a.settingsSidebar}>
              <div className={a.settingsSidebarTitle}>⚙️ SETTINGS</div>
              {[
                { k:"salvataggio",    l:"💾 Salvataggio" },
                { k:"strategia",      l:"📊 Strategia"   },
                { k:"personalizza",   l:"🎨 Personalizza" },
                { k:"tema",           l:"🌗 Tema" },
              ].map(({ k, l }) => (
                <div key={k} onClick={()=>setSettingsCategory(k)}
                  className={a.settingsNavItem}
                  style={{ color:settingsCategory===k?C.gold:C.muted, background:settingsCategory===k?`${C.gold}1a`:"transparent", borderLeft:`3px solid ${settingsCategory===k?C.gold:"transparent"}`, fontWeight:settingsCategory===k?700:400 }}>
                  {l}
                </div>
              ))}
              <div className={a.settingsSidebarSpacer}/>
              <div className={a.settingsCloseWrap}>
                <button onClick={()=>setShowSettings(false)} className={a.settingsCloseBtn}>Chiudi</button>
              </div>
            </div>

            {/* Area contenuto destra */}
            <div className={a.settingsContent}>

              {/* ── SALVATAGGIO ── */}
              {settingsCategory === "salvataggio" && (
                <div className="up">
                  <div className={a.settingsTitle}>💾 SALVATAGGIO</div>

                  <div className={a.settingsStack}>
                    {/* Stato salvataggio */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>STATO SALVATAGGIO</div>
                      <div className={a.saveStatusRow}>
                        <span className={a.saveStatusIcon}>{saveStatus==="saving"?"⏳":saveStatus==="ok"?"✅":saveStatus==="error"?"⚠️":"💾"}</span>
                        <div>
                          <div className={a.saveStatusLabel} style={{ color:saveStatus==="saving"?C.gold:saveStatus==="ok"?C.green:saveStatus==="error"?C.red:C.text }}>
                            {saveStatus==="saving"?"Salvataggio in corso...":saveStatus==="ok"?"Salvato con successo":saveStatus==="error"?"Errore di salvataggio":"Pronto"}
                          </div>
                          <div className={a.saveStatusDate}>Data: {todayStr()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Path dati */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>PERCORSO DATI</div>
                      <div className={a.dataPathText}>{dataPath}</div>
                      <button onClick={()=>api.openDataFolder()} style={{ ...pill(false, C.gold, { padding:"6px 14px", fontSize:12 }) }}>📁 Apri cartella dati</button>
                    </div>

                    {/* Info */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>INFORMAZIONI</div>
                      <div className={a.infoStack}>
                        <div>Versione: <b className={a.infoBold}>v{appVersion}</b></div>
                        <div>Salvataggio automatico con backup (data.backup.json)</div>
                        <div>Item tracciati: <b className={a.infoBold}>{Object.keys(data?.items || {}).length}</b></div>
                        <div>Prezzi registrati: <b className={a.infoBold}>{Object.values(data?.items || {}).reduce((a,it)=>a+(it.prices?.length||0),0)}</b></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STRATEGIA ── */}
              {settingsCategory === "strategia" && (
                <div className="up">
                  <div className={a.settingsTitleNarrow}>📊 STRATEGIA — CONFIGURAZIONE SEGNALI</div>
                  <div className={a.settingsSubtitle}>
                    Configura le soglie percentuali per i segnali di trading. I segnali vengono calcolati confrontando il prezzo attuale con la media storica dell'item.
                  </div>

                  <div className={a.settingsStackNarrow}>
                    {[
                      { k:"strongBuy",  label:"FORTE COMPRA",  icon:"🟢", desc:"Prezzo molto sotto la media", color:"#10b981", suffix:"% sotto media" },
                      { k:"buy",        label:"COMPRA",        icon:"🟢", desc:"Prezzo sotto la media",       color:"#34d399", suffix:"% sotto media" },
                      { k:"high",       label:"SOPRA MEDIA",   icon:"🟠", desc:"Prezzo sopra la media",       color:"#f97316", suffix:"% sopra media" },
                      { k:"overpriced", label:"TROPPO CARO",   icon:"🔴", desc:"Prezzo molto sopra la media", color:"#ef4444", suffix:"% sopra media" },
                      { k:"sell",       label:"VENDI",         icon:"🔵", desc:"Prezzo sopra il costo medio di acquisto", color:"#3b82f6", suffix:"% sopra costo acq." },
                    ].map(s => {
                      const cfg = data?.signalConfig || SIGNAL_DEFAULTS
                      const val = (cfg as unknown as Record<string, number>)[s.k] ?? (SIGNAL_DEFAULTS as unknown as Record<string, number>)[s.k]
                      return (
                        <div key={s.k} className={a.signalRow} style={{ background:C.inputBg, border:`1px solid ${s.color}33`, borderRadius:10, padding:"14px 18px" }}>
                          <span className={a.signalIcon}>{s.icon}</span>
                          <div className={a.signalInfo}>
                            <div className={a.signalLabel} style={{ color:s.color }}>{s.label}</div>
                            <div className={a.signalDesc}>{s.desc}</div>
                          </div>
                          <div className={a.signalInputWrap}>
                            <input
                              type="number" min="1" max="99" step="1"
                              value={val}
                              onChange={e => {
                                const v = parseInt(e.target.value, 10)
                                if (isNaN(v) || v < 1 || v > 99) return
                                const newCfg = { ...(data?.signalConfig || SIGNAL_DEFAULTS), [s.k]: v }
                                upd({ ...data, signalConfig: newCfg })
                              }}
                              className={a.signalInput}
                              style={{ color:s.color }}
                            />
                            <span className={a.signalSuffix}>{s.suffix}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Reset defaults */}
                  <div className={a.resetRow}>
                    <button onClick={() => upd({ ...data, signalConfig: { ...SIGNAL_DEFAULTS } })}
                      style={{ ...pill(false, C.muted, { padding:"8px 16px", fontSize:12 }) }}>
                      Ripristina valori predefiniti
                    </button>
                    <span className={a.resetHint}>
                      Default: Forte Compra {SIGNAL_DEFAULTS.strongBuy}% · Compra {SIGNAL_DEFAULTS.buy}% · Sopra {SIGNAL_DEFAULTS.high}% · Caro {SIGNAL_DEFAULTS.overpriced}% · Vendi {SIGNAL_DEFAULTS.sell}%
                    </span>
                  </div>
                </div>
              )}

              {/* ── PERSONALIZZA ── */}
              {settingsCategory === "personalizza" && (
                <div className="up">
                  <div className={a.settingsTitle}>🎨 PERSONALIZZA</div>

                  <div className={a.settingsStackWide}>
                    {/* Trend days */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>GIORNI TREND</div>
                      <div className={a.settingsCardDesc}>Numero di giorni usati per calcolare la tendenza dei prezzi.</div>
                      <div className={a.pillChoices}>
                        {[3, 5, 7, 14, 30].map(d => (
                          <button key={d} onClick={() => upd({ ...data, trendDays: d })}
                            style={pill(trendDays === d, C.gold, { padding:"7px 14px", fontSize:13 })}>
                            {d} giorni
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Lot strategy */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>STRATEGIA LOTTI</div>
                      <div className={a.settingsCardDesc}>Come vengono abbinati i lotti dal magazzino quando crei un listing al bazar.</div>
                      <div className={a.pillChoices}>
                        {LOT_STRATEGIES.map(s => (
                          <button key={s.id} onClick={() => upd({ ...data, lotStrategy: s.id })}
                            style={pill(lotStrategy === s.id, C.gold, { padding:"7px 14px", fontSize:13 })}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom categories */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>CATEGORIE PERSONALIZZATE</div>
                      <div className={a.settingsCardDesc}>Aggiungi categorie extra oltre a quelle predefinite.</div>
                      <div className={a.chipRow}>
                        {(data?.customCategories || []).map(cat => (
                          <span key={cat} className={a.chip}>
                            {cat}
                            <button onClick={() => upd({ ...data, customCategories: (data.customCategories || []).filter(c => c !== cat) })}
                              className={a.chipRemove}>✕</button>
                          </span>
                        ))}
                      </div>
                      <div className={a.addRow}>
                        <input value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { const v = newCategoryInput.trim(); if (v && !allCategories.includes(v)) { upd({ ...data, customCategories: [...(data.customCategories || []), v] }); setNewCategoryInput("") } } }}
                          placeholder="Nuova categoria..." style={inp({ width:200, fontSize:13 })}/>
                        <button onClick={() => { const v = newCategoryInput.trim(); if (v && !allCategories.includes(v)) { upd({ ...data, customCategories: [...(data.customCategories || []), v] }); setNewCategoryInput("") } }}
                          style={pill(!!newCategoryInput.trim(), C.gold, { padding:"7px 14px", fontSize:12 })}>+ Aggiungi</button>
                      </div>
                    </div>

                    {/* Custom ND discounts */}
                    <div className={a.settingsCard}>
                      <div className={a.settingsCardLabel}>SCONTI ND PERSONALIZZATI</div>
                      <div className={a.settingsCardDesc}>Aggiungi percentuali di sconto extra per i NosDollari.</div>
                      <div className={a.ndDiscRow}>
                        {allNdDiscounts.map(d => {
                          const isCustom = !ND_DISCOUNTS.includes(d)
                          return (
                            <span key={d} className={a.ndDiscChip} style={{ background:isCustom ? `${C.gold}1a` : C.panel, border:`1px solid ${isCustom ? C.gold + "55" : C.border2}`, color:isCustom ? C.gold : C.muted }}>
                              {d}%
                              {isCustom && <button onClick={() => upd({ ...data, customNdDiscounts: (data.customNdDiscounts || []).filter(v => v !== d) })}
                                className={a.ndDiscRemove}>✕</button>}
                            </span>
                          )
                        })}
                      </div>
                      <div className={a.addRow}>
                        <input type="number" min="1" max="99" value={newNdDiscInput} onChange={e => setNewNdDiscInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { const v = parseInt(newNdDiscInput, 10); if (v > 0 && v < 100 && !allNdDiscounts.includes(v)) { upd({ ...data, customNdDiscounts: [...(data.customNdDiscounts || []), v] }); setNewNdDiscInput("") } } }}
                          placeholder="es. 35" style={inp({ width:100, fontSize:13 })}/>
                        <span className={a.ndPercent}>%</span>
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
                  <div className={a.settingsTitle}>🌗 TEMA</div>

                  <div className={a.settingsCard} style={{ padding:"20px 24px" }}>
                    <div className={a.settingsCardLabel} style={{ marginBottom:12 }}>SELEZIONA TEMA</div>
                    <div className={a.themeCardsRow}>
                      {[
                        { id:"dark",  label:"Dark Mode",  icon:"🌙", desc:"Tema scuro — ideale per sessioni notturne",  bg:"#13151f", fg:"#dde6f0", accent:"#e8a838" },
                        { id:"light", label:"Light Mode", icon:"☀️", desc:"Tema chiaro — migliore leggibilità di giorno", bg:"#e4e7ed", fg:"#111827", accent:"#a06510" },
                      ].map(t => (
                        <div key={t.id}
                          onClick={() => { setTheme(t.id); upd({ ...data, theme: t.id }) }}
                          className={a.themeCard}
                          style={{ border:`2px solid ${theme===t.id?C.gold:C.border2}`, background:theme===t.id?`${C.gold}11`:"transparent" }}>
                          <div className={a.themeCardHeader}>
                            <span className={a.themeCardIcon}>{t.icon}</span>
                            <div>
                              <div className={a.themeCardLabel} style={{ color:theme===t.id?C.gold:C.text }}>{t.label}</div>
                              <div className={a.themeCardDesc}>{t.desc}</div>
                            </div>
                          </div>
                          {/* preview */}
                          <div className={a.themePreview} style={{ background:t.bg, border:`1px solid ${theme===t.id?C.gold+"55":C.border}` }}>
                            <div className={a.themePreviewDots}>
                              <div className={a.themePreviewDot} style={{ background:"#ef4444" }}/>
                              <div className={a.themePreviewDot} style={{ background:"#f59e0b" }}/>
                              <div className={a.themePreviewDot} style={{ background:"#22c55e" }}/>
                            </div>
                            <div className={a.themePreviewBar1} style={{ background:t.accent }}/>
                            <div className={a.themePreviewBar2} style={{ background:t.fg+"33" }}/>
                            <div className={a.themePreviewBar3} style={{ background:t.fg+"22" }}/>
                          </div>
                          {theme === t.id && (
                            <div className={a.themeActiveLabel}>ATTIVO</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
        </Modal>
      )}

      {/* ══ QUICK-ADD MODAL ══ */}
      {showQuick && (
        <Modal open={showQuick} onClose={() => setShowQuick(false)} width={520} padding={24} zIndex={9999}>

            {/* header */}
            <div className={a.quickHeader}>
              <div>
                <div className={a.quickTitle}>⚡ QUICK-ADD</div>
              </div>
              <button onClick={()=>setShowQuick(false)} className={a.quickCloseBtn}>✕</button>
            </div>

            {/* form */}
            <div className={a.quickForm}>
              {/* item selector + copy */}
              <div>
                <div className={a.quickFieldLabel}>ITEM</div>
                <div className={a.quickItemRow}>
                  <select value={qItem} onChange={e=>{ setQItem(e.target.value); navigator.clipboard.writeText(e.target.value) }} style={{ ...inp(), fontSize:14, color:C.gold, flex:1 }}>
                    {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={()=>{ if(qItem) navigator.clipboard.writeText(qItem) }} title="Copia nome"
                    className={a.quickCopyBtn}>
                    ⎘
                  </button>
                </div>
                {qItem && (() => {
                  const ps = data?.items?.[qItem]?.prices || []
                  const lastP = ps.filter(p => !p.esaurito)
                  const last = lastP.length ? lastP[lastP.length-1] : null
                  return last ? (
                    <div className={a.quickLastPrice}>
                      Ultimo: <b style={{ color:C.gold }}>{fmtG(last.price)}</b> — {fmtFull(last.timestamp)}
                    </div>
                  ) : null
                })()}
              </div>

              {/* price + note row */}
              <div className={a.quickPriceRow}>
                <div className={a.quickPriceCol}>
                  <div className={a.quickFieldLabel}>PREZZO</div>
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
                    <div className={a.quickParseHint}>
                      = {parseG(qPrice).toLocaleString("it-IT")} ori · <span style={{ color:C.gold }}>{fmtG(parseG(qPrice))}</span>
                    </div>
                  )}
                </div>
                <div className={a.quickEventCol}>
                  <div className={a.quickFieldLabel}>EVENTO</div>
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
              <div className={a.recentSection}>
                <div className={a.recentLabel}>APPENA REGISTRATI</div>
                <div className={a.recentList}>
                  {qRecent.map((r, i) => (
                    <div key={i} className={a.recentRow}>
                      <span className={a.recentTime}>{fmtTime(new Date(r.ts))}</span>
                      <span className={a.recentName}>{r.name}</span>
                      <span className={a.recentPrice}>{fmtG(r.price)}</span>
                      <span className={a.recentSaved}>✓ salvato</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

        </Modal>
      )}
      {/* ══ UPDATE POPUP ══ */}
      {(updateStatus === "available" || updateStatus === "downloading" || updateStatus === "downloaded" || updateStatus === "error") && (
        <Modal open={true} width={400} maxWidth="90vw" padding={28} zIndex={9998} innerStyle={{ textAlign:"center" }}>

            {updateStatus === "available" && (<>
              <div className={a.updateIcon}>⬇️</div>
              <div className={a.updateTitle}>Aggiornamento disponibile</div>
              <div className={a.updateSubtitle}>Download in preparazione...</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"6px 16px", fontSize:12 }}>CHIUDI</button>
            </>)}

            {updateStatus === "downloading" && (<>
              <div className={a.updateIcon}>📥</div>
              <div className={a.updateDownloadTitle}>Download in corso...</div>
              <div className={a.updateProgress}>
                <div className={a.updateProgressBar} style={{ width:`${downloadPct}%` }}/>
              </div>
              <div className={a.updatePct}>{downloadPct}%</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"6px 16px", fontSize:12 }}>CHIUDI</button>
            </>)}

            {updateStatus === "downloaded" && (<>
              <div className={a.updateIcon}>✅</div>
              <div className={a.updateTitle}>Aggiornamento pronto!</div>
              <div className={a.updateSubtitleWide}>L'app verrà chiusa e riavviata con la nuova versione.</div>
              <button onClick={() => api.flushAndInstallUpdate(data)}
                style={{ ...pill(true, C.green), padding:"12px 28px", fontSize:15, letterSpacing:2 }}>
                🔄 AGGIORNA E RIAVVIA
              </button>
            </>)}

            {updateStatus === "error" && (<>
              <div className={a.updateIcon}>⚠️</div>
              <div className={a.updateTitleError}>Aggiornamento fallito</div>
              <div className={a.updateErrorText}>{updateError}</div>
              <button onClick={() => setUpdateStatus(null)}
                style={{ ...pill(false, C.muted), padding:"8px 20px", fontSize:13 }}>
                CHIUDI
              </button>
            </>)}

        </Modal>
      )}
    </div>
    </NavigationContext.Provider>
    </DataContext.Provider>
    </ThemeContext.Provider>
  )
}
