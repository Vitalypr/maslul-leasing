import { describe, it, expect } from 'vitest'
import policy from '../../src/data/policy/org.json'
import { supplementMonthly } from '../../src/engine/contributors/leaseSupplement'

describe('supplementMonthly', () => {
  it('is zero at or below the tier C budget', () => {
    expect(supplementMonthly(135000, 'C', 0.0215, false, policy)).toBe(0)
    expect(supplementMonthly(120990, 'C', 0.0215, false, policy)).toBe(0)
  })

  it('matches the published table for tier C', () => {
    expect(supplementMonthly(135990, 'C', 0.0215, false, policy)).toBe(21.29)
    expect(supplementMonthly(164990, 'C', 0.0215, false, policy)).toBe(644.79)
    expect(supplementMonthly(184990, 'C', 0.0215, false, policy)).toBe(1074.79)
  })

  it('matches the published table for tier D', () => {
    expect(supplementMonthly(155888, 'D', 0.0215, false, policy)).toBe(19.09)
    expect(supplementMonthly(164990, 'D', 0.0215, false, policy)).toBe(214.79)
    expect(supplementMonthly(154990, 'D', 0.0215, false, policy)).toBe(0)
  })

  it('keeps tier C and tier D exactly 430 apart once both are positive', () => {
    const c = supplementMonthly(176888, 'C', 0.0215, false, policy)
    const d = supplementMonthly(176888, 'D', 0.0215, false, policy)
    expect(c - d).toBeCloseTo(430, 2)
  })

  it('applies the vehicle-specific high rate', () => {
    expect(supplementMonthly(229990, 'C', 0.0232, false, policy)).toBe(2433.27)
    expect(supplementMonthly(189990, 'C', 0.0232, false, policy)).toBe(1505.27)
  })

  it('halves the amount for a rambi-eligible employee', () => {
    expect(supplementMonthly(229990, 'C', 0.0232, true, policy)).toBe(1216.64)
  })
})
