import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import fleet from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * The annual fuel settlement must be on screen whether or not it pays out.
 *
 * This exists because it was not. The row was emitted only when the credit was
 * non-zero, which is the ordinary rule for a ledger and the wrong rule for this
 * line: a reader who overspends their budget goes looking for their refund,
 * finds no row at all, and reasonably concludes the app has lost it. The
 * absence of money has to be stated, not implied by an absence of a row.
 *
 * The case that produced the report: a BYD ATTO2 at 45,000 km a year on a
 * ₪1,000 monthly budget. Energy runs ₪14,179 against a ₪12,000 budget, so the
 * credit is genuinely nil — and the row now says so, and by how much.
 */

const vehicle = (id: string) =>
  (fleet.vehicles as never[]).find((v: never) => (v as { id: string }).id === id)!

type Over = { annualKm?: number; budget?: number; commuteOneWayKm?: number }

const run = (id: string, o: Over = {}) => calculate({
  vehicle: vehicle(id),
  employee: {
    grossMonthlySalary: 35000, creditPoints: 2.25, serviceTier: 'C',
    commuteOneWayKm: o.commuteOneWayKm ?? 50, wfhDaysPerWeek: 0,
    annualKm: o.annualKm ?? 45000,
    rambiEligible: false, chargesDaily: true,
    monthlyFuelBudgetIce: o.budget ?? 1000,
    monthlyFuelBudgetElectrified: o.budget ?? 1000,
    receivesLicenseFee: false, receivesPrivateInsurance: false,
    receivesServiceVehicleTierC: false, receivesFixedNet: false,
    receivesVariableNet: false, licenseFeeAnnualPaid: 0,
    privateInsuranceAnnualPaid: 0, serviceVehicleTierCMonthly: 0,
    fixedNetMonthly: 0, variableNetMonthly: 0,
    installsCharger: false, chargerInstallCost: 0,
  },
  policy: policy as never, taxRules: taxRules as never, prices: prices as never,
})

const settlement = (id: string, o: Over = {}) =>
  run(id, o).ledger.find(l => l.id === 'unusedFuelCredit')

