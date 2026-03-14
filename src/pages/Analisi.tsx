import React, { memo } from "react"
import { C, inp } from "../utils/theme"
import { fmtG, todayStr } from "../utils/formatting"
import { SIGNAL_GROUPS } from "../utils/constants"
import type { SignalGroup } from "../utils/constants"
import { useNav } from "../contexts/NavigationContext"
import type { Signal, TrendResult, Volatility } from "../types"
import VirtualList from "../components/VirtualList"
import s from "./Analisi.module.css"

interface AnalysisRow {
  name: string
  current: number | null
  signal: Signal
  stockQty: number
  stockValue: number
  bazarQty: number
  bazarValue: number
  roiPct: number | null
  avgSellMs: number | null
  totalProfit: number
  priceCount: number
  trend7: TrendResult | null
  vol: Volatility | null
}

interface AnalisiProps {
  itemNames: string[]
  analysisRows: AnalysisRow[]
  sortedAnalysis: AnalysisRow[]
  analSearch: string
  setAnalSearch: React.Dispatch<React.SetStateAction<string>>
  analSignalFilter: string
  setAnalSignalFilter: React.Dispatch<React.SetStateAction<string>>
  sortCol: string
  sortDir: number
  sortAnalysis: (col: string) => void
  analNameW: number
  setAnalNameW: React.Dispatch<React.SetStateAction<number>>
  analResizing: React.MutableRefObject<boolean>
}

