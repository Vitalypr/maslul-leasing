import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import type { Employee } from '../../src/engine/calculate'
import fleet from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * Frozen end-to-end figures, so a change to the money cannot pass unnoticed.
 *
 * scenarios.test.ts proves the assembly holds together — that the pipelines
 * stay separate and the summaries reconcile — but it checks relationships, not
 * values, so it stayed green through a rewrite of the whole electricity model.
 * That is the gap this closes. Nothing here is derived; every number was read
 * out of the engine once, after the model was checked by hand, and pinned.
 *
 * A failure here is not automatically a bug. It means a number a reader would
 * see has moved, and that whoever moved it has to say why and re-pin the table
 * deliberately rather than by accident.
 *
 * The three profiles span the cases that behave differently under the usage
 * model: a driver whose every day fits inside the battery, one whose every day
 * exhausts it, and one who works from home and sits between the two.
 */

const PROFILES = {
  /* 26,000 km on a 34 km each-way commute: 68 km commuting and 76 km on other
     days, both inside an 83 km battery, so a plug-in never starts its engine. */
  commuter: { salary: 22000, oneWay: 34, annualKm: 26000, wfh: 0, budget: 800 },
  /* 45,000 km on a 50 km each-way commute: every day runs the battery flat, so
     the electric distance is pinned at 365 charges however the days fall. */
  'long-haul': { salary: 35000, oneWay: 50, annualKm: 45000, wfh: 0, budget: 1000 },
  /* Two days at home: 126 commuting days and 239 others, and the leftover
     distance spreads thinner over more days than it would otherwise. */
  'hybrid-week': { salary: 28000, oneWay: 12, annualKm: 18000, wfh: 2, budget: 1200 },
} as const

type ProfileName = keyof typeof PROFILES

/** profile, vehicle, monthly net, annual petrol, annual electricity, annual refund. */
const GOLDEN: readonly [ProfileName, string, number, number, number, number][] = [
  ['commuter', 'byd-atto2-boost', 1419.25, 0.00, 2972.74, 5157.48],
  ['commuter', 'chery-tiggo8-phev-comfort', 2620.01, 312.44, 3878.28, 9287.56],
  ['commuter', 'skoda-octavia-selection', 2527.29, 10517.00, 0.00, 0.00],
  ['commuter', 'kia-picanto-lxplus', 1395.70, 12229.07, 0.00, 0.00],
  ['commuter', 'toyota-corolla-cross-active', 2761.11, 10517.00, 0.00, 0.00],
  ['commuter', 'skoda-kodiaq-adv', 5268.53, 12825.61, 0.00, 0.00],

  ['long-haul', 'byd-atto2-boost', 1718.11, 7435.22, 3463.81, 4564.78],
  ['long-haul', 'chery-tiggo8-phev-comfort', 3499.01, 10444.47, 4006.33, 1555.53],
  ['long-haul', 'skoda-octavia-selection', 3191.75, 18202.50, 0.00, 0.00],
  ['long-haul', 'kia-picanto-lxplus', 2149.44, 21165.70, 0.00, 0.00],
  ['long-haul', 'toyota-corolla-cross-active', 3425.57, 18202.50, 0.00, 0.00],
  ['long-haul', 'skoda-kodiaq-adv', 6073.58, 22198.17, 0.00, 0.00],

  ['hybrid-week', 'byd-atto2-boost', 1451.57, 0.00, 2058.05, 5157.48],
  ['hybrid-week', 'chery-tiggo8-phev-comfort', 2223.45, 0.00, 2744.06, 14400.00],
  ['hybrid-week', 'skoda-octavia-selection', 1981.62, 7281.00, 0.00, 7119.00],
  ['hybrid-week', 'kia-picanto-lxplus', 1285.63, 8466.28, 0.00, 0.00],
  ['hybrid-week', 'toyota-corolla-cross-active', 2215.44, 7281.00, 0.00, 7119.00],
  ['hybrid-week', 'skoda-kodiaq-adv', 4663.67, 8879.27, 0.00, 5520.73],
]

const vehicle = (id: string) =>
  (fleet.vehicles as never[]).find((v: never) => (v as { id: string }).id === id)!

function employeeFor(name: ProfileName): Employee {
  const p = PROFILES[name]
  return {
    grossMonthlySalary: p.salary, creditPoints: 2.25, serviceTier: 'C',
    commuteOneWayKm: p.oneWay, wfhDaysPerWeek: p.wfh, annualKm: p.annualKm,
    rambiEligible: false, chargesDaily: true,
    monthlyFuelBudgetIce: p.budget, monthlyFuelBudgetElectrified: p.budget,
    receivesLicenseFee: false, receivesPrivateInsurance: false,
    receivesServiceVehicleTierC: false, receivesFixedNet: false,
    receivesVariableNet: false, licenseFeeAnnualPaid: 0,
    privateInsuranceAnnualPaid: 0, serviceVehicleTierCMonthly: 0,
    fixedNetMonthly: 0, variableNetMonthly: 0,
    installsCharger: false, chargerInstallCost: 0,
  }
}

const run = (name: ProfileName, id: string) => calculate({
  vehicle: vehicle(id), employee: employeeFor(name),
  policy: policy as never, taxRules: taxRules as never, prices: prices as never,
})

const at = (r: ReturnType<typeof calculate>, id: string) =>
  r.ledger.find(l => l.id === id)?.annualAmount ?? 0

describe('the figures a reader would see', () => {
  it.each(GOLDEN)('%s · %s', (name, id, monthlyNet, petrol, electricity, refund) => {
    const r = run(name, id)
    expect(r.monthlyNet, 'monthly net').toBeCloseTo(monthlyNet, 2)
    expect(at(r, 'fuelCost'), 'annual petrol').toBeCloseTo(petrol, 2)
    expect(at(r, 'electricityCost'), 'annual electricity').toBeCloseTo(electricity, 2)
    expect(-at(r, 'unusedFuelCredit'), 'annual refund').toBeCloseTo(refund, 2)
  })

  /*
   * The year is the figure the engine computes; the month is the year divided
   * and rounded. Asserting month x 12 == year would be asserting that the
   * rounding does not exist — it can be six agorot out, and correctly so. What
   * must hold is that the month is exactly that division.
   */
  it('derives the month from the year, and the contract from the year', () => {
    for (const [name, id] of GOLDEN) {
      const r = run(name, id)
      expect(r.monthlyNet, `${name} ${id}`).toBe(Math.round(r.annualNet / 12 * 100) / 100)
      expect(r.threeYearNet, `${name} ${id}`).toBeCloseTo(r.annualNet * 3, 2)
    }
  })
})

/*
 * Two results above are counter-intuitive enough that they are asserted as
 * intent rather than left to look like arithmetic slips.
 */
describe('the surprising ones, on purpose', () => {
  it('lets a plug-in burn no petrol at all when every day fits the battery', () => {
    // 68 km commuting and 75.6 km otherwise, both under 83.
    expect(at(run('commuter', 'byd-atto2-boost'), 'fuelCost')).toBe(0)
  })

  it('refunds an entire unused budget when the supplement is large enough', () => {
    // No petrol bought, so all 14,400 goes unused; the Tiggo 8 supplement is
    // 18,063 a year, so the cap never binds and the whole allowance comes back.
    const r = run('hybrid-week', 'chery-tiggo8-phev-comfort')
    expect(-at(r, 'unusedFuelCredit')).toBeCloseTo(14400, 2)
    expect(at(r, 'upgradeSupplement')).toBeGreaterThan(14400)
  })
})
