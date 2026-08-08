import { round2 } from './round'
import type { MoneyLine } from './types'

export function splitByTreatment(lines: MoneyLine[]): {
  cash: number; taxableDelta: number
} {
  let cash = 0
  let taxableDelta = 0
  for (const l of lines) {
    switch (l.treatment) {
      case 'net':
      case 'grossedUp':
        cash += l.annualAmount
        break
      case 'gross':
        cash += l.annualAmount
        taxableDelta -= l.annualAmount
        break
      case 'taxableBenefit':
        taxableDelta += l.annualAmount
        break
    }
  }
  return { cash: round2(cash), taxableDelta: round2(taxableDelta) }
}
