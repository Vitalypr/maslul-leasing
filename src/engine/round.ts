/**
 * Rounds to 2 decimals without binary floating-point drift.
 * Math.round(1.005 * 100) gives 100 because 1.005 is stored as 1.00499...
 * The epsilon nudge, applied in the direction of the sign, fixes it.
 */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100
}
