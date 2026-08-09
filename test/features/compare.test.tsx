import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ComparePage, compareBars, compareRows, horizonFactor, rowFactor, MAX_COMPARED,
  type CompareEntry,
} from '../../src/features/compare/ComparePage'
import { formatIls } from '../../src/ui/Money'
import { calculate } from '../../src/engine/calculate'
import type { CalcResult, Employee, Policy, Vehicle } from '../../src/engine/calculate'
import type { MoneyLine } from '../../src/engine/types'
import catalog from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

const fleet = catalog.vehicles as readonly Vehicle[]
const policy = policyJson as Policy

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

const entry = (index: number): CompareEntry => {
  const vehicle = fleet[index]
  if (vehicle === undefined) throw new Error(`the catalogue has no row ${index}`)
  return { vehicle, result: calculate({ vehicle, employee, policy, taxRules, prices }) }
}

/** Four rows far enough apart in price to make a comparison worth drawing. */
const entries: CompareEntry[] = (() => {
  const sorted = [...fleet].sort((a, b) => a.listPrice - b.listPrice)
  const picks = [sorted[0], sorted[12], sorted[26], sorted[fleet.length - 1]]
  return picks.map(vehicle => {
    if (vehicle === undefined) throw new Error('the catalogue is smaller than expected')
    return { vehicle, result: calculate({ vehicle, employee, policy, taxRules, prices }) }
  })
})()

