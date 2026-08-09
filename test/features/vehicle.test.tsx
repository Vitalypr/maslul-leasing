import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VehiclePage } from '../../src/features/vehicle/VehiclePage'
import type { FleetVehicle } from '../../src/features/catalog/CatalogGrid'
import { calculate } from '../../src/engine/calculate'
import { splitAnnualKm } from '../../src/engine/usage'
import { formatIls } from '../../src/ui/Money'
import { DEFAULT_PROFILE, type Profile } from '../../src/state/profile'
import type { PolicyData } from '../../src/data/schema/policy'
import catalogJson from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/* A JSON import widens every literal; test/data/schema.test.ts is what proves
   the files really hold these shapes. See test/golden/scenarios.test.ts. */
const catalog = { vehicles: catalogJson.vehicles as readonly FleetVehicle[] }
const policy = policyJson as PolicyData

const base: Profile = {
  ...DEFAULT_PROFILE,
  monthlyFuelBudgetIce: 1200,
  monthlyFuelBudgetElectrified: 700,
}

const vehicle = (id: string) => catalog.vehicles.find(v => v.id === id)!

const render = (id: string, over: Partial<Profile> = {}) =>
  renderToStaticMarkup(
    <VehiclePage
      vehicle={vehicle(id)}
      profile={{ ...base, ...over }}
      policy={policy}
      taxRules={taxRules}
      prices={prices}
    />,
  )

const result = (id: string, over: Partial<Profile> = {}) => calculate({
  vehicle: vehicle(id), employee: { ...base, ...over }, policy, taxRules, prices,
})

const OCTAVIA = 'skoda-octavia-selection'
const PHEV = 'chery-tiggo7-phev-comfort'

