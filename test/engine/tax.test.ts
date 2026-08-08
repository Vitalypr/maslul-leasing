import { describe, it, expect } from 'vitest'
import rules from '../../src/data/tax-rules/2026.json'
import { incomeTaxMonthly } from '../../src/engine/tax/incomeTax'
import { socialInsuranceMonthly, socialInsuranceParts } from '../../src/engine/tax/socialInsurance'
import { deltaTaxAnnual } from '../../src/engine/tax/marginal'

describe('incomeTaxMonthly', () => {
  it('is zero when credit points exceed the tax due', () => {
    // 5,000 -> 500 tax; 2.25 points = 544.50 credit
    expect(incomeTaxMonthly(5000, 2.25, rules)).toBe(0)
  })

  it('walks the brackets cumulatively, not at a flat rate', () => {
    // 7010*.10=701 + 3050*.14=427 + 1940*.20=388  => 1516, minus 544.50
    expect(incomeTaxMonthly(12000, 2.25, rules)).toBe(971.5)
  })

  it('applies the top bracket above the surtax threshold', () => {
    const t = incomeTaxMonthly(60000, 2.25, rules)
    const justBelow = incomeTaxMonthly(58190, 2.25, rules)
    expect(round(t - justBelow)).toBe(round((60000 - 58190) * 0.50))
  })
})

describe('socialInsuranceMonthly', () => {
  it('uses the combined reduced rate of 4.27% below the threshold', () => {
    // 5000 * (0.0104 + 0.0323) = 213.50
    expect(socialInsuranceMonthly(5000, rules)).toBe(213.5)
  })

  it('uses the combined full rate of 12.17% above the threshold', () => {
    // 7703*0.0427 = 328.9181 ; 44207*0.1217 = 5379.9919
    expect(socialInsuranceMonthly(51910, rules)).toBeCloseTo(5708.91, 2)
  })

  it('stops charging above the ceiling of 51,910', () => {
    expect(socialInsuranceMonthly(51910, rules)).toBe(socialInsuranceMonthly(80000, rules))
  })

  it('reports the two components separately and they sum to the total', () => {
    const parts = socialInsuranceParts(30000, rules)
    expect(round(parts.nationalInsurance + parts.healthInsurance))
      .toBe(socialInsuranceMonthly(30000, rules))
  })

  it('holds the two statutory components split so they add to the headline rates', () => {
    const ni = rules.nationalInsuranceMonthlyBrackets
    const health = rules.healthInsuranceMonthlyBrackets
    // 1.04 + 3.23 = 4.27
    expect(round((ni[0]!.rate + health[0]!.rate) * 100)).toBe(4.27)
    // 7 + 5.17 = 12.17
    expect(round((ni[1]!.rate + health[1]!.rate) * 100)).toBe(12.17)
    expect(ni[1]!.upTo).toBe(51910)
    expect(health[1]!.upTo).toBe(51910)
  })
})

describe('deltaTaxAnnual', () => {
  it('is the difference of two full computations, never a flat percentage', () => {
    const salary = 28400 * 12
    const uv = 3631.2 * 12
    const d = deltaTaxAnnual(salary, uv, 2.25, rules)
    const flat = uv * 0.35
    expect(d).not.toBe(flat)
    expect(d).toBeGreaterThan(0)
  })

  it('captures a bracket crossing', () => {
    // 18,900/mo sits just under the 19,000 boundary; adding 400 crosses it,
    // so part is taxed at 20% and part at 31%.
    const d = deltaTaxAnnual(18900 * 12, 400 * 12, 2.25, rules)
    const allAt20 = 400 * 12 * 0.20
    const allAt31 = 400 * 12 * 0.31
    expect(d).toBeGreaterThan(allAt20)
    expect(d).toBeLessThan(allAt31 + 400 * 12 * 0.12 + 1)
  })

  it('returns zero for no change', () => {
    expect(deltaTaxAnnual(28400 * 12, 0, 2.25, rules)).toBe(0)
  })

  it('is negative for a pre-tax deduction', () => {
    expect(deltaTaxAnnual(28400 * 12, -5000, 2.25, rules)).toBeLessThan(0)
  })
})

const round = (n: number) => Math.round(n * 100) / 100
