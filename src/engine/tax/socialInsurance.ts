import { round2 } from '../round'
import { bracketTax, type TaxRules } from './incomeTax'

/**
 * Employee-side contributions for 2026: 4.27% up to 7,703 and 12.17% from
 * there to the 51,910 ceiling.
 *
 * The two statutory components are held separately in the rules file rather
 * than pre-summed, so the breakdown can show each one. National insurance is
 * 1.04% / 7%; health is 3.23% / 5.17%. They add to the headline rates.
 *
 * The ceiling is encoded as a final zero-rate bracket, not as a max().
 */
export function socialInsuranceParts(
  monthly: number, rules: TaxRules
): { nationalInsurance: number; healthInsurance: number } {
  return {
    nationalInsurance: round2(bracketTax(monthly, rules.nationalInsuranceMonthlyBrackets)),
    healthInsurance:   round2(bracketTax(monthly, rules.healthInsuranceMonthlyBrackets)),
  }
}

export function socialInsuranceMonthly(monthly: number, rules: TaxRules): number {
  const p = socialInsuranceParts(monthly, rules)
  return round2(p.nationalInsurance + p.healthInsurance)
}
