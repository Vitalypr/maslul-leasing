import { describe, it, expect } from 'vitest'
import {
  BUNDLED_SETTINGS, SETTINGS_STORAGE_KEY,
  deepMerge, mergeSettings, readSettings, serializeSettings, isOverridden,
} from '../../src/state/policyOverride'
import { calculate } from '../../src/engine/calculate'
import type { Employee, Policy, Vehicle } from '../../src/engine/calculate'
import catalog from '../../src/data/catalog/fleet-2026.json'

const fleet = catalog.vehicles as readonly Vehicle[]

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

/** A car dear enough that the tier C supplement is not zero. */
const dearCar = (): Vehicle => {
  const v = fleet.find(x => x.listPrice > 160000)
  if (v === undefined) throw new Error('the catalogue has no car above 160,000')
  return v
}

const run = (settings = BUNDLED_SETTINGS) => calculate({
  vehicle: dearCar(),
  employee,
  policy: settings.policy as unknown as Policy,
  taxRules: settings.taxRules,
  prices: settings.prices,
})

describe('deepMerge', () => {
  it('replaces the named leaf and leaves its siblings alone', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 }
    expect(deepMerge(base, { a: { b: 9 } })).toEqual({ a: { b: 9, c: 2 }, d: 3 })
  })

  it('does not mutate the base', () => {
    const base = { a: { b: 1 } }
    deepMerge(base, { a: { b: 9 } })
    expect(base.a.b).toBe(1)
  })

  it('replaces an array wholesale rather than merging it by index', () => {
    const base = { xs: [1, 2, 3] }
    expect(deepMerge(base, { xs: [7] })).toEqual({ xs: [7] })
  })

  it('treats an absent key as "leave it", not as "set it to undefined"', () => {
    const base = { a: 1, b: 2 }
    expect(deepMerge(base, { b: 5 })).toEqual({ a: 1, b: 5 })
  })
})

describe('mergeSettings', () => {
  it('applies a partial policy patch and keeps every other field', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      policy: { mileage: { annualQuotaKm: 30000 } },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.settings.policy.mileage.annualQuotaKm).toBe(30000)
    expect(r.settings.policy.mileage.excessRatePerKm)
      .toBe(BUNDLED_SETTINGS.policy.mileage.excessRatePerKm)
    expect(r.settings.policy.supplement.budgetByTier.C)
      .toBe(BUNDLED_SETTINGS.policy.supplement.budgetByTier.C)
  })

  it('accepts a bare policy file, so org.json itself can be imported', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      ...BUNDLED_SETTINGS.policy,
      mileage: { ...BUNDLED_SETTINGS.policy.mileage, annualQuotaKm: 18000 },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.settings.policy.mileage.annualQuotaKm).toBe(18000)
  })

  it('patches the tax rules and the energy prices too', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      taxRules: { usageValue: { monthlyDeduction: { phev: 1200 } } },
      prices: { petrol95PerLiter: 8.1 },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.settings.taxRules.usageValue.monthlyDeduction.phev).toBe(1200)
    expect(r.settings.taxRules.usageValue.monthlyDeduction.bev)
      .toBe(BUNDLED_SETTINGS.taxRules.usageValue.monthlyDeduction.bev)
    expect(r.settings.prices.petrol95PerLiter).toBe(8.1)
  })

  it('refuses a tax treatment outside the four known values', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      policy: { taxTreatment: { upgradeSupplement: 'Net' } },
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorHe).toContain('upgradeSupplement')
  })

  it('refuses a quota that is not a positive number', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      policy: { mileage: { annualQuotaKm: -1 } },
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorHe).toContain('annualQuotaKm')
  })

  it('refuses a patch that is not an object', () => {
    expect(mergeSettings(BUNDLED_SETTINGS, [1, 2]).ok).toBe(false)
    expect(mergeSettings(BUNDLED_SETTINGS, 'x').ok).toBe(false)
    expect(mergeSettings(BUNDLED_SETTINGS, null).ok).toBe(false)
  })

  it('reports the error in Hebrew, naming the field that failed', () => {
    const r = mergeSettings(BUNDLED_SETTINGS, {
      policy: { phev: { realWorldRangeFactor: 4 } },
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorHe).toMatch(/[֐-׿]/)
    expect(r.errorHe).toContain('realWorldRangeFactor')
  })
})

