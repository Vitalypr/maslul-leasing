import type { MoneyLine } from '../types'

/**
 * One-time events over the life of the contract — deposit, return charges,
 * accident excess.
 *
 * This returns nothing, deliberately and temporarily. The client has not
 * supplied a deposit figure, a return-charge schedule or an accident-excess
 * amount, and inventing any of them would put a made-up number inside the
 * three-year total, which is the one figure an employee is most likely to act
 * on. An empty list is visibly empty; a guess is not.
 *
 * The consequence is recorded in docs/ASSUMPTIONS.md section ד, item 11: the
 * three-year figure is understated until these arrive.
 *
 * When they do arrive they belong in policy/org.json under a `oneTime` block
 * and are emitted here with `category: 'oneTime'` and
 * `treatment: ctx.policy.taxTreatment.oneTime` — which already exists and reads
 * 'net'. calculate() already separates that category out of the recurring
 * annual figure, so nothing downstream needs to change.
 *
 * It takes no context on purpose: a contributor may declare fewer parameters
 * than the registry passes, and an unused one would only be noise.
 */
export function oneTimeLines(): MoneyLine[] {
  return []
}
