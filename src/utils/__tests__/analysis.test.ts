import { describe, it, expect } from "vitest"
import { matchLotsForQty, calcTrend, calcVolatility, calcOpenQty, calcListingProfit, getSignal } from "../analysis"
import type { Lot, PriceEntry, Item } from "../../types"
import type { Palette } from "../../types"

/* ══════════════════════════════════════
   matchLotsForQty — FIFO/LIFO/best_price
══════════════════════════════════════ */
describe("matchLotsForQty", () => {
  const lots: Lot[] = [
    { id: "a", qty: 5, price: 100, sold: false, timestamp: "2024-01-01T00:00:00Z" },
    { id: "b", qty: 3, price: 200, sold: false, timestamp: "2024-01-01T00:00:00Z" },
    { id: "c", qty: 10, price: 50, sold: false, timestamp: "2024-01-01T00:00:00Z" },
  ]

  it("FIFO: takes from first lot first", () => {
    const r = matchLotsForQty(lots, 4, "fifo")
    expect(r.coveredQty).toBe(4)
    expect(r.uncoveredQty).toBe(0)
    expect(r.links).toHaveLength(1)
    expect(r.links[0].lotId).toBe("a")
    expect(r.links[0].qty).toBe(4)
    expect(r.avgBuyPrice).toBe(100)
  })

  it("FIFO: spans multiple lots", () => {
    const r = matchLotsForQty(lots, 7, "fifo")
    expect(r.coveredQty).toBe(7)
    expect(r.links).toHaveLength(2)
    expect(r.links[0].lotId).toBe("a")
    expect(r.links[0].qty).toBe(5)
    expect(r.links[1].lotId).toBe("b")
    expect(r.links[1].qty).toBe(2)
    expect(r.totalCost).toBe(5 * 100 + 2 * 200)
  })

  it("LIFO: takes from last lot first", () => {
    const r = matchLotsForQty(lots, 4, "lifo")
    expect(r.links[0].lotId).toBe("c")
    expect(r.links[0].qty).toBe(4)
    expect(r.avgBuyPrice).toBe(50)
  })

  it("best_price: takes cheapest first", () => {
    const r = matchLotsForQty(lots, 8, "best_price")
    expect(r.links[0].lotId).toBe("c")
    expect(r.links[0].qty).toBe(8)
    expect(r.avgBuyPrice).toBe(50)
  })

  it("handles uncovered quantity", () => {
    const r = matchLotsForQty(lots, 25, "fifo")
    expect(r.coveredQty).toBe(18)
    expect(r.uncoveredQty).toBe(7)
  })

  it("skips sold lots", () => {
    const withSold: Lot[] = [
      { id: "x", qty: 5, price: 100, sold: true, timestamp: "2024-01-01T00:00:00Z" },
      { id: "y", qty: 3, price: 200, sold: false, timestamp: "2024-01-01T00:00:00Z" },
    ]
    const r = matchLotsForQty(withSold, 5, "fifo")
    expect(r.coveredQty).toBe(3)
    expect(r.links[0].lotId).toBe("y")
  })

  it("returns null avgBuyPrice when no lots available", () => {
    const r = matchLotsForQty([], 5, "fifo")
    expect(r.coveredQty).toBe(0)
    expect(r.avgBuyPrice).toBeNull()
    expect(r.links).toHaveLength(0)
  })
})

/* ══════════════════════════════════════
   calcTrend — linear regression
══════════════════════════════════════ */
describe("calcTrend", () => {
  it("returns null with fewer than 2 prices", () => {
    expect(calcTrend([], 7)).toBeNull()
    expect(calcTrend([{ price: 100, timestamp: new Date().toISOString(), eventId: "none" }], 7)).toBeNull()
  })

  it("detects upward trend", () => {
    const now = Date.now()
    const prices: PriceEntry[] = [
      { price: 100, timestamp: new Date(now - 6 * 86400000).toISOString(), eventId: "none" },
      { price: 110, timestamp: new Date(now - 4 * 86400000).toISOString(), eventId: "none" },
      { price: 120, timestamp: new Date(now - 2 * 86400000).toISOString(), eventId: "none" },
      { price: 130, timestamp: new Date(now).toISOString(), eventId: "none" },
    ]
    const t = calcTrend(prices, 7)
    expect(t).not.toBeNull()
    expect(t!.up).toBe(true)
    expect(t!.pct).toBeGreaterThan(0)
    expect(t!.points).toBe(4)
  })

  it("detects downward trend", () => {
    const now = Date.now()
    const prices: PriceEntry[] = [
      { price: 200, timestamp: new Date(now - 5 * 86400000).toISOString(), eventId: "none" },
      { price: 180, timestamp: new Date(now - 3 * 86400000).toISOString(), eventId: "none" },
      { price: 160, timestamp: new Date(now - 1 * 86400000).toISOString(), eventId: "none" },
    ]
    const t = calcTrend(prices, 7)
    expect(t!.up).toBe(false)
    expect(t!.pct).toBeLessThan(0)
  })

  it("excludes esaurito entries", () => {
    const now = Date.now()
    const prices: PriceEntry[] = [
      { price: 100, timestamp: new Date(now - 3 * 86400000).toISOString(), eventId: "none" },
      { price: null, esaurito: true, timestamp: new Date(now - 2 * 86400000).toISOString(), eventId: "none" },
      { price: 110, timestamp: new Date(now).toISOString(), eventId: "none" },
    ]
    const t = calcTrend(prices, 7)
    expect(t).not.toBeNull()
    expect(t!.points).toBe(2)
  })

  it("ignores data outside the window", () => {
    const now = Date.now()
    const prices: PriceEntry[] = [
      { price: 100, timestamp: new Date(now - 30 * 86400000).toISOString(), eventId: "none" },
      { price: 200, timestamp: new Date(now - 1 * 86400000).toISOString(), eventId: "none" },
    ]
    const t = calcTrend(prices, 7)
    // Only 1 point in window
    expect(t).toBeNull()
  })
})

