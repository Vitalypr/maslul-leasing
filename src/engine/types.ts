/**
 * How a money line interacts with payroll tax.
 *
 * net            – cash moves; taxable income untouched.
 *                  ILS deductions for vehicle upgrade, fuel overage and toll
 *                  roads must be net (NII audit circular 16, 26.9.2023).
 * gross          – cash moves AND taxable income moves by the same amount.
 *                  A deduction taken pre-tax; costs the employee
 *                  amount x (1 - marginal rate).
 * taxableBenefit – no cash moves; taxable income rises. This is usage value.
 * grossedUp      – cash moves at the stated amount; the employer pays the tax
 *                  on it, so the employee nets exactly the stated amount.
 *                  State vehicle reimbursements work this way.
 */
export type TaxTreatment = 'net' | 'gross' | 'taxableBenefit' | 'grossedUp'

export type LineCategory =
  | 'supplement' | 'tax' | 'energy' | 'fuelBudget'
  | 'mileage' | 'oneTime' | 'forgone'

export type MoneyLine = {
  id: string
  labelHe: string
  category: LineCategory
  /** Annual ILS. Positive = leaves the employee. Negative = reaches them. */
  annualAmount: number
  treatment: TaxTreatment
  /**
   * When the money actually moves, when that is not monthly.
   *
   * Most lines are a monthly reality — the supplement leaves the payslip every
   * month. The unused-fuel credit does not: it is reconciled once a year. The
   * annual and contract totals are right either way, but the monthly view
   * divides it by twelve, and without saying so that reads as a rebate arriving
   * every month. The marker is what keeps the average honest.
   */
  cadenceHe?: string | undefined
  trace: {
    formulaHe: string
    inputs: Record<string, number>
    sourceRef: string
  }
}

export type Aggregated = {
  lines: MoneyLine[]
  /** Annual cash the employee actually parts with, before the tax effect. */
  annualCash: number
  /** Annual change to taxable income. */
  annualTaxableDelta: number
  /** Annual tax consequence of that change. Filled by calculate(). */
  annualTaxDelta: number
  /** annualCash + annualTaxDelta */
  annualNet: number
}
