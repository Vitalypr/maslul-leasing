import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'
import { usageValueMonthly } from '../tax/usageValue'

/**
 * שווי שימוש — the benefit attributed to the employee for having the car.
 *
 * No cash changes hands here. The amount is added to taxable income and the
 * employee pays tax on it, which is why the line is a 'taxableBenefit' and not
 * a cost: turning it into cash would charge the employee the full figure
 * instead of the tax on it. calculate() prices the taxable change once, across
 * every line, so bracket crossings land in the right place.
 *
 * The treatment is read from policy.taxTreatment.usageValue and is not decided
 * here. The value is computed on the vehicle actually chosen — the tier budget
 * governs the supplement, never the attribution.
 */
export function usageValueTax(ctx: CalcContext): MoneyLine[] {
  const { listPrice, powertrain } = ctx.vehicle
  const monthly = usageValueMonthly(listPrice, powertrain, ctx.taxRules)
  if (monthly === 0) return []

  const { linearRate, listPriceCeiling, monthlyDeduction } = ctx.taxRules.usageValue
  const capped = Math.min(listPrice, listPriceCeiling)
  const deduction = monthlyDeduction[powertrain]

  return [{
    id: 'usageValue',
    labelHe: 'שווי שימוש',
    category: 'tax',
    annualAmount: round2(monthly * 12),
    treatment: ctx.policy.taxTreatment.usageValue,
    trace: {
      formulaHe:
        `${fmt(capped)} × ${pct(linearRate)}` +
        (deduction > 0 ? ` − ${fmt(deduction)} ₪ הפחתה` : '') +
        ` = ${monthly.toFixed(2)} ₪ לחודש` +
        (listPrice > listPriceCeiling
          ? `\nמחיר המחירון נחתך לתקרה ${fmt(listPriceCeiling)} ₪`
          : ''),
      inputs: { listPrice, capped, linearRate, deduction, monthly },
      sourceRef: 'tax-rules/2026.json · usageValue',
    },
  }]
}

const fmt = (n: number) => n.toLocaleString('en-US')
/** 0.0248 -> "2.48%". Two decimals available, none forced. */
const pct = (r: number) => `${+(r * 100).toFixed(2)}%`
