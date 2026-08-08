import { round2 } from '../round'
import { incomeTaxMonthly, type TaxRules } from './incomeTax'
import { socialInsuranceMonthly } from './socialInsurance'

function totalMonthly(monthly: number, points: number, rules: TaxRules): number {
  return incomeTaxMonthly(monthly, points, rules)
       + socialInsuranceMonthly(monthly, rules)
}

/**
 * The tax consequence of adding `annualTaxableDelta` on top of the salary.
 *
 * This is deliberately a difference of two full computations rather than
 * amount x marginal-rate. The addition can cross a bracket boundary or the
 * national-insurance ceiling, and a flat percentage silently gets those wrong.
 */
export function deltaTaxAnnual(
  annualSalary: number,
  annualTaxableDelta: number,
  creditPoints: number,
  rules: TaxRules
): number {
  if (annualTaxableDelta === 0) return 0
  const base = annualSalary / 12
  const after = (annualSalary + annualTaxableDelta) / 12
  const delta = totalMonthly(after, creditPoints, rules)
              - totalMonthly(base, creditPoints, rules)
  return round2(delta * 12)
}