describe('<VehiclePage> — the ledger', () => {
  it('offers month, year and contract, opening on the month', () => {
    const html = render(OCTAVIA)
    expect(html.match(/role="tab"/g)).toHaveLength(3)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toContain('data-horizon="month"')
    expect(html).toContain('data-horizon="year"')
    expect(html).toContain('data-horizon="contract"')
    expect(html).toContain('aria-selected="true" data-horizon="month"')
  })

  it('leads with the monthly net cost the engine produced', () => {
    expect(render(OCTAVIA)).toContain(formatIls(result(OCTAVIA).monthlyNet))
  })

  it('lists every engine line by its own label', () => {
    const html = render(OCTAVIA)
    const r = result(OCTAVIA)
    expect(r.lines.length).toBeGreaterThan(2)
    for (const l of r.lines) expect(html, l.id).toContain(l.labelHe)
  })

  it('keeps every trace folded away until its line is opened', () => {
    const html = render(OCTAVIA)
    const r = result(OCTAVIA)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(r.lines.length)
    expect(html).not.toContain(r.lines[0]!.trace.sourceRef)
  })

  it('wraps every currency figure so the minus cannot cross the number', () => {
    const html = render(OCTAVIA)
    expect(html.match(/class="money num/g)?.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/₪[\d,]+−/)
  })
})

describe('<VehiclePage> — the plug-in electricity share', () => {
  it('reports the share as a result of the split, not as a hidden assumption', () => {
    const html = render(PHEV)
    const split = splitAnnualKm({
      annualKm: base.annualKm,
      commuteOneWayKm: base.commuteOneWayKm,
      commuteDaysPerYear: policyJson.usage.commuteDaysPerYear,
      wfhDaysPerWeek: base.wfhDaysPerWeek,
      daysPerYear: policyJson.usage.daysPerYear,
      powertrain: 'phev',
      chargesDaily: base.chargesDaily,
      manufacturerEvRangeKm:
        (vehicle(PHEV).consumption as { evRangeKm?: number }).evRangeKm ?? null,
      realEvRangeKm:
        (vehicle(PHEV) as { realEvRangeKm?: number | null }).realEvRangeKm ?? null,
      realWorldRangeFactor: policy.phev.realWorldRangeFactor,
    })
    const share = Math.round((split.evKm / split.annualKm) * 100)
    expect(html).toContain(`${share}%`)
    // The inputs it came from, on screen next to it.
    expect(html).toContain(String(split.effectiveEvRangeKm))
    expect(html).toContain(String(split.dailyCommuteKm))
  })

  it('drops to nothing on electricity when the driver will not charge', () => {
    expect(render(PHEV, { chargesDaily: false })).toContain('0%')
  })

  it('shows no such block for a car that cannot be plugged in', () => {
    expect(render(OCTAVIA)).not.toContain('על חשמל')
  })
})

describe('<VehiclePage> — what the employee gives up', () => {
  const receiving = {
    receivesPrivateInsurance: true,
    privateInsuranceAnnualPaid: 4200,
    receivesServiceVehicleTierC: true,
    serviceVehicleTierCMonthly: 570,
  }

  it('says nothing when there is nothing to give up', () => {
    expect(render(OCTAVIA)).not.toContain('מה תפסיד')
  })

  it('reports it in a section of its own', () => {
    const html = render(OCTAVIA, receiving)
    expect(html).toContain('מה תפסיד')
    for (const l of result(OCTAVIA, receiving).forgone) {
      // React escapes the apostrophe in "רכב שירות ג'" to &#x27;, so compare
      // against the escaped form rather than the raw label.
      expect(html, l.id).toContain(l.labelHe.replace(/'/g, '&#x27;'))
    }
  })

  it('never lets it move the lease cost', () => {
    const alone = result(OCTAVIA)
    const withForgone = result(OCTAVIA, receiving)
    expect(withForgone.monthlyNet).toBe(alone.monthlyNet)
    expect(render(OCTAVIA, receiving)).toContain(formatIls(alone.monthlyNet))
  })

  it('closes the block on the after-tax figure, not on the sum of its lines', () => {
    // רכב שירות ג' is a gross component: giving it up lowers taxable income too,
    // so the real loss is below face value. forgoneAnnual carries that; the sum
    // of the lines does not, which is why the total is passed in separately.
    const grossy = {
      ...policy,
      forgone: {
        ...policy.forgone,
        serviceVehicleTierC: { ...policy.forgone.serviceVehicleTierC, monthly: 1200 },
      },
    }
    const employee = { ...base, ...receiving }
    const r = calculate({
      vehicle: vehicle(OCTAVIA), employee, policy: grossy, taxRules, prices,
    })
    expect(r.forgoneAnnual).toBeLessThan(r.forgoneCash)

    const html = renderToStaticMarkup(
      <VehiclePage vehicle={vehicle(OCTAVIA)} profile={employee}
                   policy={grossy} taxRules={taxRules} prices={prices} />,
    )
    // The block follows the same horizon as the lease ledger, which opens on
    // the month, so the figure on screen is the annual one over twelve.
    expect(html).toContain(formatIls(r.forgoneAnnual / 12))
  })
})

describe('<VehiclePage> — unverified sources', () => {
  it('marks the mileage quota only while policy says it is unverified', () => {
    /*
     * The quota and the excess rate are confirmed now (35,000 km at 0.12), so
     * the honest behaviour is no mark. Asserting the rule in both directions
     * keeps the mark meaningful — a mark that never disappears says nothing.
     */
    const marks = render(OCTAVIA).match(/לא אומת/g)?.length ?? 0
    if (policy.mileage.verified) expect(marks).toBe(0)
    else expect(marks).toBeGreaterThanOrEqual(1)
  })

  it('stops marking the electric range once a measured one replaces the factor', () => {
    /*
     * The mark exists to warn that a range was derived from the unverified
     * 70% factor. Every plug-in now carries realEvRangeKm measured in road
     * tests, so the derivation — and the warning with it — no longer applies.
     * The rule is asserted in both directions so the mark keeps its meaning.
     */
    const marks = (id: string) => render(id).match(/לא אומת/g)?.length ?? 0
    const measured =
      (vehicle(PHEV) as { realEvRangeKm?: number | null }).realEvRangeKm != null
    if (measured) expect(marks(PHEV)).toBe(marks(OCTAVIA))
    else expect(marks(PHEV)).toBeGreaterThan(marks(OCTAVIA))
  })

  it('marks the consumption figure only while it is an estimate', () => {
    const src = (vehicle(OCTAVIA).consumption as { source?: string } | undefined)?.source
    if (src === 'estimate') expect(render(OCTAVIA)).toContain('משוערת')
    else expect(render(OCTAVIA)).not.toContain('משוערת')
  })
})