/* ══════════════════════════════════════
   calcVolatility — coefficient of variation
══════════════════════════════════════ */
describe("calcVolatility", () => {
  it("returns null with fewer than 3 prices", () => {
    expect(calcVolatility([])).toBeNull()
    expect(calcVolatility([{ price: 100, timestamp: "", eventId: "none" }, { price: 200, timestamp: "", eventId: "none" }])).toBeNull()
  })

  it("returns zero cv for constant prices", () => {
    const prices: PriceEntry[] = [{ price: 100, timestamp: "", eventId: "none" }, { price: 100, timestamp: "", eventId: "none" }, { price: 100, timestamp: "", eventId: "none" }]
    const v = calcVolatility(prices)
    expect(v!.cv).toBe(0)
    expect(v!.std).toBe(0)
  })

  it("computes cv for varying prices", () => {
    const prices: PriceEntry[] = [{ price: 100, timestamp: "", eventId: "none" }, { price: 200, timestamp: "", eventId: "none" }, { price: 300, timestamp: "", eventId: "none" }]
    const v = calcVolatility(prices)
    expect(v!.cv).toBeGreaterThan(0)
    expect(v!.std).toBeGreaterThan(0)
  })

  it("excludes esaurito entries", () => {
    const prices: PriceEntry[] = [
      { price: 100, timestamp: "", eventId: "none" },
      { price: null, esaurito: true, timestamp: "", eventId: "none" },
      { price: 100, timestamp: "", eventId: "none" },
      { price: 100, timestamp: "", eventId: "none" },
    ]
    const v = calcVolatility(prices)
    expect(v!.cv).toBe(0)
  })
})

/* ══════════════════════════════════════
   calcOpenQty
══════════════════════════════════════ */
describe("calcOpenQty", () => {
  it("returns 0 for empty/null", () => {
    expect(calcOpenQty(null)).toBe(0)
    expect(calcOpenQty({} as Item)).toBe(0)
    expect(calcOpenQty({ lots: [] } as unknown as Item)).toBe(0)
  })

  it("sums open lot quantities", () => {
    const it = {
      lots: [
        { qty: 5, sold: false },
        { qty: 3, sold: true },
        { qty: 10, sold: false },
      ],
    } as unknown as Item
    expect(calcOpenQty(it)).toBe(15)
  })
})

/* ══════════════════════════════════════
   calcListingProfit
══════════════════════════════════════ */
describe("calcListingProfit", () => {
  it("returns null when no buyPrice", () => {
    expect(calcListingProfit({ listPrice: 1000, qty: 5, buyPrice: null })).toBeNull()
    expect(calcListingProfit({ listPrice: 1000, qty: 5, buyPrice: null })).toBeNull()
  })

  it("calculates profit correctly", () => {
    // (listPrice - buyPrice) * coveredQty - tax
    const l = { listPrice: 200, buyPrice: 100, coveredQty: 5, qty: 5, tax: 50 }
    expect(calcListingProfit(l)).toBe((200 - 100) * 5 - 50)
  })

  it("uses qty when coveredQty is missing", () => {
    const l = { listPrice: 200, buyPrice: 100, qty: 3, tax: 0 }
    expect(calcListingProfit(l)).toBe((200 - 100) * 3)
  })

  it("handles zero tax", () => {
    const l = { listPrice: 300, buyPrice: 200, coveredQty: 2, qty: 2 }
    expect(calcListingProfit(l)).toBe((300 - 200) * 2)
  })

  it("returns negative profit when selling at loss", () => {
    const l = { listPrice: 50, buyPrice: 100, coveredQty: 3, qty: 3, tax: 10 }
    expect(calcListingProfit(l)).toBe((50 - 100) * 3 - 10)
  })
})