describe('compareBars', () => {
  it('gives every car the same pale segment — the cost the whole set incurs', () => {
    const bars = compareBars([100, 120, 150])
    expect(bars.map(b => b.sharedPct)).toEqual([66.67, 66.67, 66.67])
  })

  it('puts only the excess over the cheapest into the solid segment', () => {
    const bars = compareBars([100, 120, 150])
    expect(bars.map(b => b.deltaPct)).toEqual([0, 13.33, 33.33])
    expect(bars.map(b => b.delta)).toEqual([0, 20, 50])
  })

  it('lets the dearest car fill the axis and no car overflow it', () => {
    for (const b of compareBars([100, 120, 150])) {
      expect(b.sharedPct + b.deltaPct).toBeLessThanOrEqual(100.01)
    }
    const dearest = compareBars([100, 120, 150])[2]
    expect(dearest).toBeDefined()
    if (dearest === undefined) return
    expect(dearest.sharedPct + dearest.deltaPct).toBeCloseTo(100, 1)
  })

  it('draws one full pale bar for a single car — there is nothing to compare', () => {
    expect(compareBars([842])).toEqual([{ sharedPct: 100, deltaPct: 0, delta: 0 }])
  })

  it('draws no solid segment when every car costs the same', () => {
    expect(compareBars([500, 500]).map(b => b.deltaPct)).toEqual([0, 0])
  })

  it('returns nothing for an empty set', () => {
    expect(compareBars([])).toEqual([])
  })

  it('clamps rather than drawing a bar backwards when a car pays out', () => {
    const bars = compareBars([-200, 400])
    for (const b of bars) {
      expect(b.sharedPct).toBeGreaterThanOrEqual(0)
      expect(b.deltaPct).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('horizonFactor', () => {
  it('converts the engine\'s annual figures to the horizon on screen', () => {
    expect(horizonFactor('month')).toBeCloseTo(1 / 12, 10)
    expect(horizonFactor('year')).toBe(1)
    expect(horizonFactor('contract')).toBe(3)
  })
})

describe('rowFactor', () => {
  it('follows the horizon for a recurring component', () => {
    expect(rowFactor('contract', false)).toBe(3)
    expect(rowFactor('month', false)).toBeCloseTo(1 / 12, 10)
  })

  it('shows a one-time event once over the contract, not three times', () => {
    expect(rowFactor('contract', true)).toBe(1)
  })

  it('leaves the shorter horizons alone — the annual figure already holds it', () => {
    expect(rowFactor('year', true)).toBe(1)
    expect(rowFactor('month', true)).toBeCloseTo(1 / 12, 10)
  })
})

describe('compareRows and one-time events', () => {
  const oneTimeLine = (annualAmount: number): MoneyLine => ({
    id: 'deposit',
    labelHe: 'דמי הפקדה',
    category: 'oneTime',
    annualAmount,
    treatment: 'net',
    trace: { formulaHe: 'x', inputs: {}, sourceRef: 'policy/org.json' },
  })

  const withDeposit = (base: CalcResult, amount: number): CalcResult => ({
    ...base, lines: [...base.lines, oneTimeLine(amount)],
  })

  it('flags the one-time rows and only those', () => {
    const base = entries[0]
    expect(base).toBeDefined()
    if (base === undefined) return
    const rows = compareRows([
      withDeposit(base.result, 2000), withDeposit(base.result, 3000),
    ])
    expect(rows.find(r => r.id === 'deposit')?.oneTime).toBe(true)
    for (const r of rows.filter(r => r.id !== 'deposit')) expect(r.oneTime).toBe(false)
  })
})

describe('compareRows', () => {
  const rows = compareRows(entries.map(e => e.result))

  it('gives every row one value per car', () => {
    for (const r of rows) expect(r.values).toHaveLength(entries.length)
  })

  it('leaves the imputed usage value out of the body — it is not cash', () => {
    expect(rows.some(r => r.id === 'usageValue')).toBe(false)
  })

  it('carries the tax the imputation causes as its own row', () => {
    const tax = rows.find(r => r.id === 'taxDelta')
    expect(tax).toBeDefined()
    if (tax === undefined) return
    expect(tax.values).toEqual(entries.map(e => e.result.annualTaxDelta))
  })

  it('adds up: every column sums to that car\'s annual cost', () => {
    entries.forEach((e, i) => {
      const sum = rows.reduce((s, r) => s + (r.values[i] ?? 0), 0)
      expect(sum).toBeCloseTo(e.result.annualNet, 2)
    })
  })

  it('marks the cheapest cell in each row', () => {
    for (const r of rows) {
      if (r.cheapest === null) continue
      const best = r.values[r.cheapest]
      expect(best).toBeDefined()
      if (best === undefined) continue
      for (const v of r.values) expect(v).toBeGreaterThanOrEqual(best)
    }
  })

  it('marks nothing when a row is identical across the set', () => {
    const one = entries[0]
    expect(one).toBeDefined()
    if (one === undefined) return
    const same = compareRows([one.result, one.result])
    for (const r of same) expect(r.cheapest).toBeNull()
  })

  it('shows a component a car does not have as zero rather than dropping the row', () => {
    const cheapest = entries[0]
    const dearest = entries[entries.length - 1]
    expect(cheapest).toBeDefined()
    expect(dearest).toBeDefined()
    if (cheapest === undefined || dearest === undefined) return
    const mixed = compareRows([cheapest.result, dearest.result])
    const supplement = mixed.find(r => r.id === 'upgradeSupplement')
    expect(supplement).toBeDefined()
    if (supplement === undefined) return
    expect(supplement.values[0]).toBe(0)
    expect(supplement.values[1]).toBeGreaterThan(0)
  })
})

describe('<ComparePage>', () => {
  const html = renderToStaticMarkup(<ComparePage entries={entries} />)

  /** React escapes an apostrophe; the fleet has names that carry one. */
  const esc = (s: string) => s.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

  it('names every car it compares', () => {
    for (const e of entries) expect(html).toContain(esc(e.vehicle.nameHe))
  })

  it('draws a two-segment bar per car, never a plain zero-baseline one', () => {
    expect(html.match(/cmp-shared/g)).toHaveLength(entries.length)
    expect(html.match(/cmp-delta/g)).toHaveLength(entries.length)
  })

  it('isolates every currency figure with dir="ltr"', () => {
    const figures = html.match(/₪/g) ?? []
    const isolated = html.match(/dir="ltr"/g) ?? []
    expect(figures.length).toBeGreaterThan(0)
    expect(isolated.length).toBeGreaterThanOrEqual(figures.length)
  })

  it('opens on the monthly figure, which is what a person compares', () => {
    expect(html).toContain('aria-pressed="true"')
    const cheapest = entries[0]
    expect(cheapest).toBeDefined()
    if (cheapest === undefined) return
    expect(html).toContain(formatIls(cheapest.result.monthlyNet))
  })

  it('takes at most four cars, whatever it is handed', () => {
    const many = [...entries, entry(1), entry(2)]
    const wide = renderToStaticMarkup(<ComparePage entries={many} />)
    expect(MAX_COMPARED).toBe(4)
    expect(wide.match(/cmp-delta/g)).toHaveLength(MAX_COMPARED)
  })

  it('says what to do when nothing is selected', () => {
    const empty = renderToStaticMarkup(<ComparePage entries={[]} />)
    expect(empty).toContain('בחר')
    expect(empty).not.toContain('cmp-delta')
  })

  it('offers to drop a car only when the caller can act on it', () => {
    expect(html).not.toContain('הסר')
    const removable = renderToStaticMarkup(
      <ComparePage entries={entries} onRemove={() => undefined} />,
    )
    expect(removable.match(/הסר/g)).toHaveLength(entries.length)
  })

  it('uses no physical direction in its layout', () => {
    expect(html).not.toMatch(/\b(text-left|text-right|ml-|mr-|pl-|pr-|left-|right-)/)
  })
})
