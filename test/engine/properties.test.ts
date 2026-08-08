import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import fleet from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * Properties that must hold across the whole input space, not just at the
 * points a unit test happens to pick.
 *
 * These came out of a 2,240-case sweep — salaries 15k–45k, mileage 15k–45k,
 * five fuel-budget steps, both service tiers, charging on and off, seven cars
 * spanning every powertrain and both supplement rates — checked against an
 * independently written oracle. The sweep found nothing. These assertions are
 * what stop a future change from breaking what the sweep proved.
 *
 * The quota here is 35,000 rather than the bundled 24,000 because that is the
 * figure the excess-kilometre behaviour was specified against.
 */

const QUOTA = 35000

const policy = {
  ...policyJson,
  mileage: { ...policyJson.mileage, annualQuotaKm: QUOTA },
} as never

const IDS = [
  'kia-picanto-lxplus',          // under both budgets — no supplement at all
  'skoda-octavia-selection',
  'toyota-corolla-cross-active',
  'chery-tiggo7-phev-comfort',
  'skoda-kodiaq-adv',            // the 2.32% rate
  'chery-tiggo8-phev-comfort',   // 2.32% and a plug-in
  'opel-mokka-mhev-gsline',      // mild hybrid — taxed and fuelled as petrol
] as const

const SALARIES = [15000, 25000, 35000, 45000]
const KMS = [15000, 25000, 35000, 45000]
const STEPS = [0, 1, 2, 3, 4]
const TIERS = ['C', 'D'] as const

const vehicleOf = (id: string) =>
  (fleet.vehicles as never[]).find((v: never) => (v as { id: string }).id === id)!

function run(
  id: string, salary: number, annualKm: number,
  step: number, tier: 'C' | 'D', chargesDaily: boolean,
) {
  return calculate({
    vehicle: vehicleOf(id),
    employee: {
      grossMonthlySalary: salary, creditPoints: 2.25, serviceTier: tier,
      commuteOneWayKm: 34, workDaysPerMonth: 21, annualKm,
      rambiEligible: false, chargesDaily,
      monthlyFuelBudgetIce: 800 + 200 * step,
      monthlyFuelBudgetElectrified: 1000 + 200 * step,
      receivesLicenseFee: false, receivesPrivateInsurance: false,
      receivesServiceVehicleTierC: false, receivesFixedNet: false,
      receivesVariableNet: false,
      licenseFeeAnnualPaid: 0,
      privateInsuranceAnnualPaid: 0,
      serviceVehicleTierCMonthly: 0,
      fixedNetMonthly: 0,
      variableNetMonthly: 0,
      installsCharger: false,
      chargerInstallCost: 0,
    },
    policy, taxRules: taxRules as never, prices: prices as never,
  })
}

const line = (r: ReturnType<typeof calculate>, id: string) =>
  r.lines.find(l => l.id === id)?.annualAmount ?? 0

/** Every combination, so a property failure names the exact case. */
function* all() {
  for (const id of IDS)
    for (const salary of SALARIES)
      for (const annualKm of KMS)
        for (const step of STEPS)
          for (const tier of TIERS)
            for (const chargesDaily of [true, false])
              yield { id, salary, annualKm, step, tier, chargesDaily }
}

