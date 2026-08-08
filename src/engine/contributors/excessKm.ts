import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'

/**
 * The charge for driving past the annual kilometre quota.
 *
 * Linear from the first kilometre over, not a banded penalty: 24,001 km against
 * a 24,000 quota costs one rate, not a whole block. Quota and rate both live in
 * policy because neither is confirmed by the client yet.
 */
export function excessKmAnnual(
  annualKm: number, quotaKm: number, ratePerKm: number
): number {
  return round2(Math.max(0, annualKm - quotaKm) * ratePerKm)
}

export function excessKmLines(ctx: CalcContext): MoneyLine[] {
  const { annualQuotaKm, excessRatePerKm } = ctx.policy.mileage
  const { annualKm } = ctx.usage
  const annualAmount = excessKmAnnual(annualKm, annualQuotaKm, excessRatePerKm)
  if (annualAmount === 0) return []

  const over = Math.max(0, annualKm - annualQuotaKm)
  return [{
    id: 'excessKm',
    labelHe: 'חריגה ממכסת הקילומטרים',
    category: 'mileage',
    annualAmount,
    // Net, per NII audit circular 16 — read from policy, never decided here.
    treatment: ctx.policy.taxTreatment.excessKm,
    trace: {
      formulaHe:
        `${fmt(annualKm)} − ${fmt(annualQuotaKm)} = ${fmt(over)} ק"מ מעבר למכסה\n` +
        `× ${fmt(excessRatePerKm)} ₪ = ${fmt(annualAmount)} ₪ לשנה`,
      inputs: { annualKm, annualQuotaKm, over, excessRatePerKm },
      sourceRef: 'policy/org.json · mileage',
    },
  }]
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 })
