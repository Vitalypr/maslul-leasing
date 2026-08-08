import { round2 } from './round'
import type { Powertrain } from './tax/usageValue'

export type UsageInput = {
  annualKm: number
  commuteOneWayKm: number
  workDaysPerMonth: number
  powertrain: Powertrain
  chargesDaily: boolean
  manufacturerEvRangeKm: number | null
  /** Overrides the manufacturer figure and the factor when present. */
  realEvRangeKm: number | null
  realWorldRangeFactor: number
}

export type UsageSplit = {
  annualKm: number
  evKm: number
  iceKm: number
  dailyCommuteKm: number
  workDaysPerYear: number
  dailyPortionKm: number
  longTripKm: number
  effectiveEvRangeKm: number
}

/**
 * Splits the annual mileage between electricity and petrol.
 *
 * The plug-in model the client specified: the round-trip commute on working
 * days runs on the battery up to the real-world range; whatever is left of the
 * annual mileage is long trips and runs on petrol. Real range comes from a
 * per-model measured value when the catalogue has one, otherwise from the
 * manufacturer figure times a policy factor — the manufacturer number on its
 * own overstates the electric share badly.
 *
 * evKm and iceKm always sum back to annualKm: iceKm is derived by subtraction,
 * never computed independently.
 */
export function splitAnnualKm(i: UsageInput): UsageSplit {
  const dailyCommuteKm = i.commuteOneWayKm * 2
  const workDaysPerYear = i.workDaysPerMonth * 12
  const dailyPortionKm = Math.min(dailyCommuteKm * workDaysPerYear, i.annualKm)
  const longTripKm = round2(i.annualKm - dailyPortionKm)

  const effectiveEvRangeKm =
    i.realEvRangeKm ??
    round2((i.manufacturerEvRangeKm ?? 0) * i.realWorldRangeFactor)

  const shell = {
    annualKm: i.annualKm, dailyCommuteKm, workDaysPerYear,
    dailyPortionKm, longTripKm, effectiveEvRangeKm,
  }

  if (i.powertrain === 'bev') {
    return { ...shell, evKm: i.annualKm, iceKm: 0 }
  }
  if (i.powertrain !== 'phev' || !i.chargesDaily) {
    return { ...shell, evKm: 0, iceKm: i.annualKm }
  }

  // The battery covers at most one full charge per working day, and never
  // more than the distance actually driven that day. Long trips exceed the
  // battery by definition, so they stay on petrol.
  const evPerDay = Math.min(dailyCommuteKm, effectiveEvRangeKm)
  const evKm = round2(Math.min(evPerDay * workDaysPerYear, dailyPortionKm))
  return { ...shell, evKm, iceKm: round2(i.annualKm - evKm) }
}
