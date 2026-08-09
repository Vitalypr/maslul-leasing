import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CatalogGrid, type FleetVehicle } from '../../src/features/catalog/CatalogGrid'
import { calculate } from '../../src/engine/calculate'
import { formatIls } from '../../src/ui/Money'
import { DEFAULT_PROFILE } from '../../src/state/profile'
import type { PolicyData } from '../../src/data/schema/policy'
import catalogJson from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/*
 * A JSON import widens every literal, so `powertrain` and each tax treatment
 * arrive typed as `string`. test/data/schema.test.ts is what proves the files
 * really hold these shapes; without it these casts would be unbacked.
 */
const catalog = { vehicles: catalogJson.vehicles as readonly FleetVehicle[] }
const policy = policyJson as PolicyData

const profile = { ...DEFAULT_PROFILE, monthlyFuelBudgetIce: 1200, monthlyFuelBudgetElectrified: 700 }

const html = renderToStaticMarkup(
  <CatalogGrid
    vehicles={catalog.vehicles}
    profile={profile}
    policy={policy}
    taxRules={taxRules}
    prices={prices}
    onSelect={() => {}}
    comparing={[]}
    onToggleCompare={() => {}}
    compareFull={false}
  />,
)

const vehicle = (id: string) => catalog.vehicles.find(v => v.id === id)!

const monthlyOf = (id: string) => calculate({
  vehicle: vehicle(id), employee: profile, policy, taxRules, prices,
}).monthlyNet

describe('<CatalogGrid>', () => {
  it('draws one card per vehicle in the fleet', () => {
    expect(html.match(/data-vehicle-id="/g)).toHaveLength(catalog.vehicles.length)
  })

  it('prices every card for this employee, not at the list price', () => {
    // The Fabia sits inside the tier C budget, so its list price is nowhere in
    // its cost — and must not be the number the card leads with.
    expect(html).toContain(formatIls(monthlyOf('skoda-fabia-selection')))
    expect(html).not.toContain(formatIls(vehicle('skoda-fabia-selection').listPrice))
    expect(html).not.toContain(formatIls(vehicle('skoda-kodiaq-adv').listPrice))
  })

  it('states the year and the contract alongside the month', () => {
    const r = calculate({
      vehicle: vehicle('skoda-octavia-selection'), employee: profile,
      policy, taxRules, prices,
    })
    expect(html).toContain(formatIls(r.monthlyNet))
    expect(html).toContain(formatIls(r.annualNet))
    expect(html).toContain(formatIls(r.threeYearNet))
  })

  it('isolates every figure in dir="ltr" so the minus keeps its side', () => {
    /*
     * Three figures per card — month, year, contract — but only for cars that
     * can be costed. A car missing a required input shows the gap instead of a
     * price, so it contributes none. Counting against the priceable rows keeps
     * this an assertion about isolation rather than about the fleet size.
     */
    const priceable = catalog.vehicles.filter(
      v => (v.consumption as { fuel?: string } | undefined)?.fuel !== 'diesel',
    ).length
    const figures = html.match(/class="money num/g) ?? []
    expect(figures.length).toBe(priceable * 3)
    expect(html.match(/dir="ltr"/g)?.length).toBeGreaterThanOrEqual(figures.length)
  })

  it('offers a filter only for a powertrain the fleet actually has', () => {
    expect(html).toContain('data-powertrain="phev"')
    expect(html).toContain('data-powertrain="hybrid"')
    expect(html).toContain('data-powertrain="mhev"')
    expect(html).toContain('data-powertrain="ice"')
    expect(html).not.toContain('data-powertrain="bev"')
  })

  it('marks a cost that rests on an estimated consumption figure', () => {
    /*
     * Every consumption figure now comes from an Israeli importer disclosure
     * table, so no card carries the mark today. The mark still has to work —
     * a future row added without a real figure must say so — which is what
     * this asserts, rather than a count that only held while the data was
     * provisional.
     */
    const estimated = catalog.vehicles.filter(
      v => (v.consumption as { source?: string } | undefined)?.source === 'estimate',
    )
    expect(html.match(/צריכה משוערת/g) ?? []).toHaveLength(estimated.length)
  })

  it('names each car and keeps a Latin trim from being reordered', () => {
    expect(html).toContain('סקודה אוקטביה')
    // Two rows share the name "JAECOO 5 hev"; the trim is what tells them apart.
    expect(html).toContain('>LX+<')
    expect(html).toContain('>premium<')
    expect(html).toContain('>luxury<')
  })
})
