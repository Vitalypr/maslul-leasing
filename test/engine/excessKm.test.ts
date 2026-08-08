import { describe, it, expect } from 'vitest'
import { excessKmAnnual } from '../../src/engine/contributors/excessKm'

describe('excessKmAnnual', () => {
  it('charges nothing inside the quota', () => {
    expect(excessKmAnnual(20000, 24000, 0.40)).toBe(0)
  })
  it('charges nothing exactly at the quota', () => {
    expect(excessKmAnnual(24000, 24000, 0.40)).toBe(0)
  })
  it('charges the rate on every kilometre over', () => {
    expect(excessKmAnnual(26000, 24000, 0.40)).toBe(800)
  })
  it('is a step, not a slope — one km over already costs', () => {
    expect(excessKmAnnual(24001, 24000, 0.40)).toBe(0.4)
  })
})
