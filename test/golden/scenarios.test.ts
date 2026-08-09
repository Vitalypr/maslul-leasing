import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import { round2 } from '../../src/engine/round'
import { deltaTaxAnnual } from '../../src/engine/tax/marginal'
import type { Employee, Policy, Vehicle } from '../../src/engine/calculate'
import catalog from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * End-to-end scenarios against the real 43-vehicle catalogue and the real
 * policy file. Unit tests prove each formula; these prove the assembly — that
 * a tax treatment set in JSON reaches the total, that the two pipelines stay
 * separate, and that the summary figures reconcile with each other.
 *
 * A JSON import widens every literal, so `powertrain` and each taxTreatment
 * value arrive typed as `string`. The assertions below narrow them.
 * test/data/schema.test.ts is what actually proves the files hold these shapes;
 * without it these casts would be unbacked.
 */
const fleet = catalog.vehicles as readonly Vehicle[]
const basePolicy = policyJson as Policy

const employee: Employee = {
  grossMonthlySalary: 28400,
  creditPoints: 2.25,
  serviceTier: 'C',
  commuteOneWayKm: 34,
  wfhDaysPerWeek: 0,
  annualKm: 26000,
  rambiEligible: false,
  chargesDaily: true,
  monthlyFuelBudgetIce: 1200,
  monthlyFuelBudgetElectrified: 700,
  receivesLicenseFee: false,
  receivesPrivateInsurance: false,
  receivesServiceVehicleTierC: false,
  receivesFixedNet: false,
  receivesVariableNet: false,
  licenseFeeAnnualPaid: 0,
  privateInsuranceAnnualPaid: 0,
  serviceVehicleTierCMonthly: 0,
  fixedNetMonthly: 0,
  variableNetMonthly: 0,
  installsCharger: false,
  chargerInstallCost: 0,
}

function vehicle(id: string): Vehicle {
  const v = fleet.find(x => x.id === id)
  if (!v) throw new Error(`no vehicle "${id}" in the catalogue`)
  return v
}

const run = (id: string, over: Partial<Employee> = {}, org: Policy = basePolicy) =>
  calculate({
    vehicle: vehicle(id),
    employee: { ...employee, ...over },
    policy: org,
    taxRules,
    prices,
  })

/*
 * The forgone amounts belong to the employee now, not to policy — the licence
 * fee follows the car actually owned and the payslip components vary by grade.
 * These scenarios therefore patch the profile.
 */
const withServiceVehicle = { receivesServiceVehicleTierC: true, serviceVehicleTierCMonthly: 1200 }
const withFixedNet = { receivesFixedNet: true, fixedNetMonthly: 900 }

