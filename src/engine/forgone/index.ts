import { round2 } from '../round'
import type { MoneyLine, TaxTreatment } from '../types'

/**
 * What the employee gives up by taking a lease car. Money that stops arriving
 * is a cost in the same sense as the lease itself — but it is reported on its
 * own and never folded into the lease cost. Merging the two would blur the
 * question "how much does this car cost".
 *
 * The private-car components are NOT one figure. A real payslip carries five,
 * and they do not share a tax treatment:
 *
 *   החזר אגרת רישוי   – grossedUp. Loss is face value.
 *   השתתפות בביטוח    – grossedUp, capped by policy. Loss is face value.
 *   רכב שירות ג'      – a gross salary component. Giving it up also lowers
 *                       taxable income, so the real loss is
 *                       amount x (1 - marginal rate), not the face value.
 *   קבועות נטו        – a net component the state grosses up. Face value.
 *   משת.רגי.נטו       – same.
 *
 * Rolling all five into one 'grossedUp' figure overstates the loss on רכב
 * שירות ג'. The 'gross' treatment in splitByTreatment handles it correctly: it
 * adds to cash and subtracts from taxableDelta, and calculate() then prices
 * that delta on top of the lease's own tax effect.
 *
 * Every treatment below is read from policy.taxTreatment and none is
 * hardcoded, so a correction is a JSON edit.
 */

/** A benefit stated per year, plus the switch that turns it off. */
export type ForgoneAnnualItem = { annual: number; enabled: boolean }

/** A benefit stated per month, plus the switch that turns it off. */
export type ForgoneMonthlyItem = { monthly: number; enabled: boolean }

export type ForgoneItem = ForgoneAnnualItem | ForgoneMonthlyItem

/**
 * The slice of the calculation context this pipeline reads. Declared
 * structurally rather than imported from `calculate`, so the forgone pipeline
 * carries no dependency on the assembly layer. `CalcContext` satisfies it.
 */
export type ForgoneContext = {
  policy: {
    forgone: {
      licenseFeeAnnual: ForgoneAnnualItem
      privateInsuranceAnnual: ForgoneAnnualItem
      serviceVehicleTierC: ForgoneMonthlyItem
      fixedNetAllowance: ForgoneMonthlyItem
      variableNetAllowance: ForgoneMonthlyItem
    }
    taxTreatment: {
      forgoneLicenseFee: TaxTreatment
      forgoneInsurance: TaxTreatment
      forgoneServiceVehicleTierC: TaxTreatment
      forgoneFixedNet: TaxTreatment
      forgoneVariableNet: TaxTreatment
    }
  }
  employee: {
    receivesLicenseFee: boolean
    receivesPrivateInsurance: boolean
    receivesServiceVehicleTierC: boolean
    receivesFixedNet: boolean
    receivesVariableNet: boolean
  }
}

type Spec = {
  id: string
  key: keyof ForgoneContext['policy']['forgone']
  receives: keyof ForgoneContext['employee']
  treatmentKey: keyof ForgoneContext['policy']['taxTreatment']
  labelHe: string
}

/**
 * The forgone side of the model, in display order. Adding a sixth component
 * is one row here — no new file, no new branch.
 */
const SPECS: Spec[] = [
  {
    id: 'forgoneLicenseFee', key: 'licenseFeeAnnual',
    receives: 'receivesLicenseFee', treatmentKey: 'forgoneLicenseFee',
    labelHe: 'החזר אגרת רישוי',
  },
  {
    id: 'forgoneInsurance', key: 'privateInsuranceAnnual',
    receives: 'receivesPrivateInsurance', treatmentKey: 'forgoneInsurance',
    labelHe: 'השתתפות בביטוח רכב פרטי',
  },
  {
    id: 'forgoneServiceVehicleTierC', key: 'serviceVehicleTierC',
    receives: 'receivesServiceVehicleTierC',
    treatmentKey: 'forgoneServiceVehicleTierC',
    labelHe: "רכב שירות ג'",
  },
  {
    id: 'forgoneFixedNet', key: 'fixedNetAllowance',
    receives: 'receivesFixedNet', treatmentKey: 'forgoneFixedNet',
    labelHe: 'קבועות נטו',
  },
  {
    id: 'forgoneVariableNet', key: 'variableNetAllowance',
    receives: 'receivesVariableNet', treatmentKey: 'forgoneVariableNet',
    labelHe: 'משת.רגי.נטו',
  },
]

/** An entry states its amount per year or per month, never both. */
function statedAmount(
  item: ForgoneItem
): { period: 'annual' | 'monthly'; amount: number } {
  return 'monthly' in item
    ? { period: 'monthly', amount: item.monthly }
    : { period: 'annual', amount: item.annual }
}

export function forgoneLines(ctx: ForgoneContext): MoneyLine[] {
  return SPECS.flatMap((s): MoneyLine[] => {
    const item = ctx.policy.forgone[s.key]
    if (!item.enabled || !ctx.employee[s.receives]) return []

    const stated = statedAmount(item)
    const isMonthly = stated.period === 'monthly'
    const annualAmount = round2(isMonthly ? stated.amount * 12 : stated.amount)
    if (annualAmount === 0) return []

    return [{
      id: s.id,
      labelHe: s.labelHe,
      category: 'forgone',
      annualAmount,
      treatment: ctx.policy.taxTreatment[s.treatmentKey],
      trace: {
        formulaHe: isMonthly
          ? `${stated.amount} ₪ × 12 = ${annualAmount} ₪ שיפסיקו להתקבל`
          : `${annualAmount} ₪ בשנה שיפסיקו להתקבל`,
        inputs: isMonthly
          ? { monthly: stated.amount }
          : { annual: stated.amount },
        sourceRef: `policy/org.json · forgone.${s.key}`,
      },
    }]
  })
}