/* ══════════════════════════════════════
   getSignal — trading signal engine
══════════════════════════════════════ */
describe("getSignal", () => {
  // Mock palette C — only the fields getSignal actually reads
  const C = {
    inputBg: "#1a1d2e",
    purple: "#a78bfa",
    amber: "#f59e0b",
  } as Palette
  const cfg = { strongBuy: 15, buy: 6, high: 6, overpriced: 15, sell: 12 }

  function makeItem(priceList: (number | PriceEntry)[], opts: { lots?: Lot[], meta?: Item["meta"] } = {}): Item {
    return {
      prices: priceList.map((p, i) =>
        typeof p === "object" ? p : { price: p, timestamp: new Date(Date.now() - (priceList.length - i) * 3600000).toISOString(), eventId: "none" }
      ) as PriceEntry[],
      lots: opts.lots || [],
      listings: [],
      meta: opts.meta || {},
    }
  }

  it("returns nodata with fewer than 3 prices", () => {
    expect(getSignal(makeItem([100, 200]), cfg, C).type).toBe("nodata")
    expect(getSignal(makeItem([]), cfg, C).type).toBe("nodata")
    expect(getSignal(null, cfg, C).type).toBe("nodata")
  })

  it("returns esaurito when last entry is esaurito", () => {
    const it = makeItem([100, 110, 120])
    it.prices.push({ price: null, esaurito: true, timestamp: new Date().toISOString(), eventId: "none" })
    expect(getSignal(it, cfg, C).type).toBe("esaurito")
  })

  it("returns strong_buy when price is well below average", () => {
    // avg = 100, current = 80 → diffPct = -20% > strongBuy threshold 15%
    const it = makeItem([100, 100, 100, 100, 80])
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("strong_buy")
    expect(sig.diffPct).toBeLessThan(-0.15)
  })

  it("returns buy when price is moderately below average", () => {
    // avg ≈ 100, current = 92 → diffPct ≈ -8% (between -6% and -15%)
    const it = makeItem([100, 100, 100, 100, 92])
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("buy")
  })

  it("returns overpriced when price is well above average", () => {
    // avg = 100, current = 120 → diffPct = +20% > overpriced threshold 15%
    const it = makeItem([100, 100, 100, 100, 120])
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("overpriced")
  })

  it("returns high when price is moderately above average", () => {
    // avg ≈ 100, current = 108 → diffPct ≈ +8% (between +6% and +15%)
    const it = makeItem([100, 100, 100, 100, 108])
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("high")
  })

  it("returns hold when price is near average", () => {
    const it = makeItem([100, 100, 100, 100, 101])
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("hold")
  })

  it("returns sell when price is above avg buy and stock exists", () => {
    // avg buy = 100, current = 115, sell threshold 12% → should trigger sell
    const it = makeItem([100, 100, 100, 100, 103])
    it.lots = [{ id: "s1", qty: 5, price: 90, sold: false, timestamp: "2024-01-01T00:00:00Z" }]
    const sig = getSignal(it, cfg, C)
    // current 103 vs avgBuy 90 → (103-90)/90 = 14.4% > 12% → sell
    expect(sig.type).toBe("sell")
  })

  it("returns buy_target when price hits buy target", () => {
    const it = makeItem([100, 100, 100, 100, 85])
    it.meta = { buyTarget: 90 }
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("buy_target")
  })

  it("returns sell_target when price hits sell target with stock", () => {
    const it = makeItem([100, 100, 100, 100, 110])
    it.meta = { sellTarget: 105 }
    it.lots = [{ id: "s2", qty: 3, price: 100, sold: false, timestamp: "2024-01-01T00:00:00Z" }]
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("sell_target")
  })

  it("uses normal prices as reference when available", () => {
    // 4 normal prices avg=100, 1 event price=200, current=90
    // If refVals uses normal (avg=100): diffPct = (90-100)/100 = -10% → buy
    const now = Date.now()
    const it: Item = {
      prices: [
        { price: 100, timestamp: new Date(now - 5000).toISOString(), eventId: "none" },
        { price: 100, timestamp: new Date(now - 4000).toISOString(), eventId: "none" },
        { price: 100, timestamp: new Date(now - 3000).toISOString(), eventId: "none" },
        { price: 200, timestamp: new Date(now - 2000).toISOString(), eventId: "happy_hour" },
        { price: 90, timestamp: new Date(now - 1000).toISOString(), eventId: "none" },
      ],
      lots: [],
      listings: [],
      meta: {},
    }
    const sig = getSignal(it, cfg, C)
    expect(sig.type).toBe("buy")
    expect(sig.diffPct).toBeCloseTo(-0.1, 1)
  })
})