describe('readSettings', () => {
  it('falls back to the bundled files when nothing is stored', () => {
    expect(readSettings(null)).toEqual(BUNDLED_SETTINGS)
    expect(readSettings('')).toEqual(BUNDLED_SETTINGS)
  })

  it('falls back when the store holds junk', () => {
    expect(readSettings('not json')).toEqual(BUNDLED_SETTINGS)
    expect(readSettings('[1,2,3]')).toEqual(BUNDLED_SETTINGS)
  })

  it('falls back whole rather than applying half a broken override', () => {
    const stored = JSON.stringify({
      policy: { mileage: { annualQuotaKm: 30000 }, taxTreatment: { usageValue: 'nope' } },
    })
    expect(readSettings(stored)).toEqual(BUNDLED_SETTINGS)
  })

  it('applies a stored override', () => {
    const stored = JSON.stringify({ policy: { contract: { termMonths: 48 } } })
    expect(readSettings(stored).policy.contract.termMonths).toBe(48)
  })

  it('survives a stored override written before a field existed', () => {
    // An older export carries no `prices` block at all.
    const stored = JSON.stringify({ policy: { contract: { termMonths: 48 } } })
    expect(readSettings(stored).prices).toEqual(BUNDLED_SETTINGS.prices)
  })

  it('round-trips what serializeSettings produced', () => {
    const edited = mergeSettings(BUNDLED_SETTINGS, {
      policy: { supplement: { budgetByTier: { C: 140000 } } },
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    const back = readSettings(serializeSettings(edited.settings))
    expect(back).toEqual(edited.settings)
  })
})

describe('serializeSettings', () => {
  it('writes indented JSON, so a diff of two policy versions is readable', () => {
    expect(serializeSettings(BUNDLED_SETTINGS)).toContain('\n  "policy"')
  })
})

describe('isOverridden', () => {
  it('is false for the bundled files and true once anything changes', () => {
    expect(isOverridden(BUNDLED_SETTINGS)).toBe(false)
    const r = mergeSettings(BUNDLED_SETTINGS, { prices: { petrol95PerLiter: 9 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(isOverridden(r.settings)).toBe(true)
  })
})

describe('the storage key', () => {
  it('is versioned, so a shape change cannot resurrect an old blob', () => {
    expect(SETTINGS_STORAGE_KEY).toMatch(/\.v\d+$/)
  })
})

/**
 * The point of the whole tax-treatment design: the switch in the admin screen
 * edits data, and the engine reads that data. If this passes with the treatment
 * hardcoded somewhere, the switch is decoration.
 */
describe('the engine reads the treatment the admin sets', () => {
  it('changes the annual cost when the supplement moves from net to gross', () => {
    const asNet = run()
    const flipped = mergeSettings(BUNDLED_SETTINGS, {
      policy: { taxTreatment: { upgradeSupplement: 'gross' } },
    })
    expect(flipped.ok).toBe(true)
    if (!flipped.ok) return

    const asGross = run(flipped.settings)
    expect(asNet.lines.find(l => l.id === 'upgradeSupplement')?.treatment).toBe('net')
    expect(asGross.lines.find(l => l.id === 'upgradeSupplement')?.treatment).toBe('gross')
    // Pre-tax, the same deduction costs less: it lowers taxable income too.
    expect(asGross.annualNet).toBeLessThan(asNet.annualNet)
  })

  it('changes the cost when a usage-value deduction is edited', () => {
    const before = run()
    const edited = mergeSettings(BUNDLED_SETTINGS, {
      taxRules: { usageValue: { linearRate: 0.03 } },
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(run(edited.settings).annualNet).toBeGreaterThan(before.annualNet)
  })
})