describe('calculate — end to end', () => {
  it('charges no supplement for a car inside the tier C budget', () => {
    const r = run('skoda-fabia-selection')
    expect(r.lines.find(l => l.id === 'upgradeSupplement')).toBeUndefined()
  })

  /**
   * The monthly figure must be the annual one divided by twelve and nothing
   * else — the bug this guards against is a monthly total computed on its own
   * and drifting from the annual one.
   *
   * It is stated in that direction because the reverse is not arithmetically
   * available. Money is rounded to the agora in the engine, so an annual figure
   * that is not a multiple of 0.12 cannot multiply back exactly; the residue is
   * bounded by twelve half-agorot, six agorot a year, against a display in
   * whole shekels.
   */
  it('reconciles: the monthly figure is the annual one divided by twelve', () => {
    const r = run('skoda-octavia-selection')
    expect(r.monthlyNet).toBe(round2(r.annualNet / 12))
    expect(r.monthlyNet * 12).toBeCloseTo(r.annualNet, 0)
  })

  it('adds one-time events on top of 36 monthly payments', () => {
    const r = run('skoda-octavia-selection')
    expect(r.threeYearNet).toBeCloseTo(r.annualNet * 3 + r.oneTimeTotal, 2)
  })

  it('taxes usage value on the chosen car, not on the tier budget', () => {
    const cheap = run('skoda-fabia-selection')
    const dear = run('skoda-kodiaq-adv')
    const uvOf = (r: typeof cheap) =>
      r.lines.find(l => l.id === 'usageValue')!.annualAmount
    expect(uvOf(dear)).toBeGreaterThan(uvOf(cheap))
  })

  /**
   * The supplement is collected after tax (NII audit circular 16). If it ever
   * started reducing taxable income the employee's real cost would drop by
   * roughly half the supplement, silently. Pinning annualTaxableDelta to the
   * usage value alone is what catches that.
   */
  it('deducts the supplement from net — taxable income is unaffected by it', () => {
    const r = run('skoda-octavia-selection')
    const supplement = r.lines.find(l => l.id === 'upgradeSupplement')!
    expect(supplement.treatment).toBe('net')
    const uv = r.lines.find(l => l.id === 'usageValue')!.annualAmount
    expect(r.annualTaxableDelta).toBeCloseTo(uv, 2)
  })

  it('makes a plug-in cheaper to fuel when the driver charges daily', () => {
    const charging = run('chery-tiggo7-phev-comfort')
    const not = run('chery-tiggo7-phev-comfort', { chargesDaily: false })
    const energyOf = (r: typeof charging) => r.lines
      .filter(l => l.category === 'energy')
      .reduce((s, l) => s + l.annualAmount, 0)
    expect(energyOf(charging)).toBeLessThan(energyOf(not))
  })

  it('adds forgone benefits only when the employee receives them', () => {
    const without = run('skoda-octavia-selection')
    const with_ = run('skoda-octavia-selection', {
      receivesLicenseFee: true, licenseFeeAnnualPaid: 1500,
      receivesPrivateInsurance: true, privateInsuranceAnnualPaid: 4200,
    })
    expect(without.forgoneAnnual).toBe(0)
    expect(with_.forgoneAnnual).toBeGreaterThan(0)
    // Forgone benefits sit outside the lease cost and must not silently
    // inflate it. They are reported separately.
    expect(with_.annualNet).toBeCloseTo(without.annualNet, 2)
  })

  /**
   * רכב שירות ג' is a gross salary component. Giving it up also lowers taxable
   * income, so it costs less than the figure printed on the payslip. Summing
   * forgone cash alone would overstate the loss by the marginal rate on it.
   */
  it('prices a forgone gross component below its face value', () => {
    const r = run(
      'skoda-octavia-selection',
      withServiceVehicle,
    )
    expect(r.forgoneCash).toBe(14400)
    expect(r.forgoneTaxDelta).toBeLessThan(0)
    expect(r.forgoneAnnual).toBeLessThan(r.forgoneCash)
    expect(r.forgoneAnnual).toBeCloseTo(r.forgoneCash + r.forgoneTaxDelta, 2)
  })

  /**
   * The forgone delta is measured on top of the lease's own taxable change, not
   * against a bare salary — if the employee takes the car, both happen at once
   * and land on the same marginal rate.
   *
   * At 44,000 a month the two answers separate: the usage value carries the
   * employee over the 46,690 income-tax boundary, so the component comes off at
   * 47% rather than 35%. Pricing it against the bare salary would value the
   * loss about 1,700 a year too low. The earlier scenario cannot see this —
   * there both positions sit inside the same bracket.
   */
  it('prices a forgone gross component at the bracket the lease pushes it to', () => {
    const r = run(
      'skoda-octavia-selection',
      { grossMonthlySalary: 44000, ...withServiceVehicle },
    )
    const againstBareSalary = deltaTaxAnnual(44000 * 12, -14400, 2.25, taxRules)
    expect(r.forgoneTaxDelta).toBeLessThan(againstBareSalary)
    expect(r.forgoneAnnual).toBeLessThan(r.forgoneCash + againstBareSalary)
  })

  it('leaves the lease cost untouched by a forgone gross component', () => {
    const without = run('skoda-octavia-selection')
    const with_ = run(
      'skoda-octavia-selection',
      withServiceVehicle,
    )
    expect(with_.annualNet).toBeCloseTo(without.annualNet, 2)
    expect(with_.annualTaxableDelta).toBeCloseTo(without.annualTaxableDelta, 2)
  })

  /** Grossed-up reimbursements carry no tax effect, so the loss is face value. */
  it('prices a purely grossed-up set at exactly its face value', () => {
    const r = run(
      'skoda-octavia-selection',
      { receivesPrivateInsurance: true, privateInsuranceAnnualPaid: 7000, ...withFixedNet },
    )
    expect(r.forgoneCash).toBe(17800)
    expect(r.forgoneTaxDelta).toBe(0)
    expect(r.forgoneAnnual).toBe(r.forgoneCash)
  })

  it('gives every line a trace with a source', () => {
    for (const l of run('kia-niro-hybrid-lx').lines) {
      expect(l.trace.formulaHe.length).toBeGreaterThan(0)
      expect(l.trace.sourceRef.length).toBeGreaterThan(0)
    }
  })
})
