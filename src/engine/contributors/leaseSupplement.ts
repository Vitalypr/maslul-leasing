import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'

export type ServiceTier = 'C' | 'D'

type SupplementPolicy = {
  supplement: {
    budgetByTier: Record<ServiceTier, number>
    defaultRate: number
    highRate: number
    highRateThreshold: number | null
    rambiDiscount: number
  }
}

/**
 * The employee's monthly contribution towards a car above their tier budget.
 *
 * Reproduces the published table exactly, on all 43 rows, as
 *   rate x listPrice  −  defaultRate x tierBudget
 *
 * For the 40 cars at the default 2.15% this collapses to the familiar
 * 2.15% x (listPrice − budget). The three cars carrying the higher 2.32% rate
 * keep the *default* rate on the budget side: the subtracted base stays
 * 2.15% x 135,000 = 2,902.50 while only the price is multiplied by 2.32%.
 * Writing those as rate x (price − budget) undercharges them by ~230 a month.
 *
 * Tier C budget is 135,000 and tier D 155,000. The constant 430 gap between the
 * two columns of the source table is not a magic number and is not stored
 * anywhere: it is 2.15% of the 20,000 difference between the budgets, and falls
 * out of the arithmetic on its own.
 */
export function supplementMonthly(
  listPrice: number,
  tier: ServiceTier,
  vehicleRate: number,
  rambiEligible: boolean,
  policy: SupplementPolicy
): number {
  const { budgetByTier, defaultRate, highRate, highRateThreshold, rambiDiscount } =
    policy.supplement

  // What triggers the higher rate is unresolved. While highRateThreshold is
  // null the rate recorded per vehicle in the catalogue wins; set the threshold
  // and it becomes a price band instead. Neither rate is decided here.
  const rate = highRateThreshold !== null && listPrice > highRateThreshold
    ? highRate
    : vehicleRate

  const gross = round2(Math.max(0, rate * listPrice - defaultRate * budgetByTier[tier]))

  // The discount applies to the published amount, so the halving happens after
  // that amount is rounded, not before.
  return rambiEligible ? round2(gross * (1 - rambiDiscount)) : gross
}

export function leaseSupplement(ctx: CalcContext): MoneyLine[] {
  const { listPrice, supplementRate } = ctx.vehicle
  const { serviceTier, rambiEligible } = ctx.employee
  const { budgetByTier, defaultRate, rambiDiscount } = ctx.policy.supplement
  const budget = budgetByTier[serviceTier as ServiceTier]

  const monthly = supplementMonthly(
    listPrice, serviceTier, supplementRate, rambiEligible, ctx.policy
  )
  if (monthly === 0) return []

  return [{
    id: 'upgradeSupplement',
    labelHe: 'השתתפות בשדרוג הרכב',
    category: 'supplement',
    annualAmount: round2(monthly * 12),
    // Net, per NII audit circular 16 — read from policy, never decided here.
    treatment: ctx.policy.taxTreatment.upgradeSupplement,
    trace: {
      formulaHe:
        `${fmt(listPrice)} × ${pct(supplementRate)} − ${fmt(budget)} × ${pct(defaultRate)}` +
        ` = ${monthly.toFixed(2)} ₪ לחודש` +
        (rambiEligible ? `\nזכאות רמב"י: הנחה של ${pct(rambiDiscount)}` : ''),
      inputs: { listPrice, budget, rate: supplementRate, monthly },
      sourceRef: 'policy/org.json · supplement',
    },
  }]
}

const fmt = (n: number) => n.toLocaleString('en-US')
/** 0.0215 -> "2.15%", 0.5 -> "50%". Two decimals available, none forced. */
const pct = (r: number) => `${+(r * 100).toFixed(2)}%`
