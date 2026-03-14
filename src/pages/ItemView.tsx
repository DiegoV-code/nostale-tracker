import React, { useMemo, memo } from "react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts"
import { C, inp, pill } from "../utils/theme"
import s from "./ItemView.module.css"
import { fmtG, parseG, fmtFull, fmtDurationMs, fmtSellTime, fmtAge, todayStr } from "../utils/formatting"
import { EVT } from "../utils/constants"
import { calcTrend, calcVolatility, calcListingProfit } from "../utils/analysis"
import { useNav } from "../contexts/NavigationContext"
import type { SubPageId } from "../contexts/NavigationContext"
import { useData } from "../contexts/DataContext"
import type { Item, PriceEntry, Lot, Listing, Signal, EventDef, SignalConfig } from "../types"
import type { LotMatchResult } from "../utils/analysis"
import VirtualList from "../components/VirtualList"

interface AllStats {
  current: number
  isEsaurito: boolean
  esauritoCount: number
  avg: number
  min: number
  max: number
  avgEvent: number | null
  avgNormal: number | null
  count: number
}

interface DayStats {
  min: number
  max: number
  avg: number
  delta: number
  last: number
}

interface ChartPoint {
  time: string
  price: number
  eventId: string
  note?: string
}

interface MultiDayPoint {
  day: string
  media?: number
  evento?: number
  normale?: number
  min: number
  max: number
  hasEvent: boolean
  eventColor?: string
}

interface LotStats {
  totalQty: number
  totalSpent: number
  avgBuy: number
  currentPrice: number | null
  estimatedValue: number | null
  estimatedProfit: number | null
  openLots: Lot[]
  closedLots: Lot[]
}

interface ListingStats {
  active: Listing[]
  sold: Listing[]
  activeQty: number
  activeValue: number
  avgMs: number | null
  totalProfit: number
  profitableSales: Listing[]
}

interface ItemViewProps {
  renaming: boolean
  setRenaming: React.Dispatch<React.SetStateAction<boolean>>
  renameVal: string
  setRenameVal: React.Dispatch<React.SetStateAction<string>>
  renameItem: (oldName: string, newVal: string) => void
  copyName: (name: string) => void
  copyFlash: boolean
  item: Item | null
  prices: PriceEntry[]
  lots: Lot[]
  listings: Listing[]
  allStats: AllStats | null
  dayStats: DayStats | null
  multiDayChart: MultiDayPoint[]
  chartDay: string
  setChartDay: React.Dispatch<React.SetStateAction<string>>
  chartPoints: ChartPoint[]
  allDays: string[]
  trendDays: number
  allEVT: Record<string, EventDef>
  allCategories: string[]
  signalCache: Record<string, Signal>
  getSignal: (it: Item | null | undefined, cfg: SignalConfig | null | undefined) => Signal
  pVal: string
  setPVal: React.Dispatch<React.SetStateAction<string>>
  recordPrice: () => void
  recordEsaurito: () => void
  delPrice: (idx: number) => void
  delItem: (name: string) => void
  lQty: string
  setLQty: React.Dispatch<React.SetStateAction<string>>
  lPrice: string
  setLPrice: React.Dispatch<React.SetStateAction<string>>
  recordLot: () => void
  delLot: (idx: number) => void
  lsQty: string
  setLsQty: React.Dispatch<React.SetStateAction<string>>
  lsPrice: string
  setLsPrice: React.Dispatch<React.SetStateAction<string>>
  lsTax: string
  setLsTax: React.Dispatch<React.SetStateAction<string>>
  addListing: () => void
  delListing: (idx: number) => void
  lotPreview: LotMatchResult | null
  lotStats: LotStats | null
  listingStats: ListingStats | null
  partialIdx: number | null
  setPartialIdx: React.Dispatch<React.SetStateAction<number | null>>
  partialQty: string
  setPartialQty: React.Dispatch<React.SetStateAction<string>>
  markListingSold: (idx: number, soldQty?: number) => void
  exportCSV: () => void
  showTargetEdit: boolean
  setShowTargetEdit: React.Dispatch<React.SetStateAction<boolean>>
}

