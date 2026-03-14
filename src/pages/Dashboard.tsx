import { memo } from "react"
import { C, pill } from "../utils/theme"
import { fmtG, fmtDurationMs, todayStr } from "../utils/formatting"
import { useNav } from "../contexts/NavigationContext"
import StatBar from "../components/StatBar"
import s from "./Dashboard.module.css"

import type { PriceEntry, Lot, Listing, Signal, TrendResult } from "../types"

interface CapitalOverview {
  inStock: number
  atMarket: number
  realized: number
  totalItems: number
}

interface DashboardCard {
  name: string
  ps: PriceEntry[]
  ls: Lot[]
  lsList: Listing[]
  sig: Signal
  last: number | null
  prev: number | null
  trend: string | null
  tCol: string
  openQty: number
  spent: number
  estProfit: number | null
  activeQtyL: number
  avgMs: number | null
  buyT: number | undefined
  sellT: number | undefined
  trend7: TrendResult | null
}

interface DashboardProps {
  itemNames: string[]
  capitalOverview: CapitalOverview | null
  dashboardCards: DashboardCard[]
}

export default memo(function Dashboard({ itemNames, capitalOverview, dashboardCards }: DashboardProps) {
  const { setPage, setSelItem, setSubPage } = useNav()
  return (
    <div className="up">
      <div className={s.header}>
        <div className={s.sectionLabel}>PANORAMICA — {todayStr()}</div>
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
        <div className={s.empty}>
          <span className={s.emptyIcon}>⚔️</span>
          <span className={s.emptyText}>NESSUN ITEM ANCORA</span>
          <button onClick={()=>setPage("new")} style={pill(true)}>＋ AGGIUNGI ITEM</button>
        </div>
      ) : (
        <div className={s.grid}>
          {dashboardCards.map(({ name, ps, ls, lsList, sig, last, prev, trend, tCol, openQty, spent, estProfit, activeQtyL, avgMs, buyT, sellT, trend7 }) => {
            return (
              <div key={name} className={`dc ${s.card}`}
                onClick={()=>{ setSelItem(name); setPage("item"); setSubPage("prices") }}
                style={{ border:`1px solid ${sig.type!=="nodata"?sig.color+"44":C.border}` }}>

                {/* Signal badge */}
                <div className={s.badge} style={{ background:sig.bg, border:`1px solid ${sig.color}55`, color:sig.color }}>
                  <div>{sig.icon} {sig.label}</div>
                  {sig.hint && sig.type !== "nodata" && (
                    <div className={s.badgeHint} style={{ color:sig.color }}>{
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
                <div className={s.cardName}>{name}</div>

                {last != null ? (
                  <>
                    <div className={s.price}>{fmtG(last)}</div>
                    <div className={s.priceRow}>
                      <span style={{ fontSize:13, color:tCol }}>{trend} {prev!=null ? `${last>=prev?"+":""}${fmtG(last-prev)}` : ""}</span>
                      {sig.diffPct != null && (
                        <span style={{ fontSize:12, color:sig.color, fontWeight:700 }}>
                          {sig.diffPct>=0?"+":""}{(sig.diffPct*100).toFixed(1)}% vs media
                        </span>
                      )}
                      {trend7 && (
                        <span className={s.trendBadge} style={{ color:trend7.up?C.green:C.red, background:trend7.up?`${C.green}14`:`${C.red}14` }}>
                          {trend7.up?"▲":"▼"} {Math.abs(trend7.pct).toFixed(1)}% 7gg
                        </span>
                      )}
                    </div>
                  </>
                ) : <div className={s.noPrice}>Nessun prezzo ancora</div>}

                {/* Target lines */}
                {(buyT || sellT) && (
                  <div className={s.targetRow}>
                    {buyT && <span className={s.targetBadge} style={{ color:C.green, background:`${C.green}1a` }}>🟢 Target acq. {fmtG(buyT)}</span>}
                    {sellT && <span className={s.targetBadge} style={{ color:C.blue,  background:`${C.blue}1a` }}>🔵 Target vend. {fmtG(sellT)}</span>}
                  </div>
                )}

                {/* Stock / bazar / profitto */}
                <div className={s.infoBlock}>
                  {openQty > 0 && <div style={{ fontSize:12, color:C.blue }}>📦 {openQty} in magazzino · {fmtG(spent)}</div>}
                  {activeQtyL > 0 && <div style={{ fontSize:12, color:C.gold }}>🏷️ {activeQtyL} al bazar</div>}
                  {estProfit !== null && <div style={{ fontSize:12, color:estProfit>=0?C.green:C.red }}>{estProfit>=0?"▲":"▼"} stimato {fmtG(estProfit)}</div>}
                  {avgMs != null && <div style={{ fontSize:11, color:C.muted }}>⏱ vendita media: {fmtDurationMs(avgMs)}</div>}
                </div>

                <div className={s.footer}>{ps.length} prezzi · {ls.length} acquisti · {lsList.length} listing</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