export default memo(function Analisi({ itemNames, analysisRows, sortedAnalysis, analSearch, setAnalSearch, analSignalFilter, setAnalSignalFilter, sortCol, sortDir, sortAnalysis, analNameW, setAnalNameW, analResizing }: AnalisiProps) {
  const { setSelItem, setPage, setSubPage } = useNav()
  return (
    <div className="up">
      <div className={s.sectionLabel}>📊 ANALISI COMPARATIVA — {todayStr()}</div>

      {itemNames.length === 0 ? (
        <div className={s.emptyState}>
          Aggiungi item e registra prezzi per vedere l'analisi
        </div>
      ) : (<>

      {/* KPI */}
      {(() => {
        const tot = analysisRows.reduce((a: number, r: AnalysisRow) => a + (r.totalProfit || 0), 0)
        return (
          <div className={s.kpiWrap}>
            <div className={s.kpiBanner} style={{ border: `1px solid ${tot >= 0 ? C.green : C.red}44` }}>
              <span className={s.kpiLabel}>GUADAGNO TOTALE</span>
              <span className={s.kpiValue} style={{ color: tot >= 0 ? C.green : C.red }}>{tot >= 0 ? "+" : ""}{fmtG(tot)}</span>
            </div>
          </div>
        )
      })()}

      {/* Search + signal filters */}
      <div className={s.filterBar}>
        <input value={analSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnalSearch(e.target.value)} placeholder="Cerca item..."
          style={inp({ width:200, fontSize:13, padding:"7px 12px" })}/>
        <div className={s.filterGroup}>
          {SIGNAL_GROUPS.map((g: SignalGroup) => {
            const active = analSignalFilter === g.id
            const count = g.types ? analysisRows.filter((r: AnalysisRow) => g.types!.includes(r.signal.type)).length : analysisRows.length
            return (
              <button key={g.id} onClick={() => setAnalSignalFilter((f: string) => f === g.id ? "__all__" : g.id)}
                className={s.filterBtn}
                style={{ background: active ? g.color + "22" : "transparent", border: `1px solid ${active ? g.color : C.border2}`, color: active ? g.color : C.muted }}>
                {g.label} <span className={s.filterCount}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabella */}
      <div className={s.tableWrap}>
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
          ] as const

          interface ThProps {
            k: string
            l: string
            w: string
            title?: string
            resizable?: boolean
          }

          const Th = ({ k, l, w, title, resizable }: ThProps) => (
            <div onClick={()=>{ if (!analResizing.current) sortAnalysis(k) }} title={title||l}
              className={`${s.th} ${sortCol === k ? s.thActive : s.thInactive}`}
              style={{ width:w, minWidth:w }}>
              {l}{sortCol===k ? (sortDir===1?"▲":"▼") : ""}
              {resizable && (
                <div
                  className={s.resizeHandle}
                  onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                    e.stopPropagation()
                    e.preventDefault()
                    analResizing.current = true
                    const startX = e.clientX
                    const startW = analNameW
                    const onMove = (ev: MouseEvent) => { if (analResizing.current) setAnalNameW(Math.max(100, Math.min(400, startW + ev.clientX - startX))) }
                    const onUp = () => { setTimeout(() => { analResizing.current = false }, 50); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
                    window.addEventListener("mousemove", onMove)
                    window.addEventListener("mouseup", onUp)
                  }}
                />
              )}
            </div>
          )

          return (
            <div className={s.headerRow}>
              {cols.map(c => <Th key={c.k} {...c}/>)}
            </div>
          )
        })()}

        {/* Virtual scroll body */}
        <VirtualList
          items={sortedAnalysis}
          estimateSize={41}
          className={s.tableBody}
          renderItem={(r: AnalysisRow, i: number) => {
            const nameW = analNameW + "px"
            const sig = r.signal
            return (
              <div className={`r ${s.dataRow} ${i % 2 === 0 ? s.rowEven : s.rowOdd}`}
                onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("prices") }}>
                {/* Nome */}
                <div className={s.cellName} style={{ width:nameW, minWidth:nameW }}>{r.name}</div>
                {/* Segnale */}
                <div style={{ width:"130px", minWidth:"130px" }}>
                  <div className={s.signalPill} style={{ background:sig.bg, border:`1px solid ${sig.color}55`, color:sig.color }}>
                    {sig.icon} {sig.label}
                  </div>
                </div>
                {/* Prezzo */}
                <div className={s.cellPrice} style={{ width:"100px", minWidth:"100px" }}>{r.current!=null?fmtG(r.current):"—"}</div>
                {/* vs media */}
                <div className={s.cellMono} style={{ width:"80px", minWidth:"80px", color:sig.type==="nodata"?C.muted:sig.diffPct!=null?(sig.diffPct<=0?C.green:C.red):C.muted }}>
                  {sig.diffPct!=null ? `${sig.diffPct>=0?"+":""}${(sig.diffPct*100).toFixed(1)}%` : "—"}
                </div>
                {/* ROI% */}
                <div className={s.cellMono} style={{ width:"70px", minWidth:"70px", color:r.roiPct!=null?(r.roiPct>=0?C.green:C.red):C.muted }}>
                  {r.roiPct!=null ? `${r.roiPct>=0?"+":""}${r.roiPct.toFixed(1)}%` : "—"}
                </div>
                {/* Profitto */}
                <div className={s.cellMono} style={{ width:"90px", minWidth:"90px", color:r.totalProfit>0?C.green:r.totalProfit<0?C.red:C.muted }}>
                  {r.totalProfit!==0 ? fmtG(r.totalProfit) : "—"}
                </div>
                {/* Trend 7gg */}
                <div className={s.cellMono} style={{ width:"90px", minWidth:"90px", color:r.trend7?(r.trend7.up?C.green:C.red):C.muted }}>
                  {r.trend7 ? `${r.trend7.up?"▲":"▼"} ${Math.abs(r.trend7.pct).toFixed(1)}%` : "—"}
                </div>
                {/* Stabilità */}
                <div className={s.cellStability} style={{ width:"80px", minWidth:"80px", color:r.vol?(r.vol.cv<10?C.green:r.vol.cv<25?C.gold:C.red):C.muted }}>
                  {r.vol ? (r.vol.cv<10?"STABILE":r.vol.cv<25?"MODERATA":"INSTABILE") : "—"}
                </div>
              </div>
            )
          }}
        />
      </div>

      <div className={s.footer}>
        {sortedAnalysis.length}{sortedAnalysis.length !== analysisRows.length ? ` / ${analysisRows.length}` : ""} item
      </div>
      </>)}
    </div>
  )
})
