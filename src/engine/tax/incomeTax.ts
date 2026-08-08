import { round2 } from '../round'

export type Bracket = { upTo: number | null; rate: number }

export type TaxRules = {
  incomeTaxMonthlyBrackets: Bracket[]
  nationalInsuranceMonthlyBrackets: Bracket[]
  healthInsuranceMonthlyBrackets: Bracket[]
  creditPointValueMonthly: number
}

export function bracketTax(monthly: number, brackets: Bracket[]): number {
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    const cap = b.upTo ?? Infinity
    if (monthly <= prev) break
    tax += (Math.min(monthly, cap) - prev) * b.rate
    prev = cap
  }
  return tax
}

export function incomeTaxMonthly(
  monthly: number, creditPoints: number, rules: TaxRules
): number {
  const gross = bracketTax(monthly, rules.incomeTaxMonthlyBrackets)
  const credit = creditPoints * rules.creditPointValueMonthly
  return round2(Math.max(0, gross - credit))
}
