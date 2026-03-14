import { describe, it, expect } from "vitest"
import { fmtG, parseG, breakDuration, fmtDurationMs, fmtAge } from "../formatting"

/* ══════════════════════════════════════
   fmtG — gold formatter
══════════════════════════════════════ */
describe("fmtG", () => {
  it("returns dash for null/undefined/NaN", () => {
    expect(fmtG(null)).toBe("—")
    expect(fmtG(undefined)).toBe("—")
    expect(fmtG(NaN)).toBe("—")
  })

  it("formats small values as ori", () => {
    expect(fmtG(0)).toBe("0 ori")
    expect(fmtG(500)).toBe("500 ori")
    expect(fmtG(999)).toBe("999 ori")
  })

  it("formats thousands as k", () => {
    expect(fmtG(1000)).toBe("1k")
    expect(fmtG(1500)).toBe("1.5k")
    expect(fmtG(150000)).toBe("150k")
    expect(fmtG(999999)).toBe("1000k")
  })

  it("formats millions as kk", () => {
    expect(fmtG(1000000)).toBe("1kk")
    expect(fmtG(1500000)).toBe("1.5kk")
    expect(fmtG(12345678)).toBe("12.35kk")
    expect(fmtG(100000000)).toBe("100kk")
    expect(fmtG(999000000)).toBe("999kk")
  })

  it("formats billions as kkk", () => {
    expect(fmtG(1000000000)).toBe("1kkk")
    expect(fmtG(2500000000)).toBe("2.5kkk")
  })

  it("handles negative values", () => {
    expect(fmtG(-5000)).toBe("-5k")
    expect(fmtG(-1500000)).toBe("-1.5kk")
    expect(fmtG(-500)).toBe("-500 ori")
  })

  it("long format with short=false", () => {
    expect(fmtG(150000, false)).toMatch(/150.*000 ori/)
    expect(fmtG(0, false)).toBe("0 ori")
  })
})

/* ══════════════════════════════════════
   parseG — gold parser
══════════════════════════════════════ */
describe("parseG", () => {
  it("returns NaN for empty/null/undefined", () => {
    expect(parseG("")).toBeNaN()
    expect(parseG(null)).toBeNaN()
    expect(parseG(undefined)).toBeNaN()
  })

  it("parses plain numbers", () => {
    expect(parseG("1000")).toBe(1000)
    expect(parseG("150000")).toBe(150000)
    expect(parseG("0")).toBe(0)
  })

  it("parses k suffix", () => {
    expect(parseG("150k")).toBe(150000)
    expect(parseG("1.5k")).toBe(1500)
    expect(parseG("5K")).toBe(5000)
  })

  it("parses kk suffix", () => {
    expect(parseG("1kk")).toBe(1000000)
    expect(parseG("1.5kk")).toBe(1500000)
    expect(parseG("12kk")).toBe(12000000)
  })

  it("parses kkk suffix", () => {
    expect(parseG("1kkk")).toBe(1000000000)
    expect(parseG("2.5kkk")).toBe(2500000000)
  })

  it("parses m suffix as millions", () => {
    expect(parseG("1m")).toBe(1000000)
    expect(parseG("1.5m")).toBe(1500000)
  })

  it("parses b suffix as billions", () => {
    expect(parseG("1b")).toBe(1000000000)
    expect(parseG("2.5b")).toBe(2500000000)
  })

  it("handles commas as decimal separators", () => {
    expect(parseG("1,5k")).toBe(1500)
    expect(parseG("1,5kk")).toBe(1500000)
  })

  it("returns NaN for negative values", () => {
    expect(parseG("-5k")).toBeNaN()
  })

  it("returns NaN for garbage", () => {
    expect(parseG("abc")).toBeNaN()
    expect(parseG("k")).toBeNaN()
  })
})

/* ══════════════════════════════════════
   breakDuration
══════════════════════════════════════ */
describe("breakDuration", () => {
  it("breaks ms into days/hours/minutes", () => {
    expect(breakDuration(0)).toEqual({ d: 0, h: 0, m: 0 })
    expect(breakDuration(60000)).toEqual({ d: 0, h: 0, m: 1 })
    expect(breakDuration(3600000)).toEqual({ d: 0, h: 1, m: 0 })
    expect(breakDuration(86400000)).toEqual({ d: 1, h: 0, m: 0 })
    expect(breakDuration(90060000)).toEqual({ d: 1, h: 1, m: 1 })
  })

  it("clamps negatives to zero", () => {
    expect(breakDuration(-1000)).toEqual({ d: 0, h: 0, m: 0 })
  })
})

/* ══════════════════════════════════════
   fmtDurationMs
══════════════════════════════════════ */
describe("fmtDurationMs", () => {
  it("formats minutes only", () => {
    expect(fmtDurationMs(300000)).toBe("5min")
    expect(fmtDurationMs(0)).toBe("0min")
  })

  it("formats hours + minutes", () => {
    expect(fmtDurationMs(3660000)).toBe("1h 1min")
    expect(fmtDurationMs(7200000)).toBe("2h 0min")
  })

  it("formats days + hours", () => {
    expect(fmtDurationMs(86400000)).toBe("1g 0h")
    expect(fmtDurationMs(90000000)).toBe("1g 1h")
  })
})

/* ══════════════════════════════════════
   fmtAge — dd:hh:mm format
══════════════════════════════════════ */
describe("fmtAge", () => {
  it("formats zero", () => {
    expect(fmtAge(0)).toBe("00:00:00")
  })

  it("formats days:hours:minutes with padding", () => {
    expect(fmtAge(86400000)).toBe("01:00:00")
    expect(fmtAge(90060000)).toBe("01:01:01")
    expect(fmtAge(864000000)).toBe("10:00:00")
  })
})