export default memo(function ItemView({
  renaming, setRenaming, renameVal, setRenameVal, renameItem, copyName, copyFlash,
  item, prices, lots, listings,
  allStats, dayStats, multiDayChart, chartDay, setChartDay, chartPoints, allDays, trendDays,
  allEVT, allCategories, signalCache, getSignal,
  pVal, setPVal, recordPrice, recordEsaurito, delPrice, delItem,
  lQty, setLQty, lPrice, setLPrice, recordLot, delLot,
  lsQty, setLsQty, lsPrice, setLsPrice, lsTax, setLsTax, addListing, delListing,
  lotPreview, lotStats, listingStats,
  partialIdx, setPartialIdx, partialQty, setPartialQty, markListingSold,
  exportCSV, showTargetEdit, setShowTargetEdit,
}: ItemViewProps) {
  const { selItem, setPage, setSubPage, subPage } = useNav()
  const { data, upd } = useData()
  const reversedPrices = useMemo(() => [...prices].reverse(), [prices])
  const soldListings = useMemo(
    () => listings.reduce<{ listing: typeof listings[0]; idx: number }[]>((acc, l, i) => {
      if (l.sold) acc.push({ listing: l, idx: i })
      return acc
    }, []),
    [listings]
  )
  return (
    <div className={`up ${s.root}`}>

      {/* header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <button onClick={()=>setPage("dashboard")} className={s.backBtn}>←</button>
          <div>
            {renaming ? (
              <div className={s.renameRow}>
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e=>setRenameVal(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") renameItem(selItem!, renameVal); if(e.key==="Escape"){ setRenaming(false); setRenameVal("") } }}
                  style={{ ...inp({ fontSize:15, color:C.gold, width:260, padding:"5px 10px" }) }}
                />
                <button onClick={()=>renameItem(selItem!, renameVal)} style={{ ...pill(true, C.gold, { padding:"5px 12px", fontSize:11 }) }}>OK</button>
                <button onClick={()=>{ setRenaming(false); setRenameVal("") }} style={{ ...pill(false, C.muted, { padding:"5px 10px", fontSize:11 }) }}>✕</button>
              </div>
            ) : (
              <div className={s.nameRow}>
                <h2 className={s.itemTitle}>{selItem}</h2>
                <button
                  title="Rinomina item"
                  onClick={()=>{ setRenameVal(selItem!); setRenaming(true) }}
                  className={s.iconBtn}>✏️</button>
                <button
                  title="Copia nome"
                  onClick={()=>copyName(selItem!)}
                  className={s.iconBtn} style={{ color:copyFlash?C.green:undefined, transition:"color .2s" }}>{copyFlash?"✓":"⎘"}</button>
              </div>
            )}
            <div className={s.metaRow}>
              <span>{prices.length} prezzi · {lots.length} lotti</span>
              <select
                value={item?.meta?.category || "—"}
                onChange={e => {
                  const cat = e.target.value === "—" ? undefined : e.target.value
                  const it = { ...data.items[selItem!], meta: { ...data.items[selItem!].meta, category: cat } }
                  upd({ ...data, items: { ...data.items, [selItem!]: it } })
                }}
                className={s.categorySelect}>
                {allCategories.map(c => <option key={c} value={c}>{c === "—" ? "Nessuna categoria" : c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className={s.tabBar}>
          {[
            { k:"prices",    l:"📈 Prezzi"    },
            { k:"magazzino", l:"📦 Magazzino" },
            { k:"vendite",   l:"🏷️ In Vendita" },
            { k:"charts",    l:"📊 Grafici"   },
          ].map(({ k, l }) => (
            <button key={k} onClick={()=>setSubPage(k as SubPageId)} style={pill(subPage===k, C.gold, { padding:"7px 13px", fontSize:11 })}>{l}</button>
          ))}
          <button onClick={exportCSV} style={pill(false,C.cyan,{ padding:"7px 11px", fontSize:11 })}>⬇ CSV</button>
          <button onClick={()=>delItem(selItem!)} style={pill(false,C.red,{ padding:"7px 11px", fontSize:11 })}>🗑</button>
        </div>
      </div>

      {/* ── SIGNAL + TARGET BAR ── */}
      {(() => {
        const sig  = signalCache[selItem!] || getSignal(item, data?.signalConfig)
        const buyT  = item?.meta?.buyTarget
        const sellT = item?.meta?.sellTarget
        const diffEv = allStats?.avgEvent && allStats?.avgNormal
          ? (allStats.avgEvent - allStats.avgNormal) / allStats.avgNormal * 100
          : null
        return (
          <div className={s.signalRow}>
            {/* Segnale attuale */}
            <div title={sig.hint || ""} className={s.signalCard} style={{ background:sig.bg, border:`1px solid ${sig.color}66`, cursor:sig.hint?"help":"default" }}>
              <span className={s.signalIcon}>{sig.icon}</span>
              <div>
                <div className={s.signalTitle} style={{ color:sig.color }}>SEGNALE</div>
                <div className={s.signalValue} style={{ color:sig.color }}>{sig.label}</div>
                {sig.diffPct != null && (
                  <div className={s.signalDiff} style={{ color:sig.color }}>
                    {sig.diffPct>=0?"+":""}{(sig.diffPct*100).toFixed(1)}% vs media
                  </div>
                )}
              </div>
            </div>

            {/* Diff evento */}
            {diffEv != null && (
              <div title={diffEv<=0 ? "Prezzi calano durante eventi" : "Prezzi salgono durante eventi"} className={s.diffEvCard}>
                <div className={s.diffEvLabel}>EVENTI</div>
                <div className={s.diffEvValue} style={{ color:diffEv<=0?C.green:C.red }}>
                  {diffEv>=0?"+":""}{diffEv.toFixed(1)}%
                </div>
              </div>
            )}

            {/* KPI acquisto / vendita */}
            {(() => {
              const ls = listings || []
              const soldWithBuy = ls.filter(l => l.sold && l.buyPrice != null)
              const avgBuy  = soldWithBuy.length ? soldWithBuy.reduce((a,l) => a + l.buyPrice!, 0) / soldWithBuy.length : null
              const avgSell = soldWithBuy.length ? soldWithBuy.reduce((a,l) => a + l.listPrice, 0) / soldWithBuy.length : null
              const marginPct = avgBuy && avgSell ? ((avgSell - avgBuy) / avgBuy) * 100 : null
              return (
                <div className={s.kpiRow}>
                  <div className={s.kpiCard}>
                    <div className={s.kpiLabel}>MEDIA ACQUISTO</div>
                    <div className={s.kpiValue} style={{ color:avgBuy != null ? C.red : C.muted }}>{avgBuy != null ? fmtG(Math.round(avgBuy)) : "—"}</div>
                  </div>
                  <div className={s.kpiCard}>
                    <div className={s.kpiLabel}>MEDIA VENDITA</div>
                    <div className={s.kpiValue} style={{ color:avgSell != null ? C.green : C.muted }}>{avgSell != null ? fmtG(Math.round(avgSell)) : "—"}</div>
                  </div>
                  <div className={s.kpiCard}>
                    <div className={s.kpiLabel}>MARGINE %</div>
                    <div className={s.kpiValue} style={{ color:marginPct != null ? (marginPct >= 0 ? C.green : C.red) : C.muted }}>{marginPct != null ? `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}%` : "—"}</div>
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
          { l: allStats.isEsaurito ? "ULTIMO PREZZO NOTO" : "PREZZO ATTUALE", v:fmtG(allStats.current), c:allStats.isEsaurito?C.purple:C.gold, big:true },
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
            ? { l:"ESAURITO",   v:allStats.esauritoCount+"×",  c:C.purple, sub:"volte segnalato" }
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
        ].filter((x): x is NonNullable<typeof x> => Boolean(x))
        return (
          <div className={s.statsCol}>
            <div className={s.statsPrimary}>
              {primary.map(st => (
                <div key={st.l} className={s.primaryCard} style={{ border:`1px solid ${st.big?st.c+"44":C.border}`, flex: st.big ? "1 1 120px" : "1 1 80px" }}>
                  <div className={s.primaryLabel}>{st.l}</div>
                  <div className={st.big ? s.primaryValueBig : s.primaryValue} style={{ color:st.c }}>{st.v}</div>
                </div>
              ))}
            </div>
            <div className={s.statsSecondary}>
              {secondary.map(st => (
                <div key={st.l} title={st.title || ""} className={s.secondaryCard} style={{ cursor:st.title?"help":"default" }}>
                  <div className={s.secondaryLabel}>{st.l}</div>
                  <div className={s.secondaryValue} style={{ color:st.c }}>{st.v}</div>
                  {st.sub && <div className={s.secondarySub}>{st.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ══════════════ PRICES TAB ══════════════ */}
      {subPage === "prices" && (
        <div>
          <div className={s.panel}>
            <div className={s.formRow}>
              <div className={s.fieldWide}>
                <div className={s.fieldLabel}>PREZZO</div>
                <input
                  value={pVal} onChange={e=>setPVal(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&recordPrice()}
                  placeholder="150000 oppure 150k"
                  style={inp({ fontSize:19, color:C.gold })}
                />
                {pVal && !isNaN(parseG(pVal)) && (
                  <div className={s.fieldHint}>= {parseG(pVal).toLocaleString("it-IT")} ori · {fmtG(parseG(pVal))}</div>
                )}
              </div>
              <button onClick={recordPrice} disabled={!pVal||isNaN(parseG(pVal))} style={{ ...pill(!!(pVal&&!isNaN(parseG(pVal)))), padding:"8px 22px", flexShrink:0 }}>
                SALVA
              </button>
              <button onClick={recordEsaurito}
                title="Segna che al momento non ci sono item disponibili al bazar"
                style={{ ...pill(false,C.purple,{ padding:"8px 14px", flexShrink:0 }) }}>
                📭 ESAURITO AL BZ
              </button>
            </div>

            {allStats?.isEsaurito && (
              <div className={s.esauritoBanner} style={{ background:`${C.purple}1a`, border:`1px solid ${C.purple}55` }}>
                <span className={s.esauritoIcon}>📭</span>
                <div>
                  <div className={s.esauritoTitle}>ESAURITO AL BAZAR</div>
                  <div className={s.esauritoSub}>Nessun item disponibile al momento · Ultimo prezzo noto: <b style={{color:C.text}}>{fmtG(allStats.current)}</b></div>
                </div>
                <div className={s.esauritoCount}>
                  Esaurito {allStats.esauritoCount}× in storico
                </div>
              </div>
            )}
          </div>

          {prices.length === 0 ? (
            <div className={s.priceList}><div className={s.emptyMsg}>Nessun prezzo registrato ancora</div></div>
          ) : (
            <VirtualList
              items={reversedPrices}
              estimateSize={37}
              gap={3}
              className={s.priceList}
              renderItem={(p, ri) => {
                const realIdx = prices.length - 1 - ri
                const ev      = allEVT[p.eventId] || EVT.none
                const prevReal = prices.slice(0, realIdx).reverse().find(x => !x.esaurito)
                const delta    = (!p.esaurito && prevReal) ? p.price! - prevReal.price! : null

                if (p.esaurito) return (
                  <div className={`r ${s.priceRowEsaurito}`} style={{ background:`${C.purple}0f`, border:`1px solid ${C.purple}33` }}>
                    <span className={s.timestamp}>{fmtFull(p.timestamp)}</span>
                    <span className={s.esauritoLabel}>📭 ESAURITO AL BAZAR</span>
                    {ev.id !== "none" && <span className={s.eventTagSmall} style={{ color:ev.color }}>{ev.icon} {ev.label}</span>}
                    <span className={s.spacer}/>
                    <button onClick={()=>delPrice(realIdx)} className={s.delBtn}>✕</button>
                  </div>
                )

                return (
                  <div className={`r ${s.priceRow}`}>
                    <span className={s.timestamp}>{fmtFull(p.timestamp)}</span>
                    <span className={s.priceGold}>{fmtG(p.price)}</span>
                    <span className={s.priceOri}>{p.price!.toLocaleString("it-IT")}</span>
                    {delta !== null && <span className={s.priceDelta} style={{ color:delta>=0?C.green:C.red }}>{delta>=0?"+":""}{fmtG(delta)}</span>}
                    {ev.id !== "none" && <span className={s.eventTag} style={{ color:ev.color }}>{ev.icon} {ev.label}</span>}
                    <span className={s.noteEllipsis}>{p.note}</span>
                    <button onClick={()=>delPrice(realIdx)} className={s.delBtn}>✕</button>
                  </div>
                )
              }}
            />
          )}
        </div>
      )}

      {/* ══════════════ MAGAZZINO TAB ══════════════ */}
      {subPage === "magazzino" && (
        <div>
          {lotStats && (
            <div className={s.kpiBar}>
              {([
                { l:"QTÀ IN STOCK",       v:lotStats.totalQty + " pz",         c:C.blue  },
                { l:"TOTALE SPESO",        v:fmtG(lotStats.totalSpent),          c:C.red   },
                { l:"PREZZO MEDIO ACQ.",   v:fmtG(lotStats.avgBuy),             c:C.text  },
                { l:"PREZZO ATTUALE",      v:fmtG(lotStats.currentPrice),        c:C.gold  },
                { l:"VALORE STIMATO",      v:fmtG(lotStats.estimatedValue),      c:C.text  },
                { l:"PROFITTO STIMATO",    v:fmtG(lotStats.estimatedProfit),     c:(lotStats.estimatedProfit ?? 0)>=0?C.green:C.red },
              ] as { l: string; v: string; c: string; title?: string; sub?: string }[]).map(st => (
                <div key={st.l} title={st.title||""} className={s.kpiStatCard} style={{ border:`1px solid ${st.l==="VENDI ALMENO A"?C.gold+"44":C.border}`, cursor:st.title?"help":"default" }}>
                  <div className={s.kpiStatLabel}>{st.l}</div>
                  <div className={s.kpiStatValue} style={{ color:st.c }}>{st.v}</div>
                  {st.sub && <div className={s.kpiStatSub}>{st.sub}</div>}
                </div>
              ))}
            </div>
          )}

          <div className={s.panel}>
            <div className={s.formRow}>
              <div className={s.fieldNarrow}>
                <div className={s.fieldLabel}>QUANTITÀ (max 999)</div>
                <input type="number" min="1" max="999" value={lQty} onChange={e=>setLQty(e.target.value)} placeholder="50" style={inp()}/>
              </div>
              <div className={s.fieldWide}>
                <div className={s.fieldLabel}>PREZZO UNITARIO</div>
                <input value={lPrice} onChange={e=>setLPrice(e.target.value)} placeholder="50000 o 50k" style={inp({ color:C.blue })}/>
                {lPrice && !isNaN(parseG(lPrice)) && (
                  <div className={s.fieldHint}>{fmtG(parseG(lPrice))}</div>
                )}
              </div>
              {lQty && lPrice && !isNaN(parseG(lPrice)) && parseInt(lQty, 10)>0 && (
                <div className={s.lotTotalPreview}>
                  <div className={s.fieldLabel}>TOTALE LOTTO</div>
                  <div className={s.lotTotalValue}>
                    {fmtG(parseInt(lQty, 10)*parseG(lPrice))}
                  </div>
                </div>
              )}
              <button onClick={recordLot} disabled={!lQty||!lPrice||isNaN(parseG(lPrice))} style={{ ...pill(!!(lQty&&lPrice&&!isNaN(parseG(lPrice))),C.blue), padding:"8px 18px", flexShrink:0 }}>
                🛒 ACQUISTO
              </button>
            </div>
          </div>

          <div style={{ marginBottom:8 }}>
            <div className={s.sectionLabel}>ACQUISTI IN STOCK</div>
            <div className={s.lotList}>
              {lots.filter(l=>!l.sold).length===0 && <div className={s.emptySmall}>Nessun acquisto in stock</div>}
              {lots.map((l, i) => {
                if (l.sold) return null
                const ev = allEVT[l.eventId || "none"] || EVT.none
                const realPs = prices.filter(p => !p.esaurito)
                const currentP = realPs.length ? realPs[realPs.length-1].price : null
                const profit   = currentP ? (currentP - l.price) * l.qty : null
                return (
                  <div key={i} className={`r ${s.lotRow}`}>
                    <span className={s.timestamp}>{fmtFull(l.timestamp)}</span>
                    <span className={s.lotQty}>×{l.qty}</span>
                    <span className={s.lotPrice}>@ {fmtG(l.price)}</span>
                    <span className={s.lotTotal}>= {fmtG(l.price*l.qty)}</span>
                    {profit !== null && (
                      <span className={s.lotProfit} style={{ color:profit>=0?C.green:C.red }}>
                        {profit>=0?"▲":"▼"} {fmtG(profit)}
                      </span>
                    )}
                    {ev.id !== "none" && <span className={s.lotEvent} style={{ color:ev.color }}>{ev.icon}</span>}
                    <span className={s.lotNote}>{l.note}</span>
                    <button onClick={()=>delLot(i)} className={s.delBtn}>✕</button>
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
          {listingStats && (
            <div className={s.kpiBar}>
              {[
                { l:"IN VENDITA",        v:listingStats.activeQty + " pz",                                                c:C.gold  },
                { l:"VALORE AL BAZAR",   v:fmtG(listingStats.activeValue),                                                c:C.text  },
                { l:"VENDITE CHIUSE",    v:listingStats.sold.length + " listing",                                         c:C.green },
                { l:"PROFITTO TOTALE",   v:listingStats.profitableSales.length ? fmtG(listingStats.totalProfit) : "—",    c:listingStats.totalProfit>=0?C.green:C.red },
                { l:"TEMPO MEDIO VEND.", v:listingStats.avgMs!=null ? fmtDurationMs(listingStats.avgMs) : "—",           c:C.blue  },
              ].map(st => (
                <div key={st.l} className={s.kpiStatCard}>
                  <div className={s.kpiStatLabel}>{st.l}</div>
                  <div className={s.kpiStatValue} style={{ color:st.c }}>{st.v}</div>
                </div>
              ))}
            </div>
          )}

          <div className={s.panel}>
            <div className={s.formRow}>
              <div style={{ flex:"0 0 90px" }}>
                <div className={s.fieldLabel}>QUANTITÀ</div>
                <input type="number" min="1" max="999" value={lsQty} onChange={e=>setLsQty(e.target.value)} placeholder="10" style={inp()}/>
              </div>
              <div className={s.fieldWide}>
                <div className={s.fieldLabel}>PREZZO BAZAR</div>
                <input value={lsPrice} onChange={e=>setLsPrice(e.target.value)} placeholder="150k" style={inp({ color:C.gold })}/>
                {lsPrice && !isNaN(parseG(lsPrice)) && (
                  <div className={s.fieldHint}>{fmtG(parseG(lsPrice))}</div>
                )}
              </div>
              <div className={s.fieldMid}>
                <div className={s.fieldLabel}>TASSE BAZAR</div>
                <input value={lsTax} onChange={e=>setLsTax(e.target.value)} placeholder="es. 50k" style={inp({ color:C.red })}/>
                {lsTax && !isNaN(parseG(lsTax)) && (
                  <div className={s.fieldHint}>{fmtG(parseG(lsTax))}</div>
                )}
              </div>
              <button onClick={addListing} disabled={!lsQty||!lsPrice||isNaN(parseG(lsPrice))}
                style={{ ...pill(!!(lsQty&&lsPrice&&!isNaN(parseG(lsPrice))),C.gold), padding:"8px 18px", flexShrink:0 }}>
                🏷️ METTI IN VENDITA
              </button>
            </div>

            {lotPreview && lotPreview.links.length > 0 && (
              <div className={s.lotPreview}>
                <div className={s.lotPreviewLabel}>LOTTI DAL MAGAZZINO (FIFO)</div>
                <div className={s.lotPreviewList}>
                  {lotPreview.links.map((lk, i) => (
                    <div key={i} className={s.lotPreviewRow}>
                      <span className={s.lotPreviewQty}>x{lk.qty}</span>
                      <span className={s.lotPreviewPrice}>@ {fmtG(lk.unitPrice)}</span>
                      <span className={s.lotPreviewTotal}>= {fmtG(lk.qty * lk.unitPrice)}</span>
                    </div>
                  ))}
                </div>
                <div className={s.lotPreviewSummary}>
                  <span className={s.lotPreviewSumLabel}>Coperti: <b style={{ color:C.blue }}>{lotPreview.coveredQty} pz</b></span>
                  <span className={s.lotPreviewSumLabel}>Costo totale: <b style={{ color:C.text }}>{fmtG(lotPreview.totalCost)}</b></span>
                  <span className={s.lotPreviewSumLabel}>Media acquisto: <b style={{ color:C.text }}>{fmtG(lotPreview.avgBuyPrice)}</b></span>
                  {lotPreview.uncoveredQty > 0 && (
                    <span style={{ color:C.red, fontWeight:700 }}>⚠ {lotPreview.uncoveredQty} pz non coperti da magazzino</span>
                  )}
                </div>
                {lsPrice && !isNaN(parseG(lsPrice)) && lotPreview.avgBuyPrice && (() => {
                  const sellP = parseG(lsPrice)
                  const taxVal = lsTax && !isNaN(parseG(lsTax)) ? parseG(lsTax) : 0
                  const profit = (sellP - lotPreview.avgBuyPrice) * lotPreview.coveredQty - taxVal
                  return (
                    <div className={s.lotPreviewProfit} style={{ color:profit>=0?C.green:C.red }}>
                      {profit>=0?"▲":"▼"} {fmtG(Math.abs(profit))} profitto stimato{taxVal > 0 ? " (tasse incluse)" : ""}
                    </div>
                  )
                })()}
              </div>
            )}
            {lotPreview && lotPreview.links.length === 0 && parseInt(lsQty, 10) > 0 && (
              <div className={s.lotPreviewNone}>Nessun lotto disponibile in magazzino per questo item</div>
            )}
          </div>

          <div style={{ marginBottom:8 }}>
            <div className={s.sectionLabel}>AL BAZAR ORA</div>
            <div className={s.listingList}>
              {listings.filter(l=>!l.sold).length===0 && (
                <div className={s.emptyListing}>Nessun oggetto in vendita al momento</div>
              )}
              {listings.map((l, i) => {
                if (l.sold) return null
                const daysActive = ((Date.now() - new Date(l.listedAt).getTime()) / 86400000)
                const covered = l.coveredQty || 0
                const profitOnCovered = covered > 0 ? calcListingProfit(l) : null
                return (
                  <div key={i} className={`r ${s.listingRow}`}>
                    <div className={s.listingDateCol}>
                      <span className={s.listingDateTop}>{fmtFull(l.listedAt)}</span>
                      <span className={s.listingDays} style={{ color:daysActive>=3?C.red:daysActive>=1?C.gold:C.green }}>
                        {daysActive < 1 ? "⏱ da oggi" : `⏳ da ${Math.floor(daysActive)}g`}
                      </span>
                    </div>
                    <span className={s.listingQty}>×{l.qty}</span>
                    <span className={s.listingPrice}>@ {fmtG(l.listPrice)}</span>
                    <span className={s.listingTotal}>= {fmtG(l.listPrice*l.qty)}</span>
                    {profitOnCovered != null && (
                      <span className={s.listingProfit} style={{ color:profitOnCovered>=0?C.green:C.red }}>
                        {profitOnCovered>=0?"▲":"▼"} {fmtG(profitOnCovered)}
                      </span>
                    )}
                    {l.buyPrice && <span className={s.listingMeta}>media acq. {fmtG(l.buyPrice)}</span>}
                    {l.lotLinks && l.lotLinks.length > 0 && (
                      <span className={s.listingLots} title={l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}>
                        [{l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}]
                      </span>
                    )}
                    {covered < l.qty && covered > 0 && (
                      <span className={s.uncovered}>⚠ {l.qty - covered} non coperti</span>
                    )}
                    {l.tax > 0 && <span className={s.tax}>tasse: {fmtG(l.tax)}</span>}
                    <div className={s.spacer}/>
                    {partialIdx === i ? (
                      <div className={s.partialBox}>
                        <span className={s.partialLabel}>Venduti:</span>
                        <input type="number" min="1" max={l.qty-1} value={partialQty} onChange={e=>setPartialQty(e.target.value)}
                          onKeyDown={e=>{ if(e.key==="Enter"){ const q=parseInt(partialQty, 10); if(q>0&&q<l.qty) markListingSold(i,q) } if(e.key==="Escape"){setPartialIdx(null);setPartialQty("")} }}
                          autoFocus style={{ ...inp({ width:65, padding:"4px 8px", fontSize:13, textAlign:"center" }) }}/>
                        <span className={s.partialLabel}>/ {l.qty}</span>
                        {partialQty && !isNaN(parseInt(partialQty, 10)) && parseInt(partialQty, 10) > 0 && parseInt(partialQty, 10) < l.qty && l.buyPrice != null && (() => {
                          const sq = parseInt(partialQty, 10)
                          const pTax = l.tax ? Math.round(l.tax * sq / l.qty) : 0
                          const pProfit = (l.listPrice - l.buyPrice) * Math.min(sq, l.coveredQty || 0) - pTax
                          return <span className={s.partialProfit} style={{ color:pProfit>=0?C.green:C.red }}>
                            {pProfit>=0?"▲":"▼"}{fmtG(Math.abs(pProfit))}
                          </span>
                        })()}
                        <button onClick={()=>{ const q=parseInt(partialQty, 10); if(q>0&&q<l.qty) markListingSold(i,q) }}
                          disabled={!partialQty||isNaN(parseInt(partialQty, 10))||parseInt(partialQty, 10)<=0||parseInt(partialQty, 10)>=l.qty}
                          style={{ ...pill(!!(partialQty&&!isNaN(parseInt(partialQty, 10))&&parseInt(partialQty, 10)>0&&parseInt(partialQty, 10)<l.qty), C.green, { padding:"4px 10px", fontSize:11 }), flexShrink:0 }}>CONFERMA</button>
                        <button onClick={()=>{setPartialIdx(null);setPartialQty("")}} className={s.delBtn}>✕</button>
                      </div>
                    ) : (
                      <div className={s.actionRow}>
                        <button onClick={()=>markListingSold(i)} title="Venduto tutto"
                          style={{ ...pill(false, C.green, { padding:"5px 12px", fontSize:12 }) }}>✓ TUTTO</button>
                        {l.qty > 1 && <button onClick={()=>{setPartialIdx(i);setPartialQty("")}} title="Vendita parziale"
                          style={{ ...pill(false, C.blue, { padding:"5px 10px", fontSize:12 }) }}>½</button>}
                      </div>
                    )}
                    <button onClick={()=>delListing(i)} className={s.delBtn14}>✕</button>
                  </div>
                )
              })}
            </div>

            {listings.filter(l=>l.sold).length > 0 && (<>
              <div className={s.sectionLabel}>STORICO VENDITE</div>
              <VirtualList
                items={soldListings}
                estimateSize={37}
                gap={3}
                className={s.soldList}
                renderItem={({ listing: l, idx: i }) => {
                  const timeToSell   = fmtSellTime(l.listedAt, l.soldAt!)
                  const msToSell     = new Date(l.soldAt!).getTime() - new Date(l.listedAt).getTime()
                  const covered      = l.coveredQty || 0
                  const profitTotal  = covered > 0 ? calcListingProfit(l) : null
                  return (
                    <div className={`r ${s.soldRow}`}>
                      <span className={s.soldTimestamp}>{fmtFull(l.listedAt)}</span>
                      <span className={s.soldQtyPrice}>×{l.qty} @ {fmtG(l.listPrice)}</span>
                      <div className={s.soldStatusCol}>
                        <span className={s.soldLabel}>✓ venduto</span>
                        <span className={s.soldTime} style={{ color:msToSell<86400000?C.green:msToSell<3*86400000?C.gold:C.red }}>
                          ⏱ {timeToSell}
                        </span>
                      </div>
                      {profitTotal != null && (
                        <span className={s.soldProfit} style={{ color:profitTotal>=0?C.green:C.red }}>
                          {profitTotal>=0?"▲":"▼"} {fmtG(profitTotal)}
                        </span>
                      )}
                      {l.lotLinks && l.lotLinks.length > 0 && (
                        <span className={s.listingLots}>
                          [{l.lotLinks.map(lk => `${lk.qty}x${fmtG(lk.unitPrice)}`).join(' + ')}]
                        </span>
                      )}
                      {l.tax > 0 && <span className={s.tax}>tasse: {fmtG(l.tax)}</span>}
                      <div className={s.spacer}/>
                      <button onClick={()=>delListing(i)} className={s.delBtn14}>✕</button>
                    </div>
                  )
                }}
              />
            </>)}
          </div>
        </div>
      )}

      {/* ══════════════ CHARTS TAB ══════════════ */}
      {subPage === "charts" && (
        <div>
          <div className={s.chartDayRow}>
            <span className={s.chartDayLabel}>GIORNO:</span>
            {allDays.length === 0 && <span className={s.chartNoData}>Nessun dato ancora</span>}
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

          {dayStats && (
            <div className={s.dayStatsRow}>
              {[
                { l:"ULTIMO",   v:fmtG(dayStats.last),  c:C.gold },
                { l:"MIN",      v:fmtG(dayStats.min),   c:C.green },
                { l:"MAX",      v:fmtG(dayStats.max),   c:C.red },
                { l:"MEDIA",    v:fmtG(dayStats.avg),   c:C.text },
                { l:"DELTA",    v:(dayStats.delta>=0?"+":"")+fmtG(dayStats.delta), c:dayStats.delta>=0?C.green:C.red },
              ].map(st => (
                <div key={st.l} className={s.dayStatCard}>
                  <div className={s.dayStatLabel}>{st.l}</div>
                  <div className={s.dayStatValue} style={{ color:st.c }}>{st.v}</div>
                </div>
              ))}
            </div>
          )}

          <div className={s.panelChart}>
            <div className={s.chartTitle}>
              INTRADAY — {chartDay}
              {data.events?.[chartDay] && data.events[chartDay]!=="none" && (
                <span style={{ marginLeft:10, color:allEVT[data.events[chartDay]]?.color }}>
                  {allEVT[data.events[chartDay]]?.icon} {allEVT[data.events[chartDay]]?.label}
                </span>
              )}
            </div>
            {chartPoints.length < 2 ? (
              <div className={s.chartEmpty}>
                {chartPoints.length===0 ? "Nessun dato per questo giorno" : "Registra almeno 2 prezzi per il grafico"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartPoints} margin={{ top:5, right:20, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="time" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }}/>
                  <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickFormatter={(v: number)=>fmtG(v)}/>
                  <Tooltip
                    contentStyle={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:8, fontSize:12, color:C.text }}
                    labelStyle={{ color:C.muted }}
                    formatter={(v: number,_: unknown,p: { payload?: ChartPoint }) => [
                      `${v.toLocaleString("it-IT")} ori (${fmtG(v)})${p.payload?.eventId&&p.payload.eventId!=="none"?" "+allEVT[p.payload.eventId]?.icon:""}${p.payload?.note?" — "+p.payload.note:""}`,
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

          {multiDayChart.length >= 2 && (
            <div className={s.panelChart}>
              <div className={s.multiDayTitle}>STORICO MULTI-GIORNO — NORMALE vs EVENTO</div>
              <div className={s.multiDaySub}>
                Linea oro = media giornaliera · Verde = giorni normali · Arancio = giorni con evento
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={multiDayChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }}/>
                  <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickFormatter={(v: number)=>fmtG(v)}/>
                  <Tooltip
                    contentStyle={{ background:C.panel, border:`1px solid ${C.border2}`, borderRadius:8, fontSize:12, color:C.text }}
                    formatter={(v: number, n: string) => v!=null ? [`${v.toLocaleString("it-IT")} ori (${fmtG(v)})`, n==="media"?"Media tot":n==="normale"?"Giorni normali":"Giorni evento"] : ["—"]}
                  />
                  <Legend formatter={v=><span style={{ color:C.muted, fontSize:11 }}>{v==="media"?"Media":v==="normale"?"Normale":"Evento"}</span>}/>
                  <Line type="monotone" dataKey="media"   stroke={C.gold}  strokeWidth={2}   dot={(p)=>{const{cx,cy,payload}=p;return<circle key={`m${cx}`} cx={cx} cy={cy} r={payload.hasEvent?7:4} fill={payload.hasEvent?C.gold:C.panel} stroke={C.gold} strokeWidth={2}/>}}/>
                  <Line type="monotone" dataKey="normale" stroke={C.green} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                  <Line type="monotone" dataKey="evento"  stroke={C.orange} strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>
                </LineChart>
              </ResponsiveContainer>
              {allStats?.avgEvent && allStats?.avgNormal && (
                <div className={s.multiDayDiff}>
                  Diff. media evento vs normale:{" "}
                  <span className={s.mono} style={{ color:allStats.avgEvent>allStats.avgNormal?C.green:C.red }}>
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
  )
})
