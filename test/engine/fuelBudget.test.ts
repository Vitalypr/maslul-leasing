import { describe, it, expect } from 'vitest'
import { unusedFuelCredit } from '../../src/engine/contributors/fuelBudget'

describe('unusedFuelCredit', () => {
  it('credits the unused part of the budget', () => {
    // budget 14,400/yr, spent 9,000 -> 5,400 unused; supplement 7,737 covers it
    expect(unusedFuelCredit(14400, 9000, 7737.48)).toBe(5400)
  })

  it('caps the credit at the annual supplement', () => {
    expect(unusedFuelCredit(14400, 2000, 7737.48)).toBe(7737.48)
  })

  it('pays nothing when there is no supplement to offset', () => {
    expect(unusedFuelCredit(14400, 2000, 0)).toBe(0)
  })

  it('pays nothing when the budget was overspent', () => {
    expect(unusedFuelCredit(9000, 14400, 7737.48)).toBe(0)
  })

  it('pays nothing when the budget was spent exactly', () => {
    expect(unusedFuelCredit(9000, 9000, 7737.48)).toBe(0)
  })

  it('never returns a negative credit', () => {
    expect(unusedFuelCredit(0, 5000, 7737.48)).toBe(0)
  })
})