describe('the annual fuel settlement', () => {
  it('appears even when it settles to nothing', () => {
    // Petrol alone (7,435) outruns a 6,000 budget, so there is nothing back.
    const line = settlement('byd-atto2-boost', { budget: 500 })
    expect(line).toBeDefined()
    expect(line?.annualAmount).toBe(0)
  })

  it('names the overspend rather than going silent', () => {
    const line = settlement('byd-atto2-boost', { budget: 500 })
    expect(line?.trace.formulaHe).toContain('חריגה')
    expect(line?.trace.formulaHe).toContain('אין החזר')
    // 6,000 budget against 7,435.22 of petrol.
    expect(line?.trace.inputs['overspend']).toBeCloseTo(1435.22, 1)
    expect(line?.trace.inputs['unused']).toBe(0)
  })

  /*
   * The correction that produced these numbers: the employer budgets petrol,
   * not energy. Home charging is the employee's own bill and must never be
   * reimbursed from, or measured against, the fuel budget.
   */
  it('measures the budget against petrol alone, never against charging', () => {
    const line = settlement('byd-atto2-boost')
    // 14,705 petrol km / 16 km/l x 8.09 = 7,435.22. The 3,464 of electricity
    // is the employee's and must not appear here.
    expect(line?.trace.inputs['annualSpend']).toBeCloseTo(7435.22, 1)
    expect(line?.trace.inputs['unused']).toBeCloseTo(4564.78, 1)
    expect(line?.annualAmount).toBeCloseTo(-4564.78, 1)
  })

  it('leaves charging fully on the employee, and says so', () => {
    const elec = run('byd-atto2-boost').ledger.find(l => l.id === 'electricityCost')
    expect(elec?.annualAmount).toBeCloseTo(3463.81, 1)
    expect(elec?.trace.formulaHe).toContain('העובד משלם אותה בעצמו')
  })

  /*
   * The 2026 fleet is 17 petrol, 14 hybrid, 11 plug-in and one mild hybrid —
   * no battery car. The engine handles one, and if a battery car is ever added
   * this is the case that matters: its whole budget goes unused, its refund is
   * capped at the supplement, and none of its charging is reimbursed. There is
   * nothing in the catalogue to assert that against today, so this is a note
   * rather than a test that would pass by accident.
   */
  it('never lets the refund exceed what the supplement allows', () => {
    const line = settlement('byd-atto2-boost', { annualKm: 6000, commuteOneWayKm: 8 })
    const cap = line?.trace.inputs['annualSupplement'] ?? 0
    expect(cap).toBeCloseTo(5157.48, 2)
    expect(Math.abs(line?.annualAmount ?? 0)).toBeLessThanOrEqual(cap + 0.011)
  })

  it('pays out, capped at the supplement, when the driving is light', () => {
    const line = settlement('byd-atto2-boost', { annualKm: 9000, commuteOneWayKm: 10 })
    // 429.79 x 12 = 5,157.48 of supplement to offset.
    expect(line?.annualAmount).toBeCloseTo(-5157.48, 2)
    expect(line?.trace.formulaHe).toContain('תקרה')
  })

  it('is settled once a year, and says so, in both directions', () => {
    for (const km of [9000, 45000])
      expect(settlement('byd-atto2-boost', { annualKm: km })?.cadenceHe)
        .toContain('מסולק פעם בשנה')
  })

  /*
   * The monthly column shows a twelfth of the refund, which is not a number
   * anybody receives. The annual sum has to travel with the label because the
   * ledger scales a line to the chosen horizon before rendering it, and the
   * year cannot be reconstructed from what arrives.
   */
  it('carries the annual sum in the label, not just the cadence', () => {
    expect(settlement('byd-atto2-boost')?.cadenceHe).toBe('מסולק פעם בשנה · ₪4,565 בשנה')
  })

  it('names no sum when there is no refund to name', () => {
    expect(settlement('byd-atto2-boost', { budget: 500 })?.cadenceHe)
      .toBe('מסולק פעם בשנה')
  })

  it('never appears when the employer budgets nothing', () => {
    expect(settlement('byd-atto2-boost', { budget: 0 })).toBeUndefined()
  })

  it('leaves the total untouched when it settles to nothing', () => {
    // A row of zero must not move the closing figure, or the fix would have
    // bought clarity with a wrong number.
    const r = run('byd-atto2-boost')
    const sum = r.ledger.reduce((a, l) => a + l.annualAmount, 0)
    expect(sum).toBeCloseTo(r.annualNet, 2)
  })
})

describe('the petrol line explains its own kilometres', () => {
  const trace = (o: Over = {}) =>
    run('byd-atto2-boost', o).ledger.find(l => l.id === 'fuelCost')?.trace.formulaHe ?? ''

  it('shows both buckets and marks the ones that empty the battery', () => {
    const f = trace()
    expect(f).toContain('83')                    // measured range, not the claimed 90
    expect(f).toContain('210 ימים')            // commuting days
    expect(f).toContain('155 ימים')            // the rest of the year
    // 100 km commuting and 155 km otherwise, so both run the battery flat.
    expect(f.match(/הסוללה נגמרת/g)).toHaveLength(2)
    expect(f).toContain('33%')                   // the petrol share of 45,000 km
  })

  /*
   * The case the old model got wrong. A 40 km round trip fits inside the
   * battery, so the commute is entirely electric — but 36,600 km spread over
   * the remaining 155 days is 236 a day, which is not. Before, every one of
   * those kilometres was petrol; now the battery takes its 83 a day first.
   */
  it('marks only the bucket that runs out', () => {
    const f = trace({ commuteOneWayKm: 20 })
    expect(f).toContain('210 ימים × 40 ק"מ → 40 על חשמל')
    expect(f.match(/הסוללה נגמרת/g)).toHaveLength(1)
  })

  it('stays quiet on a car that only burns petrol', () => {
    const f = run('kia-picanto-lxplus').ledger.find(l => l.id === 'fuelCost')?.trace.formulaHe ?? ''
    expect(f).not.toContain('סוללה')
  })
})
