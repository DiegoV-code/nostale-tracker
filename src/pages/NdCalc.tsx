import React, { memo } from "react"
import { C, inp } from "../utils/theme"
import { fmtG, parseG } from "../utils/formatting"
import { useNav } from "../contexts/NavigationContext"
import { useData } from "../contexts/DataContext"
import StatBar from "../components/StatBar"
import s from "./NdCalc.module.css"

export interface NdItem {
  name: string
  ndCost: number
  ndQty: number
  disc: number
  useCost: number
  marketPrice: number | null
  costGold: number
  revenue: number | null
  profit: number | null
}

export interface NdItemsResult {
  list: NdItem[]
  profitable: number
  losing: number
  bestProfit: number | null
}

interface NdCalcProps {
  ndRateInput: string
  setNdRateInput: React.Dispatch<React.SetStateAction<string>>
  ndBuyQty: string
  setNdBuyQty: React.Dispatch<React.SetStateAction<string>>
  globalNdDisc: number
  setGlobalNdDisc: React.Dispatch<React.SetStateAction<number>>
  allNdDiscounts: number[]
  ndItems: NdItemsResult
}

export default memo(function NdCalc({ ndRateInput, setNdRateInput, ndBuyQty, setNdBuyQty, globalNdDisc, setGlobalNdDisc, allNdDiscounts, ndItems }: NdCalcProps) {
  const { setSelItem, setPage, setSubPage } = useNav()
  const { data, upd } = useData()
  return (
    <div className="up">
      <div className={s.sectionLabel}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="9" fill={C.purple} stroke={C.purple} strokeWidth="1.5"/>
          <text x="10" y="14.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" fontFamily="monospace">$</text>
        </svg>
        NOS DOLLARI
      </div>

      {/* Rate + Calculator */}
      <div className={s.topRow}>
        {/* ND Rate */}
        <div className={s.panelRate}>
          <div className={s.panelLabel}>TASSO ND (oro per 1 ND)</div>
          <div className={s.flexRow}>
            <input value={ndRateInput} onChange={e => setNdRateInput(e.target.value)} onBlur={e => {
              const v = parseG(e.target.value)
              if (!isNaN(v) && v >= 0) upd({ ...data, ndRate: Math.round(v) })
            }} onKeyDown={e => { if(e.key==="Enter") (e.target as HTMLInputElement).blur() }}
            placeholder="es. 5k" style={inp({ fontSize:15, color:C.gold, fontWeight:700, width:140 })}/>
            <span className={s.unitLabel}>oro / ND</span>
          </div>
          {data?.ndRate > 0 && <div className={s.rateHint}>{fmtG(data.ndRate)} per ND</div>}
        </div>

        {/* ND Calculator */}
        <div className={s.panelCalc}>
          <div className={s.panelLabel}>CALCOLATORE ND</div>
          <div className={s.flexRow}>
            <input type="number" value={ndBuyQty} onChange={e=>setNdBuyQty(e.target.value)} placeholder="es. 500" style={inp({ fontSize:15, width:110 })}/>
            <span className={s.unitLabel}>ND =</span>
            <span className={s.goldValue}>
              {ndBuyQty && !isNaN(parseInt(ndBuyQty, 10)) && data?.ndRate ? fmtG(parseInt(ndBuyQty, 10) * data.ndRate) : "—"}
            </span>
          </div>
        </div>

        {/* Event discount selector */}
        <div className={s.panelDiscount} style={{ borderColor: globalNdDisc > 0 ? C.amber : undefined }}>
          <div className={s.panelLabel}>SCONTO EVENTO</div>
          <div className={s.discountRow}>
            {allNdDiscounts.map(d => (
              <button key={d} onClick={()=>{ setGlobalNdDisc(d); upd({ ...data, globalNdDisc: d }) }}
                className={s.discBtn}
                style={{ border:`1px solid ${globalNdDisc===d?(d>0?C.amber:C.border):C.border}`, background:globalNdDisc===d?(d>0?`${C.amber}2e`:`${C.text}0d`):"transparent", color:globalNdDisc===d?(d>0?C.amber:C.text):C.muted }}>
                {d === 0 ? "OFF" : `-${d}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ND Items Table */}
      {ndItems.list.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>💎</span>
          <span className={s.emptyText}>NESSUN ITEM "ITEM SHOP ND"</span>
          <span className={s.emptyHint}>Crea un item e assegna la categoria "Item Shop ND"</span>
        </div>
      ) : (<>
        {/* summary */}
        {data?.ndRate > 0 && (
          <StatBar mb={14} items={[
              { l:"ITEM ND",          v:ndItems.list.length + "",                                    c:C.text  },
              { l:"PROFITTEVOLI",     v:ndItems.profitable + "",                               c:C.green },
              { l:"IN PERDITA",       v:ndItems.losing + "",                                   c:C.red   },
              { l:"MIGLIOR PROFITTO", v:ndItems.bestProfit != null ? fmtG(ndItems.bestProfit) : "—", c:C.green },
          ]}/>
        )}

        {/* header */}
        <div className={s.tableHeader}>
          <div className={s.colItem}>ITEM</div>
          <div className={s.colNd}>ND{globalNdDisc > 0 ? ` (-${globalNdDisc}%)` : ""}</div>
          <div className={s.colQty}>PZ</div>
          <div className={s.colWide}>MERCATO</div>
          <div className={s.colWide}>COSTO ORO</div>
          <div className={s.colWide}>RICAVO</div>
          <div className={s.colWide}>PROFITTO</div>
        </div>

        <div className={s.tableBody}>
          {[...ndItems.list].sort((a,b) => (b.profit||0) - (a.profit||0)).map(r => (
            <div key={r.name} className={`r ${s.tableRow}`}
              onClick={()=>{ setSelItem(r.name); setPage("item"); setSubPage("prices") }}>
              <div className={s.itemName}>{r.name}</div>
              <div className={s.cellNd} style={{ color: r.disc > 0 ? C.amber : C.text }}>
                {r.useCost > 0 ? r.useCost : "—"}
                {r.disc > 0 && r.useCost !== r.ndCost && <span className={s.ndStrike}>{r.ndCost}</span>}
              </div>
              <div className={s.cellQty}>×{r.ndQty}</div>
              <div className={s.cellData} style={{ color: r.marketPrice != null ? C.text : C.muted }}>{r.marketPrice!=null?fmtG(r.marketPrice):"—"}</div>
              <div className={s.cellData} style={{ color: r.costGold > 0 ? C.red : C.muted }}>{r.costGold>0?fmtG(r.costGold):"—"}</div>
              <div className={s.cellData} style={{ color: r.revenue != null ? C.green : C.muted }}>{r.revenue!=null?fmtG(r.revenue):"—"}</div>
              <div className={s.cellProfit} style={{ color: r.profit != null ? (r.profit >= 0 ? C.green : C.red) : C.muted }}>
                {r.profit!=null ? `${r.profit>=0?"▲":"▼"} ${fmtG(Math.abs(r.profit))}` : "—"}
              </div>
            </div>
          ))}
        </div>

        {/* inline edit section */}
        <div className={s.editSection}>
          <div className={s.editLabel}>CONFIGURA ITEM ND</div>
          <div className={s.editList}>
            {ndItems.list.map(r => {
              const it = data.items[r.name]
              return (
                <div key={r.name} className={s.editRow}>
                  <span className={s.editName}>{r.name}</span>
                  <div className={s.editField}>
                    <span className={s.editFieldLabel}>ND:</span>
                    <input type="number" min="0" step="1" defaultValue={it.meta?.ndCost || ""} onBlur={e => {
                      const v = parseInt(e.target.value, 10) || 0
                      const updated = { ...it, meta: { ...it.meta, ndCost: v } }
                      upd({ ...data, items: { ...data.items, [r.name]: updated } })
                    }} onKeyDown={e => { if(e.key==="Enter") (e.target as HTMLInputElement).blur() }} placeholder="0" style={inp({ width:70, padding:"4px 8px", fontSize:12, textAlign:"center" })}/>
                  </div>
                  <div className={s.editField}>
                    <span className={s.editFieldLabel}>PZ:</span>
                    <input type="number" min="1" step="1" defaultValue={it.meta?.ndQty || ""} onBlur={e => {
                      const v = parseInt(e.target.value, 10) || 1
                      const updated = { ...it, meta: { ...it.meta, ndQty: v } }
                      upd({ ...data, items: { ...data.items, [r.name]: updated } })
                    }} onKeyDown={e => { if(e.key==="Enter") (e.target as HTMLInputElement).blur() }} placeholder="1" style={inp({ width:60, padding:"4px 8px", fontSize:12, textAlign:"center" })}/>
                  </div>
                  <div className={s.editField}>
                    <span className={s.editFieldLabelAmber}>sconto:</span>
                    <select value={it.meta?.ndDiscount || 0} onChange={e => {
                      const v = parseInt(e.target.value, 10)
                      const updated = { ...it, meta: { ...it.meta, ndDiscount: v } }
                      upd({ ...data, items: { ...data.items, [r.name]: updated } })
                    }} className={s.selectBase} style={{ color: (it.meta?.ndDiscount||0) > 0 ? C.amber : C.muted }}>
                      {allNdDiscounts.map(d => <option key={d} value={d}>{d===0?"—":`-${d}%`}</option>)}
                    </select>
                    {(it.meta?.ndDiscount||0) > 0 && (it.meta?.ndCost ?? 0) > 0 && (
                      <span className={s.discountResult}>= {Math.ceil(it.meta!.ndCost! * (1 - (it.meta!.ndDiscount!)/100))} ND</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>)}
    </div>
  )
})
