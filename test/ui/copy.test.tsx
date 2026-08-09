import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error node:fs is untyped in this project: no @types/node is installed
import { readdirSync, readFileSync } from 'node:fs'
import { VehiclePage } from '../../src/features/vehicle/VehiclePage'
import { ComparePage, type CompareEntry } from '../../src/features/compare/ComparePage'
import { POLICY_FILE_ACTIONS } from '../../src/features/admin/AdminPanel'
import { mergeSettings, BUNDLED_SETTINGS } from '../../src/state/policyOverride'
import {
  POWERTRAIN_LABEL_HE, type FleetVehicle,
} from '../../src/features/catalog/CatalogGrid'
import { formatIls } from '../../src/ui/Money'
import { calculate } from '../../src/engine/calculate'
import type { PolicyData } from '../../src/data/schema/policy'
import { DEFAULT_PROFILE } from '../../src/state/profile'
import catalogJson from '../../src/data/catalog/fleet-2026.json'
import policyJson from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

/**
 * The rules of Task 17, as assertions.
 *
 * A label labels, an example demonstrates, and nothing does double duty. The
 * checks below are mostly counts: a phrase the screen already carries somewhere
 * else must appear once, not twice.
 */

const catalog = catalogJson.vehicles as readonly FleetVehicle[]
const policy = policyJson as PolicyData
const profile = {
  ...DEFAULT_PROFILE, monthlyFuelBudgetIce: 1200, monthlyFuelBudgetElectrified: 700,
}

const vehicle = (id: string) => catalog.find(v => v.id === id)!
const OCTAVIA = 'skoda-octavia-selection'

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0

const vehicleHtml = renderToStaticMarkup(
  <VehiclePage vehicle={vehicle(OCTAVIA)} profile={profile} policy={policy}
               taxRules={taxRules} prices={prices}
      inCompare={false}
      compareFull={false}
      onToggleCompare={() => undefined}
    />,
)

const entries: CompareEntry[] = [...catalog]
  .sort((a, b) => a.listPrice - b.listPrice)
  .filter((_, i) => i === 0 || i === 20 || i === 40)
  .map(v => ({
    vehicle: v,
    result: calculate({ vehicle: v, employee: profile, policy, taxRules, prices }),
  }))

const compareHtml = renderToStaticMarkup(<ComparePage entries={entries} />)

/** Every source file the interface is built from. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${String(entry.name)}`
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}

describe('no emoji', () => {
  it('keeps pictographs out of every source file', () => {
    for (const path of sources('src')) {
      const text: string = readFileSync(path, 'utf8')
      expect(text.match(/\p{Extended_Pictographic}/gu) ?? [], path).toEqual([])
    }
  })
})

describe('nothing states twice what the screen states once', () => {
  it('names the horizon of the headline figure only where it is chosen', () => {
    // The selected tab says חודש and the closing row says סה"כ לחודש. A caption
    // under the figure repeating it is the third telling of one fact.
    expect(count(vehicleHtml, /לחודש/g)).toBe(1)
  })

  it('still says what the headline figure is', () => {
    expect(vehicleHtml).toContain('נטו לכיס')
  })

  it('prints the list price once, not in the heading and again in the specs', () => {
    expect(count(vehicleHtml, new RegExp(formatIls(vehicle(OCTAVIA).listPrice), 'g'))).toBe(1)
  })

  it('keeps the powertrain in the heading, where the car is identified', () => {
    expect(vehicleHtml).toContain(POWERTRAIN_LABEL_HE[vehicle(OCTAVIA).powertrain])
  })

  it('explains the solid bar segment in the legend and nowhere else', () => {
    expect(count(compareHtml, /מעל הזול ביותר/g)).toBe(1)
  })

  it('tells an empty comparison what to do without describing itself', () => {
    const empty = renderToStaticMarkup(<ComparePage entries={[]} />)
    expect(empty).toContain('בחר')
    expect(empty).not.toContain('להשוות')
  })
})

describe('an action and its confirmation use the same word', () => {
  it('answers every button with the verb the button used', () => {
    for (const action of Object.values(POLICY_FILE_ACTIONS)) {
      const verb = action.labelHe.split(' ')[0] ?? ''
      expect(verb.length, action.labelHe).toBeGreaterThan(2)
      expect(action.doneHe, action.labelHe).toContain(verb)
    }
  })
})

describe('error states', () => {
  it('never apologise', () => {
    for (const path of sources('src')) {
      const text: string = readFileSync(path, 'utf8')
      expect(text, path).not.toMatch(/מצטער|סליחה|אופס|משהו השתבש/)
    }
  })

  it('say what to do about a file that is not a policy', () => {
    const refused = mergeSettings(BUNDLED_SETTINGS, 42)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.errorHe).toContain('org.json')
  })

  it('name the field a bad value sits in', () => {
    const refused = mergeSettings(BUNDLED_SETTINGS, {
      policy: { mileage: { annualQuotaKm: -1 } },
    })
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.errorHe).toContain('annualQuotaKm')
  })
})
