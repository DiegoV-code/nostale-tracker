import { useMemo, memo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts"
import { C } from "../utils/theme"
import { fmtG, fmtAge, fmtFull } from "../utils/formatting"
import { useNav } from "../contexts/NavigationContext"
import StatBar from "../components/StatBar"
import VirtualList from "../components/VirtualList"
import type { Lot } from "../types"
import s from "./Magazzino.module.css"

/* ── Row / overview types ── */

interface MagazzinoRow {
  name: string
  lot: Lot
  qty: number
  price: number
  lotCost: number
  estValue: number | null
  estProfit: number | null
  ageDays: number
  currentPrice: number | null
  refPrice: number | null
  note?: string
}

interface MagazzinoOverview {
  rows: MagazzinoRow[]
  totalQty: number
  totalSpent: number
  totalEstValue: number
  totalEstProfit: number
  itemCount: number
}

/* ── Analytics types ── */

interface PerformanceItem {
  name: string
  openValue: number
  bazarValue: number
  [key: string]: unknown
}

interface CapitalChartItem {
  name: string
  magazzino: number
  bazar: number
  totale: number
}

interface StagingTimeRow {
  name: string
  ageDays: number
  ageMs: number
  avgDays: number
}

interface StagingTimeChart {
  name: string
  giorni: number
  media: number
}

interface StagingTimeData {
  rows: StagingTimeRow[]
  globalAvg: number
  chartData: StagingTimeChart[]
}

/* ── Props ── */

interface Props {
  magazzinoOverview: MagazzinoOverview
  performanceAnalytics: { byItem: PerformanceItem[]; capitalChart: CapitalChartItem[] }
  stagingTimeData: StagingTimeData | null
}

export default memo(function Magazzino({ magazzinoOverview, performanceAnalytics, stagingTimeData }: Props) {
  const { setSelItem, setPage, setSubPage } = useNav()

  const sortedRows = useMemo(
    () => [...magazzinoOverview.rows].sort((a, b) => b.ageDays - a.ageDays),
    [magazzinoOverview.rows]
  )

  return (
    <div className="up">
      <div className={s.sectionLabel}>📦 MAGAZZINO — STOCK GLOBALE</div>

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
        <div className={s.empty}>
          <span className={s.emptyIcon}>📦</span>
          <span className={s.emptyText}>NESSUN ITEM IN MAGAZZINO</span>
        </div>
      ) : (
        <div className={s.tableWrap}>
          {/* header */}
          <div className={s.tableHeader}>
            <div className={s.colItem}>ITEM</div>
            <div className={s.colQty}>QTÀ</div>
            <div className={s.colPrice}>PREZZO ACQ.</div>
            <div className={s.colCost}>COSTO SLOT</div>
            <div className={s.colCurrent}>MEDIA VEND.</div>
            <div className={s.colProfit}>PROFITTO ST.</div>
            <div className={s.colAge}>ETÀ</div>
            <div className={s.colDate}>DATA</div>
          </div>
          <VirtualList
            items={sortedRows}
            estimateSize={42}
            className={s.tableScroll}
            renderItem={(r: MagazzinoRow) => {
              const ageColor = r.ageDays >= 7 ? C.red : r.ageDays >= 3 ? C.gold : C.green
              const ageLabel = fmtAge(r.ageDays * 86400000)
              return (
                <div className={`r ${s.row}`}
                  onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("magazzino") }}>
                  <div className={`${s.colItem} ${s.itemName}`}>{r.name}</div>
                  <div className={`${s.colQty} ${s.qty}`}>×{r.qty}</div>
                  <div className={`${s.colPrice} ${s.priceText}`}>{fmtG(r.price)}</div>
                  <div className={`${s.colCost} ${s.costText}`}>{fmtG(r.lotCost)}</div>
                  <div className={`${s.colCurrent} ${s.currentText}`}>{r.refPrice != null ? fmtG(r.refPrice) : "—"}</div>
                  <div className={`${s.colProfit} ${s.profitText}`} style={{ color:r.estProfit!=null?(r.estProfit>=0?C.green:C.red):C.muted }}>
                    {r.estProfit != null ? `${r.estProfit>=0?"▲":"▼"} ${fmtG(Math.abs(r.estProfit))}` : "—"}
                  </div>
                  <div className={`${s.colAge} ${s.ageText}`} style={{ color:ageColor }}>
                    {ageLabel}
                  </div>
                  <div className={`${s.colDate} ${s.dateText}`}>
                    {fmtFull(r.lot.timestamp)}
                  </div>
                </div>
              )
            }}
          />
        </div>
      )}

      <div className={s.footer}>
        {magazzinoOverview.rows.length} slot · {magazzinoOverview.itemCount} item in magazzino
      </div>

      {/* ── ANALYTICS SECTION ── */}
      {performanceAnalytics.byItem.length > 0 && (<>

        {/* Capital Distribution */}
        {performanceAnalytics.capitalChart.length > 0 && (
          <div className={s.analyticsSection}>
            <div className={s.sectionLabelAlt}>💰 CAPITALE BLOCCATO PER ITEM</div>
            <div className={s.chartPanel}>
              <ResponsiveContainer width="100%" height={Math.max(400, Math.min(performanceAnalytics.capitalChart.length * 45, 560))}>
                <BarChart data={performanceAnalytics.capitalChart} margin={{ left:10, right:20, top:5, bottom:5 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:11 }} interval={0} angle={-35} textAnchor="end" height={60}/>
                  <YAxis tickFormatter={(v: number) => fmtG(v)} stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }}/>
                  <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={(v: number) => fmtG(v)} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                  <Bar dataKey="magazzino" stackId="cap" fill={C.blue} name="Magazzino" radius={[0,0,0,0]}/>
                  <Bar dataKey="bazar" stackId="cap" fill={C.gold} name="Bazar" radius={[4,4,0,0]}/>
                  <Legend formatter={(v: string) => <span className={s.legendLabel}>{v}</span>}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Staging Time per Item */}
        {stagingTimeData && (
            <div className={s.analyticsSectionAlt}>
              <div className={s.sectionLabelAlt}>⏱ TEMPO IN MAGAZZINO — DA QUANTO TEMPO STAI TENENDO STOCK</div>
              <div className={s.stagingFlex}>
                {/* Table left */}
                <div className={s.stagingLeft}>
                  <div className={s.stagingTableHeader}>
                    <div className={s.stagingColItem}>ITEM</div>
                    <div className={s.stagingColTime}>TEMPO</div>
                  </div>
                  {stagingTimeData.rows.map(r => {
                    const col = r.ageDays >= 7 ? C.red : r.ageDays >= 3 ? C.gold : C.green
                    return (
                      <div key={r.name} className={`r ${s.stagingRow}`}>
                        <div className={s.stagingItemName}>{r.name}</div>
                        <div className={s.stagingTime} style={{ color:col }}>{fmtAge(r.ageMs)}</div>
                      </div>
                    )
                  })}
                  <div className={s.stagingAvg}>
                    Media globale: <b className={s.stagingAvgValue}>{fmtAge(stagingTimeData.globalAvg * 86400000)}</b>
                  </div>
                </div>
                {/* Chart right */}
                <div className={s.stagingChart}>
                  <ResponsiveContainer width="100%" height={Math.max(400, Math.min(stagingTimeData.rows.length * 45, 560))}>
                    <BarChart data={stagingTimeData.chartData} margin={{ left:10, right:20, top:5, bottom:5 }}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                      <XAxis dataKey="name" stroke={C.border2} tick={{ fill:C.gold, fontSize:10 }} interval={0} angle={-30} textAnchor="end" height={55}/>
                      <YAxis stroke={C.border2} tick={{ fill:C.muted, fontSize:11 }} label={{ value:"giorni", angle:-90, position:"insideLeft", fill:C.muted, fontSize:11 }}/>
                      <Tooltip contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8 }} formatter={(v: number, name: string) => [v + "g", name === "media" ? "Media item" : "Max lotto"]} labelStyle={{ color:C.gold, fontWeight:700 }}/>
                      <Bar dataKey="giorni" fill={C.blue} radius={[4,4,0,0]} name="Max lotto"/>
                      <Bar dataKey="media" fill={C.gold} radius={[4,4,0,0]} name="Media item"/>
                      <Legend formatter={(v: string) => <span className={s.legendLabel}>{v}</span>}/>
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
