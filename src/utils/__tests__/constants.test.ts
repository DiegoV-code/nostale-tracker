import { describe, it, expect } from "vitest"
import { EVENTS, EVT, SIGNAL_DEFAULTS, SIGNAL_GROUPS, CATEGORIES, ND_DISCOUNTS, LOT_STRATEGIES, mkInit } from "../constants"

describe("EVENTS / EVT", () => {
  it("has a 'none' event", () => {
    expect(EVENTS.find(e => e.id === "none")).toBeDefined()
    expect(EVT.none).toBeDefined()
    expect(EVT.none.id).toBe("none")
  })

  it("EVT is a mirror of EVENTS array", () => {
    for (const e of EVENTS) {
      expect(EVT[e.id]).toBe(e)
    }
  })

  it("each event has id, label, color, icon", () => {
    for (const e of EVENTS) {
      expect(typeof e.id).toBe("string")
      expect(typeof e.label).toBe("string")
      expect(typeof e.color).toBe("string")
      expect(typeof e.icon).toBe("string")
    }
  })
})

describe("SIGNAL_DEFAULTS", () => {
  it("has all required thresholds", () => {
    expect(SIGNAL_DEFAULTS).toHaveProperty("strongBuy")
    expect(SIGNAL_DEFAULTS).toHaveProperty("buy")
    expect(SIGNAL_DEFAULTS).toHaveProperty("high")
    expect(SIGNAL_DEFAULTS).toHaveProperty("overpriced")
    expect(SIGNAL_DEFAULTS).toHaveProperty("sell")
  })

  it("thresholds are positive numbers", () => {
    for (const v of Object.values(SIGNAL_DEFAULTS)) {
      expect(typeof v).toBe("number")
      expect(v).toBeGreaterThan(0)
    }
  })
})

describe("SIGNAL_GROUPS", () => {
  it("first group is __all__ with null types", () => {
    expect(SIGNAL_GROUPS[0].id).toBe("__all__")
    expect(SIGNAL_GROUPS[0].types).toBeNull()
  })

  it("all non-all groups have types array", () => {
    for (const g of SIGNAL_GROUPS.slice(1)) {
      expect(Array.isArray(g.types)).toBe(true)
      expect(g.types!.length).toBeGreaterThan(0)
    }
  })
})

describe("CATEGORIES", () => {
  it("starts with '—' placeholder", () => {
    expect(CATEGORIES[0]).toBe("—")
  })

  it("includes Item Shop ND", () => {
    expect(CATEGORIES).toContain("Item Shop ND")
  })
})

describe("ND_DISCOUNTS", () => {
  it("starts with 0 (no discount)", () => {
    expect(ND_DISCOUNTS[0]).toBe(0)
  })

  it("is sorted ascending", () => {
    for (let i = 1; i < ND_DISCOUNTS.length; i++) {
      expect(ND_DISCOUNTS[i]).toBeGreaterThan(ND_DISCOUNTS[i - 1])
    }
  })
})

describe("LOT_STRATEGIES", () => {
  it("contains fifo, lifo, best_price", () => {
    const ids = LOT_STRATEGIES.map(s => s.id)
    expect(ids).toContain("fifo")
    expect(ids).toContain("lifo")
    expect(ids).toContain("best_price")
  })
})

describe("mkInit", () => {
  it("returns a fresh object each call", () => {
    const a = mkInit()
    const b = mkInit()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it("has expected top-level keys", () => {
    const d = mkInit()
    expect(d.items).toEqual({})
    expect(d.events).toEqual({})
    expect(d.signalConfig).toEqual(SIGNAL_DEFAULTS)
    expect(d.ndRate).toBe(0)
    expect(d.globalNdDisc).toBe(0)
    expect(d.trendDays).toBe(7)
    expect(d.lotStrategy).toBe("fifo")
    expect(d.customCategories).toEqual([])
    expect(d.customEvents).toEqual([])
    expect(d.customNdDiscounts).toEqual([])
    expect(d.qRecent).toEqual([])
  })

  it("signalConfig is a clone, not a reference", () => {
    const d = mkInit()
    d.signalConfig.strongBuy = 999
    expect(SIGNAL_DEFAULTS.strongBuy).not.toBe(999)
  })
})
