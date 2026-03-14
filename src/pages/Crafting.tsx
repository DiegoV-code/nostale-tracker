import { useState, memo } from "react"
import { C, inp, pill } from "../utils/theme"
import { fmtG, parseG } from "../utils/formatting"
import { useNav } from "../contexts/NavigationContext"
import { useData } from "../contexts/DataContext"
import type { RecipeIngredient, Recipe } from "../types"
import s from "./Crafting.module.css"

/** Prezzo di riferimento per un ingrediente: fixedPrice oppure ultimo prezzo tracciato */
function getIngPrice(ing: RecipeIngredient, items: Record<string, { prices: { price: number | null; esaurito?: boolean }[] }>): number | null {
  if (ing.fixedPrice != null) return ing.fixedPrice
  const ps = items[ing.itemName]?.prices || []
  const real = ps.filter(p => !p.esaurito)
  return real.length ? real[real.length - 1].price : null
}

export default memo(function Crafting() {
  const { setSelItem, setPage, setSubPage } = useNav()
  const { data, upd } = useData()

  // form state
  const [selRecipeItem, setSelRecipeItem] = useState("")
  const [craftQty, setCraftQty] = useState("1")
  const [ingName, setIngName] = useState("")
  const [ingQty, setIngQty] = useState("")
  const [ingFixed, setIngFixed] = useState("")
  const [tempIngs, setTempIngs] = useState<RecipeIngredient[]>([])
  const [editing, setEditing] = useState<string | null>(null) // item name being edited

  const itemNames = Object.keys(data.items || {}).sort((a, b) => a.localeCompare(b))
  const craftableItems = itemNames.filter(n => data.items[n]?.meta?.recipe)

  const addIngredient = () => {
    const name = ingName.trim()
    const qty = parseInt(ingQty, 10)
    if (!name || isNaN(qty) || qty <= 0) return
    const fixed = ingFixed.trim() ? parseG(ingFixed) : undefined
    if (ingFixed.trim() && (isNaN(fixed!) || fixed! <= 0)) return
    // No duplicates
    if (tempIngs.some(i => i.itemName === name)) return
    setTempIngs([...tempIngs, { itemName: name, qty, fixedPrice: fixed != null && !isNaN(fixed) ? Math.round(fixed) : undefined }])
    setIngName(""); setIngQty(""); setIngFixed("")
  }

  const removeIngredient = (idx: number) => {
    setTempIngs(tempIngs.filter((_, i) => i !== idx))
  }

  const saveRecipe = () => {
    const target = editing || selRecipeItem
    if (!target || !data.items[target] || tempIngs.length === 0) return
    const cq = parseInt(craftQty, 10)
    if (isNaN(cq) || cq <= 0) return
    const recipe: Recipe = { ingredients: tempIngs, craftQty: cq }
    const it = { ...data.items[target], meta: { ...data.items[target].meta, recipe } }
    upd({ ...data, items: { ...data.items, [target]: it } })
    resetForm()
  }

  const deleteRecipe = (name: string) => {
    const meta = { ...data.items[name].meta }
    delete meta.recipe
    const it = { ...data.items[name], meta }
    upd({ ...data, items: { ...data.items, [name]: it } })
  }

  const startEdit = (name: string) => {
    const recipe = data.items[name]?.meta?.recipe
    if (!recipe) return
    setEditing(name)
    setSelRecipeItem(name)
    setCraftQty(String(recipe.craftQty))
    setTempIngs([...recipe.ingredients])
  }

  const resetForm = () => {
    setEditing(null); setSelRecipeItem(""); setCraftQty("1")
    setTempIngs([]); setIngName(""); setIngQty(""); setIngFixed("")
  }

  const calcCraftCost = (recipe: Recipe): number | null => {
    let total = 0
    for (const ing of recipe.ingredients) {
      const p = getIngPrice(ing, data.items)
      if (p == null) return null
      total += p * ing.qty
    }
    return recipe.craftQty > 0 ? Math.round(total / recipe.craftQty) : null
  }

  return (
    <div className="up">
      <div className={s.sectionLabel}>🔨 CRAFTING — GESTIONE RICETTE</div>

      {/* ── FORM ── */}
      <div className={s.formWrap}>
        <div className={s.formTitle}>{editing ? `✏️ MODIFICA RICETTA — ${editing}` : "➕ NUOVA RICETTA"}</div>

        {!editing && (
          <div className={s.formRow}>
            <div className={s.formCol} style={{ flex: 1 }}>
              <div className={s.formLabel}>ITEM DA CRAFTARE</div>
              <select value={selRecipeItem} onChange={e => setSelRecipeItem(e.target.value)} style={inp({ fontSize: 13 })}>
                <option value="">— Seleziona item —</option>
                {itemNames.filter(n => !data.items[n]?.meta?.recipe).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className={s.formCol} style={{ width: 100 }}>
              <div className={s.formLabel}>PRODUCE</div>
              <input value={craftQty} onChange={e => setCraftQty(e.target.value)} placeholder="1" style={inp({ fontSize: 13, textAlign: "center" })} />
            </div>
          </div>
        )}

        {editing && (
          <div className={s.formRow}>
            <div className={s.formCol} style={{ width: 100 }}>
              <div className={s.formLabel}>PRODUCE</div>
              <input value={craftQty} onChange={e => setCraftQty(e.target.value)} placeholder="1" style={inp({ fontSize: 13, textAlign: "center" })} />
            </div>
          </div>
        )}

        {/* ingredient input */}
        <div className={s.formRow}>
          <div className={s.formCol} style={{ flex: 1 }}>
            <div className={s.formLabel}>INGREDIENTE</div>
            <input
              list="ing-suggestions"
              value={ingName}
              onChange={e => setIngName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addIngredient()}
              placeholder="Nome (item tracciato o NPC)"
              style={inp({ fontSize: 13 })}
            />
            <datalist id="ing-suggestions">
              {itemNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className={s.formCol} style={{ width: 70 }}>
            <div className={s.formLabel}>QTÀ</div>
            <input value={ingQty} onChange={e => setIngQty(e.target.value)} onKeyDown={e => e.key === "Enter" && addIngredient()} placeholder="1" style={inp({ fontSize: 13, textAlign: "center" })} />
          </div>
          <div className={s.formCol} style={{ width: 120 }}>
            <div className={s.formLabel}>PREZZO FISSO</div>
            <input value={ingFixed} onChange={e => setIngFixed(e.target.value)} onKeyDown={e => e.key === "Enter" && addIngredient()} placeholder="NPC (opz.)" style={inp({ fontSize: 13 })} />
          </div>
          <button onClick={addIngredient} style={{ ...pill(!!ingName.trim() && !!ingQty, C.gold, { padding: "9px 14px", fontSize: 12 }), alignSelf: "flex-end" }}>+</button>
        </div>

        {/* temp ingredients list */}
        {tempIngs.length > 0 && (
          <div className={s.ingList}>
            {tempIngs.map((ing, i) => {
              const p = getIngPrice(ing, data.items)
              return (
                <div key={i} className={s.ingRow}>
                  <span className={s.ingRowQty}>×{ing.qty}</span>
                  <span className={s.ingRowName}>{ing.itemName}</span>
                  <span className={s.ingRowType}>{ing.fixedPrice != null ? "NPC" : itemNames.includes(ing.itemName) ? "Bazar" : "?"}</span>
                  <span className={s.ingRowPrice}>{p != null ? fmtG(p * ing.qty) : "—"}</span>
                  <button className={s.ingRowDel} onClick={() => removeIngredient(i)}>✕</button>
                </div>
              )
            })}
          </div>
        )}

        {/* save/cancel */}
        <div className={s.formRow}>
          <button
            onClick={saveRecipe}
            disabled={!(editing || selRecipeItem) || tempIngs.length === 0}
            style={pill(!!(editing || selRecipeItem) && tempIngs.length > 0, C.gold, { padding: "10px 20px", fontSize: 13 })}>
            {editing ? "💾 SALVA MODIFICHE" : "💾 SALVA RICETTA"}
          </button>
          {editing && (
            <button onClick={resetForm} style={pill(false, C.muted, { padding: "10px 16px", fontSize: 12 })}>ANNULLA</button>
          )}
        </div>
      </div>

      {/* ── RECIPE CARDS ── */}
      {craftableItems.length === 0 ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>🔨</span>
          Nessuna ricetta configurata. Usa il form sopra per aggiungere la prima.
        </div>
      ) : (
        <div className={s.grid}>
          {craftableItems.map(name => {
            const recipe = data.items[name].meta.recipe!
            const craftCost = calcCraftCost(recipe)
            const ps = data.items[name].prices.filter(p => !p.esaurito)
            const lastPrice = ps.length ? ps[ps.length - 1].price : null
            const profit = craftCost != null && lastPrice != null ? lastPrice - craftCost : null
            return (
              <div key={name} className={s.card} onClick={() => { setSelItem(name); setPage("item"); setSubPage("prices") }}>
                <div className={s.cardName}>{name}</div>
                <div className={s.cardIngredients}>
                  {recipe.ingredients.map((ing, i) => {
                    const p = getIngPrice(ing, data.items)
                    return (
                      <div key={i} className={s.cardIngredient}>
                        <span className={s.cardIngQty}>×{ing.qty}</span>
                        <span className={s.cardIngName}>{ing.itemName}</span>
                        <span className={s.cardIngPrice}>{p != null ? fmtG(p * ing.qty) : "—"}</span>
                      </div>
                    )
                  })}
                </div>
                {recipe.craftQty > 1 && <div className={s.cardYield}>Produce ×{recipe.craftQty}</div>}
                <div className={s.cardFooter}>
                  <div className={s.cardCost}>
                    Costo craft: <span className={s.cardCostValue}>{craftCost != null ? fmtG(craftCost) : "—"}</span>
                  </div>
                  <div className={s.cardProfit} style={{ color: profit != null ? (profit >= 0 ? C.green : C.red) : C.muted }}>
                    {profit != null ? `${profit >= 0 ? "+" : ""}${fmtG(profit)}` : "—"}
                  </div>
                </div>
                {/* edit/delete buttons */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={e => { e.stopPropagation(); startEdit(name) }} style={pill(false, C.gold, { padding: "4px 10px", fontSize: 10 })}>✏️ Modifica</button>
                  <button onClick={e => { e.stopPropagation(); deleteRecipe(name) }} style={pill(false, C.red, { padding: "4px 10px", fontSize: 10 })}>🗑 Elimina</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
