import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CatalogGrid } from '../../src/features/catalog/CatalogGrid'
import type { FleetVehicle } from '../../src/features/catalog/CatalogGrid'
import { VehiclePage } from '../../src/features/vehicle/VehiclePage'
import { GalleryPage } from '../../src/features/gallery/GalleryPage'
import type { Profile } from '../../src/state/profile'
import fleet from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * That a car can actually be put into the comparison.
 *
 * This exists because for a long time it could not. The selection store was
 * complete and had its own tests, the comparison screen was complete and had
 * twenty-seven, and every one of them passed — but no control anywhere in the
 * app ever called toggle() to add. The comparison could only ever render its
 * empty state, and nothing failed.
 *
 * That is the shape of the gap these assertions close: not "does the component
 * work" but "is it reachable". Both are needed, and only the second would have
 * caught this.
 */

const VEHICLES = fleet.vehicles as unknown as FleetVehicle[]
const PHEV = VEHICLES.find(v => v.id === 'byd-atto2-boost')!

const profile: Profile = {
  grossMonthlySalary: 28400, creditPoints: 2.25, serviceTier: 'C',
  commuteOneWayKm: 34, wfhDaysPerWeek: 0, annualKm: 26000,
  rambiEligible: false, chargesDaily: true,
  monthlyFuelBudgetIce: 800, monthlyFuelBudgetElectrified: 1000,
  receivesLicenseFee: false, receivesPrivateInsurance: false,
  receivesServiceVehicleTierC: false, receivesFixedNet: false,
  receivesVariableNet: false, licenseFeeAnnualPaid: 0,
  privateInsuranceAnnualPaid: 0, serviceVehicleTierCMonthly: 0,
  fixedNetMonthly: 0, variableNetMonthly: 0,
  installsCharger: false, chargerInstallCost: 0,
}

const shared = {
  profile,
  policy: policyJson as never,
  taxRules: taxRules as never,
  prices: prices as never,
}

const grid = (over: Partial<Parameters<typeof CatalogGrid>[0]> = {}) =>
  renderToStaticMarkup(
    <CatalogGrid
      vehicles={VEHICLES}
      {...shared}
      onSelect={() => undefined}
      comparing={[]}
      onToggleCompare={() => undefined}
      compareFull={false}
      {...over}
    />,
  )

const vehiclePage = (over: Partial<Parameters<typeof VehiclePage>[0]> = {}) =>
  renderToStaticMarkup(
    <VehiclePage
      vehicle={PHEV}
      {...shared}
      inCompare={false}
      compareFull={false}
      onToggleCompare={() => undefined}
      {...over}
    />,
  )

describe('a car can be put into the comparison', () => {
  it('offers a control on every card in the fleet', () => {
    const html = grid()
    const pins = html.match(/class="compare-pin"/g) ?? []
    expect(pins).toHaveLength(VEHICLES.length)
  })

  it('offers one on the vehicle screen too', () => {
    expect(vehiclePage()).toContain('להשוואה')
  })

  it('shows the control as pressed for a car already chosen', () => {
    const html = grid({ comparing: [PHEV.id] })
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain(`הסרת ${PHEV.nameHe} מההשוואה`)
    expect(vehiclePage({ inCompare: true })).toContain('בהשוואה')
  })

  it('refuses, and says why, once four are chosen', () => {
    const html = grid({ comparing: ['a', 'b', 'c', 'd'], compareFull: true })
    expect(html).toContain('ההשוואה מלאה')
    expect((html.match(/disabled=""/g) ?? []).length).toBe(VEHICLES.length)
    expect(vehiclePage({ compareFull: true })).toContain('ההשוואה מלאה')
  })

  it('still lets a chosen car be removed when the comparison is full', () => {
    // Otherwise a full comparison is a dead end: nothing can be added and the
    // control that would make room is disabled too.
    const html = grid({ comparing: [PHEV.id], compareFull: true })
    expect(html).toContain(`הסרת ${PHEV.nameHe} מההשוואה`)
  })

  /*
   * There is deliberately no test for "hides the control when unwired". The
   * props are required, so an unwired screen does not compile — which is a
   * stronger guarantee than any assertion here could give, and is the actual
   * fix for how this feature went missing.
   */

  /*
   * A button inside a button is invalid, and a browser drops the inner one —
   * which would make the pin unclickable and invisible to a keyboard. The card
   * is a wrapper for exactly this reason, and this is what holds it that way.
   */
  it('never nests the control inside the card button', () => {
    const html = grid()
    const openTag = html.indexOf('<button', html.indexOf('card-wrap'))
    const pinAt = html.indexOf('compare-pin')
    const cardAt = html.indexOf('data-vehicle-id')
    expect(openTag).toBeGreaterThan(-1)
    // The pin's markup must come before the card's own button starts.
    expect(pinAt).toBeLessThan(cardAt)
  })
})

describe('the gallery sorts by price', () => {
  const gallery = () => renderToStaticMarkup(
    <GalleryPage vehicles={VEHICLES} {...shared} onSelect={() => undefined} />,
  )

  it('offers both directions', () => {
    const html = gallery()
    expect(html).toContain('מהזול ליקר')
    expect(html).toContain('מהיקר לזול')
  })

  it('opens cheapest first', () => {
    const html = gallery()
    const first = html.indexOf('מהזול ליקר')
    // aria-selected sits just before the label of the active tab.
    expect(html.slice(Math.max(0, first - 90), first)).toContain('aria-selected="true"')
  })
})

describe('the powertrain filter fits one row', () => {
  it('shrinks the chips rather than wrapping them', () => {
    // The five labels wrapped to two rows on a phone at the full control size
    // and pushed the first card below the fold.
    const html = grid()
    expect(html).toContain('filter-row')
    expect((html.match(/chip chip-sm/g) ?? []).length).toBe(5)
  })
})
