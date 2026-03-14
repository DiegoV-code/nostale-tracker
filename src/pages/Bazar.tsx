import React, { memo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts"
import { C, inp, pill } from "../utils/theme"
import { fmtG, fmtAge } from "../utils/formatting"
import { useNav } from "../contexts/NavigationContext"
import StatBar from "../components/StatBar"
import VirtualList from "../components/VirtualList"
import s from "./Bazar.module.css"
import type { Listing } from "../types"

/* ── Local type definitions ── */

interface BazarRow {
  name: string
  listingIdx: number
  listing: Listing
  covered: number
  profit: number | null
  daysActive: number
}

interface BazarOverview {
  rows: BazarRow[]
  totalQty: number
  totalValue: number
  totalTax: number
  totalProfit: number
  totalCost: number
}

interface PerformanceItem {
  name: string
  avgSell: number | null
  [key: string]: unknown
}

interface CapitalChartItem {
  [key: string]: unknown
}

interface SellTimeRow {
  name: string
  days: number
  ms: number
}

interface SellTimeChart {
  name: string
  giorni: number
}

interface SellTimeData {
  rows: SellTimeRow[]
  avgDays: number
  chartData: SellTimeChart[]
}

interface BazarProps {
  bazarOverview: BazarOverview
  bazarPartialKey: string | null
  setBazarPartialKey: React.Dispatch<React.SetStateAction<string | null>>
  bazarPartialQty: string
  setBazarPartialQty: React.Dispatch<React.SetStateAction<string>>
  markBazarListingSold: (itemName: string, listingIdx: number, soldQty?: number) => void
  performanceAnalytics: { byItem: PerformanceItem[]; capitalChart: CapitalChartItem[] }
  sellTimeData: SellTimeData | null
}

export default memo(function Bazar({
  bazarOverview,
  bazarPartialKey,
  setBazarPartialKey,
  bazarPartialQty,
  setBazarPartialQty,
  markBazarListingSold,
  performanceAnalytics,
  sellTimeData,
}: BazarProps) {
  const { setSelItem, setPage, setSubPage } = useNav()
  return (
    <div className="up">
      <div className={s.sectionLabel}>🏷️ BAZAR — LISTING ATTIVI</div>

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
        <div className={s.empty}>
          <span className={s.emptyIcon}>🏷️</span>
          <span className={s.emptyText}>NESSUN LISTING ATTIVO</span>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* header */}
          <div className={s.headerRow}>
            <div className={s.hItem}>ITEM</div>
            <div className={s.hQty}>QTÀ</div>
            <div className={s.hPrice}>PREZZO</div>
            <div className={s.hTotal}>TOTALE</div>
            <div className={s.hCost}>COSTO</div>
            <div className={s.hTax}>TASSE</div>
            <div className={s.hAge}>DA</div>
            <div className={s.hActions}>AZIONI</div>
          </div>
          <VirtualList
            items={bazarOverview.rows}
            estimateSize={42}
            className={s.tableScroll}
            renderItem={(r: BazarRow, ri: number) => {
              const bKey = `${r.name}|${r.listingIdx}`
              const isPartial = bazarPartialKey === bKey
              return (
                <div className={`r ${s.row}`}>
                  <div onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("vendite") }}
                    className={s.rowName}>{r.name}</div>
                  <div className={s.rowQty}>×{r.listing.qty}</div>
                  <div className={s.rowPrice}>{fmtG(r.listing.listPrice)}</div>
                  <div className={s.rowTotal}>{fmtG(r.listing.listPrice * r.listing.qty)}</div>
                  <div className={s.rowCost} style={{ color:r.listing.buyPrice != null ? C.text : C.muted }}>{r.listing.buyPrice != null ? fmtG(r.listing.buyPrice * (r.listing.coveredQty || r.listing.qty)) : "—"}</div>
                  <div className={s.rowTax} style={{ color:r.listing.tax > 0 ? C.red : C.muted }}>{r.listing.tax > 0 ? fmtG(r.listing.tax) : "—"}</div>
                  <div className={s.rowAge} style={{ color:r.daysActive>=7?C.red:r.daysActive>=3?C.gold:C.green }}>
                    {fmtAge(r.daysActive * 86400000)}
                  </div>
                  <div className={s.actionsCol} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {isPartial ? (
                      <div className={s.partialBar}>
                        <span className={s.partialLabel}>Venduti:</span>
                        <input type="number" min="1" max={r.listing.qty-1} value={bazarPartialQty} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setBazarPartialQty(e.target.value)}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>)=>{ if(e.key==="Enter"){ const q=parseInt(bazarPartialQty, 10); if(q>0&&q<r.listing.qty) markBazarListingSold(r.name,r.listingIdx,q) } if(e.key==="Escape"){setBazarPartialKey(null);setBazarPartialQty("")} }}
                          autoFocus style={{ ...inp({ width:60, padding:"4px 8px", fontSize:12, textAlign:"center" }) }}/>
                        <span className={s.partialMax}>/ {r.listing.qty}</span>
                        {bazarPartialQty && !isNaN(parseInt(bazarPartialQty, 10)) && parseInt(bazarPartialQty, 10) > 0 && parseInt(bazarPartialQty, 10) < r.listing.qty && r.listing.buyPrice != null && (() => {
                          const sq = parseInt(bazarPartialQty, 10)
                          const pTax = r.listing.tax ? Math.round(r.listing.tax * sq / r.listing.qty) : 0
                          const pProfit = (r.listing.listPrice - r.listing.buyPrice) * Math.min(sq, r.listing.coveredQty || 0) - pTax
                          return <span className={s.partialProfit} style={{ color:pProfit>=0?C.green:C.red }}>
                            {pProfit>=0?"▲":"▼"}{fmtG(Math.abs(pProfit))}
                          </span>
                        })()}
                        <button onClick={()=>{ const q=parseInt(bazarPartialQty, 10); if(q>0&&q<r.listing.qty) markBazarListingSold(r.name,r.listingIdx,q) }}
                          disabled={!bazarPartialQty||isNaN(parseInt(bazarPartialQty, 10))||parseInt(bazarPartialQty, 10)<=0||parseInt(bazarPartialQty, 10)>=r.listing.qty}
                          style={{ ...pill(!!(bazarPartialQty&&!isNaN(parseInt(bazarPartialQty, 10))&&parseInt(bazarPartialQty, 10)>0&&parseInt(bazarPartialQty, 10)<r.listing.qty), C.green, { padding:"4px 8px", fontSize:11 }) }}>CONFERMA</button>
                        <button onClick={()=>{setBazarPartialKey(null);setBazarPartialQty("")}} className={s.closeBtn}>✕</button>
                      </div>
                    ) : (
                      <div className={s.actionsDefault}>
                        <button onClick={()=>markBazarListingSold(r.name,r.listingIdx)} title="Venduto tutto"
                          style={{ ...pill(false, C.green, { padding:"4px 10px", fontSize:11 }) }}>✓ TUTTO</button>
                        {r.listing.qty > 1 && <button onClick={()=>{setBazarPartialKey(bKey);setBazarPartialQty("")}} title="Vendita parziale"
                          style={{ ...pill(false, C.blue, { padding:"4px 8px", fontSize:11 }) }}>½</button>}
                      </div>
                    )}
                  </div>
                </div>
              )
            }}
          />
        </div>
      )}

      <div className={s.listingCount}>
        {bazarOverview.rows.length} listing attivi
      </div>

      {/* ── BAZAR ANALYTICS ── */}
      {performanceAnalytics.byItem.length > 0 && (<>

        {/* Sell Time per Item — table + chart */}
        {sellTimeData && (
            <div className={s.sellTimeSection}>
              <div className={s.sectionLabelSellTime}>⏱ TEMPO DI VENDITA — BAZAR → VENDUTO</div>
              <div className={s.sellTimeLayout}>
                {/* Table left */}
                <div className={s.stTable}>
                  <div className={s.stHeaderRow}>
                    <div className={s.stHeaderItem}>ITEM</div>
                    <div className={s.stHeaderDur}>DURATA</div>
                  </div>
                  <VirtualList
                    items={sellTimeData.rows}
                    estimateSize={34}
                    gap={3}
                    className={s.stScroll}
                    renderItem={(r: SellTimeRow) => {
                      const col = r.days >= 7 ? C.red : r.days >= 3 ? C.gold : C.green
                      return (
                        <div className={`r ${s.stRow}`}>
                          <div className={s.stRowName}>{r.name}</div>
                          <div className={s.stRowDur} style={{ color:col }}>{fmtAge(r.ms)}</div>
                        </div>
                      )
                    }}
                  />
                  <div className={s.stAvg}>
                    Media: <b className={s.stAvgVal}>{fmtAge(sellTimeData.avgDays * 86400000)}</b>
                  </div>
                </div>
                {/* Chart right */}
                <div className={s.stChart}>
                  <ResponsiveContainer width="100%" height={Math.max(400, Math.min(sellTimeData.rows.length * 45, 560))}>
                    <BarChart data={sellTimeData.chartData} margin={{ left:10, right:20, top:5, bottom:5 }}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                      <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:10 }} interval={0} angle={-30} textAnchor="end" height={55}/>
                      <YAxis stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }} label={{ value:"giorni", angle:-90, position:"insideLeft", fill:C.muted, fontSize:11 }}/>
                      <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={(v: number) => [v + "g", "Durata"]} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                      <Bar dataKey="giorni" fill={C.blue} radius={[4,4,0,0]} name="Durata"/>
                      <ReferenceLine y={Math.round(sellTimeData.avgDays * 10) / 10} stroke={C.red} strokeWidth={2} strokeDasharray="6 3" label={{ value:`Media: ${(Math.round(sellTimeData.avgDays * 10) / 10)}g`, fill:C.red, fontSize:11, position:"insideTopRight" }}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
        )}

      </>)}
    </div>
  )
})
