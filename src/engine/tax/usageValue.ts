import { round2 } from '../round'

export type Powertrain = 'ice' | 'mhev' | 'hybrid' | 'phev' | 'bev'

export type UsageValueRules = {
  usageValue: {
    linearRate: number
    listPriceCeiling: number
    monthlyDeduction: Record<Powertrain, number>
  }
}

/**
 * Monthly usage value (שווי שימוש) — the taxable benefit attributed for having
 * a company car. Linear model: a flat rate of the list price, capped, less a
 * fixed monthly reduction for electrified powertrains.
 *
 * Mild hybrid carries a reduction of 0 on purpose. The client's own price list
 * marks it as not recognised as a hybrid for benefit attribution, so it is
 * taxed exactly like petrol. That is data, not a special case in code.
 *
 * The list price is the price of the vehicle actually chosen — never an
 * entitlement cap. Entitlement drives the supplement, not the tax.
 */
export function usageValueMonthly(
  listPrice: number, powertrain: Powertrain, rules: UsageValueRules
): number {
  const { linearRate, listPriceCeiling, monthlyDeduction } = rules.usageValue
  const base = Math.min(listPrice, listPriceCeiling) * linearRate
  return round2(Math.max(0, base - monthlyDeduction[powertrain]))
}