describe('engine properties across the input space', () => {
  it('charges for excess kilometres only above the quota, and exactly at the rate', () => {
    for (const c of all()) {
      const r = run(c.id, c.salary, c.annualKm, c.step, c.tier, c.chargesDaily)
      const want = c.annualKm <= QUOTA
        ? 0
        : (c.annualKm - QUOTA) * policyJson.mileage.excessRatePerKm
      expect(line(r, 'excessKm'), JSON.stringify(c)).toBeCloseTo(want, 2)
    }
  })

  it('never makes charging a plug-in cost more than not charging', () => {
    for (const id of IDS)
      for (const salary of SALARIES)
        for (const annualKm of KMS)
          for (const step of STEPS)
            for (const tier of TIERS) {
              const on = run(id, salary, annualKm, step, tier, true).annualNet
              const off = run(id, salary, annualKm, step, tier, false).annualNet
              expect(on, `${id} ${annualKm}km`).toBeLessThanOrEqual(off + 0.011)
            }
  })

  it('never makes a larger fuel budget cost the employee more', () => {
    for (const id of IDS)
      for (const salary of SALARIES)
        for (const annualKm of KMS)
          for (const tier of TIERS) {
            const v = STEPS.map(s => run(id, salary, annualKm, s, tier, true).annualNet)
            for (let i = 0; i < v.length - 1; i++)
              expect(v[i + 1]!, `${id} step ${i}`).toBeLessThanOrEqual(v[i]! + 0.011)
          }
  })

  it('never makes more kilometres cost less', () => {
    for (const id of IDS)
      for (const salary of SALARIES)
        for (const step of STEPS) {
          const v = KMS.map(k => run(id, salary, k, step, 'C', true).annualNet)
          for (let i = 0; i < v.length - 1; i++)
            expect(v[i + 1]!, `${id} km ${KMS[i]}`).toBeGreaterThanOrEqual(v[i]! - 0.011)
        }
  })

  it('never charges tier D more than tier C', () => {
    for (const id of IDS) {
      const c = line(run(id, 25000, 25000, 0, 'C', true), 'upgradeSupplement')
      const d = line(run(id, 25000, 25000, 0, 'D', true), 'upgradeSupplement')
      expect(d, id).toBeLessThanOrEqual(c + 0.011)
    }
  })

  it('keeps the unused-fuel credit within the supplement, and zero without one', () => {
    for (const c of all()) {
      const r = run(c.id, c.salary, c.annualKm, c.step, c.tier, c.chargesDaily)
      const credit = -line(r, 'unusedFuelCredit')
      const supplement = line(r, 'upgradeSupplement')
      expect(credit, JSON.stringify(c)).toBeLessThanOrEqual(supplement + 0.011)
      // Math.abs, not toBe(0): negating an absent line yields -0, and
      // Object.is(-0, 0) is false. That is a trap in the assertion, not a
      // defect in the engine.
      if (supplement === 0) expect(Math.abs(credit), JSON.stringify(c)).toBe(0)
    }
  })

  it('never reimburses more fuel than was actually spent', () => {
    for (const c of all()) {
      const r = run(c.id, c.salary, c.annualKm, c.step, c.tier, c.chargesDaily)
      const spend = line(r, 'fuelCost') + line(r, 'electricityCost')
      expect(-line(r, 'fuelBudget'), JSON.stringify(c)).toBeLessThanOrEqual(spend + 0.011)
    }
  })

  it('keeps usage value independent of salary, mileage, budget and tier', () => {
    for (const id of IDS) {
      const seen = new Set<number>()
      for (const c of all()) {
        if (c.id !== id) continue
        seen.add(line(run(c.id, c.salary, c.annualKm, c.step, c.tier, c.chargesDaily), 'usageValue'))
      }
      expect(seen.size, id).toBe(1)
    }
  })

  it('never lowers the tax on the same benefit as salary rises', () => {
    for (const id of IDS) {
      const v = SALARIES.map(s => run(id, s, 25000, 0, 'C', true).annualTaxDelta)
      for (let i = 0; i < v.length - 1; i++)
        expect(v[i + 1]!, `${id} salary ${SALARIES[i]}`).toBeGreaterThanOrEqual(v[i]! - 0.011)
    }
  })
})

describe('hand-verified reference case', () => {
  /**
   * Worked by hand from the 2026 brackets, independently of the engine:
   *   supplement  2.15% x 164,990 - 2.15% x 135,000 = 644.79/mo  -> 7,737.48
   *   usage value 164,990 x 2.48%, no reduction for petrol       -> 49,101.00
   *   fuel        35,000 / 20.0 km/l x 8.09                      -> 14,157.50
   *   budget      800 x 12, capped at what was spent             ->  -9,600.00
   *   tax         [tax(29,091.75) - tax(25,000)] x 12            -> 23,112.96
   *
   * The consumption is the Israeli importer's disclosed 5.0 l/100km for the
   * 1.5 TSI Selection, not the 15.5 km/l this file first assumed.
   */
  it('reproduces the worked example to the agora', () => {
    const r = run('skoda-octavia-selection', 25000, 35000, 0, 'C', false)
    expect(line(r, 'upgradeSupplement')).toBeCloseTo(7737.48, 2)
    expect(line(r, 'usageValue')).toBeCloseTo(49101.00, 2)
    expect(line(r, 'fuelCost')).toBeCloseTo(14157.50, 2)
    expect(line(r, 'fuelBudget')).toBeCloseTo(-9600.00, 2)
    expect(line(r, 'excessKm')).toBe(0)          // exactly at quota: no charge
    expect(r.annualCash).toBeCloseTo(12294.98, 2)
    expect(r.annualTaxDelta).toBeCloseTo(23112.96, 2)
    expect(r.annualNet).toBeCloseTo(35407.94, 2)
    expect(r.monthlyNet).toBeCloseTo(2950.66, 2)
  })

  it('gives a mild hybrid no usage-value reduction', () => {
    // 150,990 x 2.48% = 3,744.55/mo. A hybrid would get 560 off; mhev does not.
    const r = run('opel-mokka-mhev-gsline', 25000, 25000, 0, 'C', false)
    expect(line(r, 'usageValue')).toBeCloseTo(3744.55 * 12, 1)
  })

  it('applies the plug-in reduction of 1,130', () => {
    // 169,990 x 2.48% = 4,215.75, less 1,130 => 3,085.75/mo
    const r = run('chery-tiggo7-phev-comfort', 25000, 25000, 0, 'C', true)
    expect(line(r, 'usageValue')).toBeCloseTo(3085.75 * 12, 1)
  })
})
