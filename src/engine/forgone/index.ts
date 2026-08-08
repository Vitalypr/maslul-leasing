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
 *   החזר אגרת רישוי   – grossedUp, capped at 1,941 a year. Loss is face value.
 *   השתתפות בביטוח    – grossedUp, capped at 7,000 a year. Loss is face value.
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
 * THE AMOUNTS COME FROM THE EMPLOYEE, not from policy. Two of them differ per
 * person by definition — the licence fee follows the car actually owned and
 * the insurance follows the quote actually paid — and the payslip components
 * vary by grade. Policy holds only the ceiling and a suggested figure to show
 * beside the field. Every treatment is still read from policy.taxTreatment and
 * none is hardcoded, so a correction there is a JSON edit.
 */

/**
 * A forgone benefit as policy describes it: whether it applies at all, the
 * statutory ceiling if there is one, and a figure to suggest in the form.
 */
export type ForgonePolicyItem = {
  enabled: boolean
  employeeEnters: boolean
  /** Ceiling on the yearly figure. null when the component has no ceiling. */
  annualCap?: number | null | undefined
  /** Ceiling on the monthly figure. null when the component has no ceiling. */
  monthlyCap?: number | null | undefined
  /** Shown as a hint in the form. Never used as a value. */
  suggested?: number | null | undefined
  labelHe: string
  helpHe?: string | undefined
}

/** Kept for the schema; a policy item no longer carries a bare amount. */
export type ForgoneAnnualItem = ForgonePolicyItem
export type ForgoneMonthlyItem = ForgonePolicyItem

/**
 * The slice of the calculation context this pipeline reads. Declared
 * structurally rather than imported from `calculate`, so the forgone pipeline
 * carries no dependency on the assembly layer. `CalcContext` satisfies it.
 */
export type ForgoneContext = {
  policy: {
    forgone: {
      licenseFeeAnnual: ForgonePolicyItem
      privateInsuranceAnnual: ForgonePolicyItem
      serviceVehicleTierC: ForgonePolicyItem
      fixedNetAllowance: ForgonePolicyItem
      variableNetAllowance: ForgonePolicyItem
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
    /** What the employee actually pays in licence fee per year, before the cap. */
    licenseFeeAnnualPaid: number
    /** What the employee actually pays to insure the car per year, before the cap. */
    privateInsuranceAnnualPaid: number
    serviceVehicleTierCMonthly: number
    fixedNetMonthly: number
    variableNetMonthly: number
  }
}

type Spec = {
  id: string
  key: keyof ForgoneContext['policy']['forgone']
  receives: keyof ForgoneContext['employee']
  amount: keyof ForgoneContext['employee']
  treatmentKey: keyof ForgoneContext['policy']['taxTreatment']
  period: 'annual' | 'monthly'
  labelHe: string
}

/**
 * The forgone side of the model, in display order. Adding a sixth component
 * is one row here — no new file, no new branch.
 */
const SPECS: Spec[] = [
  {
    id: 'forgoneLicenseFee', key: 'licenseFeeAnnual',
    receives: 'receivesLicenseFee', amount: 'licenseFeeAnnualPaid',
    treatmentKey: 'forgoneLicenseFee', period: 'annual',
    labelHe: 'החזר אגרת רישוי',
  },
  {
    id: 'forgoneInsurance', key: 'privateInsuranceAnnual',
    receives: 'receivesPrivateInsurance', amount: 'privateInsuranceAnnualPaid',
    treatmentKey: 'forgoneInsurance', period: 'annual',
    labelHe: 'החזר ביטוח רכב פרטי',
  },
  {
    id: 'forgoneServiceVehicleTierC', key: 'serviceVehicleTierC',
    receives: 'receivesServiceVehicleTierC', amount: 'serviceVehicleTierCMonthly',
    treatmentKey: 'forgoneServiceVehicleTierC', period: 'monthly',
    labelHe: "רכב שירות ג'",
  },
  {
    id: 'forgoneFixedNet', key: 'fixedNetAllowance',
    receives: 'receivesFixedNet', amount: 'fixedNetMonthly',
    treatmentKey: 'forgoneFixedNet', period: 'monthly',
    labelHe: 'קבועות נטו',
  },
  {
    id: 'forgoneVariableNet', key: 'variableNetAllowance',
    receives: 'receivesVariableNet', amount: 'variableNetMonthly',
    treatmentKey: 'forgoneVariableNet', period: 'monthly',
    labelHe: 'משת.רגי.נטו',
  },
]

/**
 * The reimbursement is the lower of what was paid and the ceiling — that is
 * how both capped components are written in the regulations, and it is why the
 * employee supplies the figure rather than policy asserting one.
 */
export function applyCap(paid: number, cap: number | null | undefined): number {
  const safe = Math.max(0, paid)
  return cap === null || cap === undefined ? safe : Math.min(safe, cap)
}

export function forgoneLines(ctx: ForgoneContext): MoneyLine[] {
  return SPECS.flatMap((s): MoneyLine[] => {
    const item = ctx.policy.forgone[s.key]
    if (!item.enabled || ctx.employee[s.receives] !== true) return []

    const monthly = s.period === 'monthly'
    const paid = Number(ctx.employee[s.amount]) || 0
    const cap = monthly ? item.monthlyCap : item.annualCap
    const capped = applyCap(paid, cap)
    const annualAmount = round2(monthly ? capped * 12 : capped)
    if (annualAmount === 0) return []

    const cappedOut = cap !== null && cap !== undefined && paid > cap

    return [{
      id: s.id,
      labelHe: s.labelHe,
      category: 'forgone',
      annualAmount,
      treatment: ctx.policy.taxTreatment[s.treatmentKey],
      trace: {
        formulaHe: [
          monthly
            ? `${capped} ₪ × 12 = ${annualAmount} ₪ שיפסיקו להתקבל`
            : `${annualAmount} ₪ בשנה שיפסיקו להתקבל`,
          cappedOut ? `שילמת ${paid} ₪ — ההחזר חסום בתקרה של ${String(cap)} ₪` : '',
        ].filter(Boolean).join('\n'),
        inputs: monthly
          ? { monthly: capped, paid }
          : { annual: annualAmount, paid },
        sourceRef: `policy/org.json · forgone.${s.key}`,
      },
    }]
  })
}
