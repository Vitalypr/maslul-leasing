import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'
import { leaseSupplement } from './leaseSupplement'
import { usageValueTax } from './usageValueTax'
import { energyLines } from './energy'
import { fuelBudgetLines } from './fuelBudget'
import { excessKmLines } from './excessKm'
import { oneTimeLines } from './oneTime'

export type Contributor = (ctx: CalcContext) => MoneyLine[]

/**
 * The whole cost model, in order. Adding a cost component means writing one
 * file and adding one entry here. Removing one means deleting its entry.
 * Order matters only for display; the aggregate is order-independent.
 */
export const CONTRIBUTORS: Contributor[] = [
  leaseSupplement,
  usageValueTax,
  energyLines,
  fuelBudgetLines,
  excessKmLines,
  oneTimeLines,
]
