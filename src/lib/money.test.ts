import { describe, expect, it } from 'vitest'

import { calculateEarning } from './money'

describe('calculateEarning', () => {
  it("matches the brief's reference case", () => {
    expect(calculateEarning(12345, 1500)).toEqual({
      gross: 18517,
      fee: 3704,
      net: 14813,
    })
  })

  it('takes the fee as the remainder, not as its own rounded value', () => {
    // gross 18517: floor(gross * 0.8) = 14813, but gross - floor(gross * 0.2)
    // would give 14814. The brief's number is the first one.
    const { gross, net } = calculateEarning(12345, 1500)
    expect(net).toBe(Math.floor((gross * 80) / 100))
    expect(net).not.toBe(gross - Math.floor((gross * 20) / 100))
  })

  it('reconciles gross === net + fee across the seed range', () => {
    for (const cpm of [900, 1000, 1200, 1500, 1800, 2000, 2200, 2500]) {
      for (let views = 0; views < 3000; views += 7) {
        const { gross, fee, net } = calculateEarning(views, cpm)
        expect(net + fee).toBe(gross)
        expect(Number.isInteger(gross) && Number.isInteger(net)).toBe(true)
        expect(fee).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('rounds a partial rupiah down, never up', () => {
    // 666 * 1500 / 1000 = 999.0 exactly; 667 -> 1000.5 floors to 1000.
    expect(calculateEarning(666, 1500).gross).toBe(999)
    expect(calculateEarning(667, 1500).gross).toBe(1000)
  })

  it('is all zeroes when views are too low to be worth a rupiah', () => {
    expect(calculateEarning(0, 2500)).toEqual({ gross: 0, fee: 0, net: 0 })
    // 399 * 2500 / 1000 = 997.5 -> 997; the smallest cpm needs 2 views.
    expect(calculateEarning(1, 900)).toEqual({ gross: 0, fee: 0, net: 0 })
  })

  it('rejects input that is not a whole non-negative amount', () => {
    expect(() => calculateEarning(1.5, 1500)).toThrow()
    expect(() => calculateEarning(-1, 1500)).toThrow()
    expect(() => calculateEarning(100, 0)).toThrow()
  })
})
