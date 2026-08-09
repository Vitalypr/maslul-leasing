import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import fleet from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * The ledger is what the reader adds up. If its rows disagree with its total,
 * the app is wrong in the only way a reader can check unaided.
 *
 * This exists because they did disagree: שווי שימוש was printed at its imputed
 * value (2,714/mo on the BYD ATTO2) in a column of costs, while the tax it
 * actually caused (1,280 at a 35,000 salary) appeared nowhere. The column
 * overstated itself by 1,434 a month.
 */
const vehicle = (id: string) =>
  (fleet.vehicles as never[]).find((v: never) => (v as { id: string }).id === id)!

const run = (id: string, salary = 35000) => calculate({
  vehicle: vehicle(id),
  employee: {
    grossMonthlySalary: salary, creditPoints: 2.25, serviceTier: 'C',
    commuteOneWayKm: 34, workDaysPerMonth: 21, annualKm: 36000,
    rambiEligible: false, chargesDaily: true,
    monthlyFuelBudgetIce: 800, monthlyFuelBudgetElectrified: 1000,
    receivesLicenseFee: false, receivesPrivateInsurance: false,
    receivesServiceVehicleTierC: false, receivesFixedNet: false,
    receivesVariableNet: false, licenseFeeAnnualPaid: 0,
    privateInsuranceAnnualPaid: 0, serviceVehicleTierCMonthly: 0,
    fixedNetMonthly: 0, variableNetMonthly: 0,
    installsCharger: false, chargerInstallCost: 0,
  },
  policy: policy as never, taxRules: taxRules as never, prices: prices as never,
})

const IDS = [
  'byd-atto2-boost', 'skoda-octavia-selection', 'kia-picanto-lxplus',
  'toyota-corolla-cross-active', 'skoda-kodiaq-adv',
]

describe('the ledger adds up', () => {
  it('sums to the annual net for every powertrain and salary', () => {
    for (const id of IDS)
      for (const salary of [15000, 25000, 35000, 45000]) {
        const r = run(id, salary)
        const sum = r.ledger.reduce((s, l) => s + l.annualAmount, 0)
        expect(sum, `${id} @${salary}`).toBeCloseTo(r.annualNet, 2)
      }
  })

  it('never prints an imputed benefit as if it were a cost', () => {
    for (const id of IDS) {
      expect(run(id).ledger.some(l => l.treatment === 'taxableBenefit'), id).toBe(false)
    }
  })

  it('carries the tax on the benefit, not the benefit', () => {
    // 154,990 x 2.48% - 1,130 plug-in reduction = 2,713.75 a month imputed.
    // At 35,000 that is taxed at 35% + 12.17% = 1,280.07 a month.
    const r = run('byd-atto2-boost', 35000)
    const tax = r.ledger.find(l => l.id === 'usageValueTax')!
    expect(tax.annualAmount / 12).toBeCloseTo(1280.07, 1)
    expect(r.lines.find(l => l.id === 'usageValue')!.annualAmount / 12)
      .toBeCloseTo(2713.75, 2)
    expect(tax.trace.inputs['usageValueMonthly']).toBeCloseTo(2713.75, 2)
    expect(tax.trace.inputs['effectiveMarginalRate']).toBeCloseTo(47.17, 1)
  })

  it('keeps the computational lines untouched', () => {
    const r = run('byd-atto2-boost')
    expect(r.lines.some(l => l.treatment === 'taxableBenefit')).toBe(true)
  })
})
