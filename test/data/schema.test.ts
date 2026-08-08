import { describe, it, expect } from 'vitest'
import { CatalogSchema } from '../../src/data/schema/catalog'
import { PolicySchema } from '../../src/data/schema/policy'
import { TaxRulesSchema } from '../../src/data/schema/taxRules'
import catalog from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'

describe('data files', () => {
  it('catalogue matches its schema', () => {
    expect(() => CatalogSchema.parse(catalog)).not.toThrow()
  })
  it('policy matches its schema', () => {
    expect(() => PolicySchema.parse(policy)).not.toThrow()
  })
  it('tax rules match their schema', () => {
    expect(() => TaxRulesSchema.parse(taxRules)).not.toThrow()
  })
  it('every vehicle id is unique', () => {
    const ids = catalog.vehicles.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /**
   * The catalogue is the client's source of truth: supplementTierC is the
   * figure printed in their price list, not something computed here. This
   * checks the formula the engine uses still reproduces all 43 published rows.
   * A failure means the formula is wrong, never that the catalogue is.
   */
  it('the published supplement matches the formula for every row', () => {
    for (const v of catalog.vehicles) {
      const c = round2(v.supplementRate === 0.0215
        ? 0.0215 * Math.max(0, v.listPrice - 135000)
        : v.supplementRate * v.listPrice - 2902.5)
      expect(c, v.nameHe).toBeCloseTo(v.supplementTierC, 1)
    }
  })
})

/**
 * A schema that accepts the current files proves nothing on its own — one that
 * accepts everything would pass the tests above. These are the failures the
 * schemas exist to catch: each is a plausible hand-edit of a data file that
 * would otherwise reach an employee's screen as a wrong number rather than as
 * an error.
 */
describe('the schemas reject damaged data', () => {
  it('rejects a mistyped vehicle key instead of ignoring it', () => {
    const c = clone(catalog)
    delete c.vehicles[0].listPrice
    c.vehicles[0].listPrize = 109900
    expect(() => CatalogSchema.parse(c)).toThrow()
  })

  it('rejects a powertrain outside the five the tax model knows', () => {
    const c = clone(catalog)
    c.vehicles[0].powertrain = 'diesel'
    expect(() => CatalogSchema.parse(c)).toThrow()
  })

  it('rejects a price that arrived as a string', () => {
    const c = clone(catalog)
    c.vehicles[0].listPrice = '109900'
    expect(() => CatalogSchema.parse(c)).toThrow()
  })

  /**
   * The one that matters most. splitByTreatment switches on these four values;
   * a fifth spelling contributes neither cash nor taxable income and silently
   * understates the cost.
   */
  it('rejects a tax treatment that is not one of the four', () => {
    const p = clone(policy)
    p.taxTreatment.upgradeSupplement = 'Net'
    expect(() => PolicySchema.parse(p)).toThrow()
  })

  it('rejects an unverified figure that forgot to say so', () => {
    const p = clone(policy)
    delete p.mileage.verified
    expect(() => PolicySchema.parse(p)).toThrow()
  })

  /**
   * bracketTax walks the table in array order, so a table out of order returns
   * a plausible wrong number rather than failing.
   */
  it('rejects bracket ceilings that do not ascend', () => {
    const t = clone(taxRules)
    const bs = t.incomeTaxMonthlyBrackets
    ;[bs[1], bs[2]] = [bs[2], bs[1]]
    expect(() => TaxRulesSchema.parse(t)).toThrow()
  })

  it('rejects a bracket table with no open-ended top', () => {
    const t = clone(taxRules)
    const bs = t.incomeTaxMonthlyBrackets
    bs[bs.length - 1].upTo = 90000
    expect(() => TaxRulesSchema.parse(t)).toThrow()
  })
})

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * A deep copy typed loosely on purpose: these cases deliberately build shapes
 * the schema must reject, which the real types would refuse to describe.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const clone = <T>(x: T): any => JSON.parse(JSON.stringify(x))
