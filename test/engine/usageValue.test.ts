import { describe, it, expect } from 'vitest'
import rules from '../../src/data/tax-rules/2026.json'
import { usageValueMonthly } from '../../src/engine/tax/usageValue'

describe('usageValueMonthly', () => {
  it('is 2.48% of list price for petrol', () => {
    expect(usageValueMonthly(178000, 'ice', rules)).toBe(4414.4)
  })

  it('subtracts 560 for a hybrid', () => {
    expect(usageValueMonthly(169000, 'hybrid', rules)).toBe(3631.2)
  })

  it('subtracts 1130 for a plug-in', () => {
    expect(usageValueMonthly(195000, 'phev', rules)).toBe(3706)
  })

  it('gives mild hybrid no reduction — it is not a hybrid for tax', () => {
    expect(usageValueMonthly(150990, 'mhev', rules))
      .toBe(usageValueMonthly(150990, 'ice', rules))
  })

  it('caps the list price at the ceiling', () => {
    expect(usageValueMonthly(900000, 'ice', rules))
      .toBe(usageValueMonthly(596860, 'ice', rules))
  })

  it('never goes below zero', () => {
    expect(usageValueMonthly(30000, 'bev', rules)).toBe(0)
  })

  it('uses the chosen vehicle price, not any entitlement cap', () => {
    // A 155,000 car is taxed as a 155,000 car even if entitlement is 135,000.
    expect(usageValueMonthly(155000, 'ice', rules)).toBe(3844)
  })
})
