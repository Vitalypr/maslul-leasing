import { describe, it, expect } from 'vitest'
import { splitByTreatment } from '../../src/engine/money'
import type { MoneyLine } from '../../src/engine/types'

const line = (
  id: string, annualAmount: number, treatment: MoneyLine['treatment']
): MoneyLine => ({
  id, labelHe: id, category: 'supplement', annualAmount, treatment,
  trace: { formulaHe: '', inputs: {}, sourceRef: '' }
})

describe('splitByTreatment', () => {
  it('net moves cash only', () => {
    const r = splitByTreatment([line('a', 7737.48, 'net')])
    expect(r.cash).toBe(7737.48)
    expect(r.taxableDelta).toBe(0)
  })

  it('taxableBenefit moves taxable income only', () => {
    const r = splitByTreatment([line('uv', 43574.4, 'taxableBenefit')])
    expect(r.cash).toBe(0)
    expect(r.taxableDelta).toBe(43574.4)
  })

  it('gross moves cash out and taxable income down by the same amount', () => {
    const r = splitByTreatment([line('pre', 5000, 'gross')])
    expect(r.cash).toBe(5000)
    expect(r.taxableDelta).toBe(-5000)
  })

  it('grossedUp moves cash without touching taxable income', () => {
    const r = splitByTreatment([line('refund', -7000, 'grossedUp')])
    expect(r.cash).toBe(-7000)
    expect(r.taxableDelta).toBe(0)
  })

  it('combines a realistic ledger', () => {
    const r = splitByTreatment([
      line('supplement', 7737.48, 'net'),
      line('usageValue', 43574.4, 'taxableBenefit'),
      line('fuelCredit', -5400, 'net'),
    ])
    expect(r.cash).toBe(2337.48)
    expect(r.taxableDelta).toBe(43574.4)
  })
})
