import { round2 } from './round'
import type { Powertrain } from './tax/usageValue'

/**
 * How a year's driving divides between the battery and the tank.
 *
 * The model, as the client specified it:
 *
 *   The employee drives to work on a fixed number of days a year — 210 by
 *   default, which is 42 working weeks of five days. Working from home one or
 *   two days a week removes one or two of those days from every working week,
 *   giving 168 or 126. Everything else the employee drives is spread evenly
 *   across the remaining days of the year. And the car is charged overnight,
 *   so on any single day it can travel at most one full battery on electricity
 *   before the engine takes over.
 *
 * The consequence worth understanding is the ceiling: one charge a day means
 * electric distance can never exceed 365 x range, however the days are
 * arranged. For a car with 83 km of real range that is 30,295 km a year, and a
 * driver above it is on petrol for the remainder no matter what they do.
 *
 * What this replaced, and why. The previous model gave the battery only the
 * commute and sent every other kilometre to petrol as a "long trip". That
 * badly understated the electric share for anyone who drives at weekends: a
 * 30 km Sunday errand ran on petrol while an identical 30 km Monday commute
 * ran on the battery, which is not how the car behaves.
 *
 * The remaining simplification is deliberate and was confirmed with the
 * client: non-commuting distance is averaged over its days rather than being
 * modelled as a few long journeys. Averaging is generous to electricity — one
 * 500 km trip earns the same electric credit as five 100 km trips — so a
 * driver who takes occasional long journeys will do slightly worse in reality
 * than this predicts.
 */

export type UsageInput = {
  annualKm: number
  commuteOneWayKm: number
  /** Days a year the employee drives to work before working from home. */
  commuteDaysPerYear: number
  /** 0, 1 or 2. Each one removes a day from every working week. */
  wfhDaysPerWeek: number
  /** Days in the year. A policy input only so nothing hardcodes 365. */
  daysPerYear: number
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

  /** Days driven to work, after working from home is taken off. */
  commuteDays: number
  /** Round trip on one of those days. Reduced if the annual total cannot cover it. */
  dailyCommuteKm: number
  commuteKm: number

  /** Every other day of the year, including the days worked from home. */
  otherDays: number
  otherKm: number
  otherDailyKm: number

  effectiveEvRangeKm: number
  /** Where the electric distance came from, so the trace can show its working. */
  evFromCommute: number
  evFromOther: number
}

/** 210 days is 42 weeks of five, so one home day a week costs 42 days. */
export function commuteDaysAfterWfh(
  commuteDaysPerYear: number, wfhDaysPerWeek: number,
): number {
  const wfh = Math.min(5, Math.max(0, wfhDaysPerWeek))
  return Math.round(commuteDaysPerYear * (5 - wfh) / 5)
}

export function splitAnnualKm(i: UsageInput): UsageSplit {
  const annualKm = Math.max(0, i.annualKm)
  const daysPerYear = Math.max(1, i.daysPerYear)

  const commuteDays = Math.min(
    daysPerYear, commuteDaysAfterWfh(i.commuteDaysPerYear, i.wfhDaysPerWeek),
  )
  const otherDays = daysPerYear - commuteDays

  /*
   * The commute cannot exceed the distance actually driven. When a reader
   * enters a long commute and a low annual total the two disagree, and the
   * annual total is the figure the lease is written against, so it wins: the
   * commute is scaled down to fit rather than manufacturing kilometres that
   * were never driven.
   *
   * The per-day figures stay unrounded until they are reported. Rounding them
   * first and multiplying back leaks distance: 12,000 km over
   * 210 days is 57.142857, which rounds to 57.14, and 210 of those is 11,999.4
   * — six hundred metres of driving that silently became petrol. Small, but it
   * is the kind of error that makes a reader who checks the arithmetic stop
   * trusting the rest of the page.
   */
  const statedCommuteKm = commuteDays * Math.max(0, i.commuteOneWayKm) * 2
  const commuteKmRaw = Math.min(statedCommuteKm, annualKm)
  const dailyCommuteRaw = commuteDays > 0 ? commuteKmRaw / commuteDays : 0

  const otherKmRaw = annualKm - commuteKmRaw
  const otherDailyRaw = otherDays > 0 ? otherKmRaw / otherDays : 0

  const effectiveEvRangeKm = i.realEvRangeKm
    ?? round2((i.manufacturerEvRangeKm ?? 0) * i.realWorldRangeFactor)

  const shell = {
    annualKm, commuteDays, otherDays, effectiveEvRangeKm,
    dailyCommuteKm: round2(dailyCommuteRaw),
    commuteKm: round2(commuteKmRaw),
    otherKm: round2(otherKmRaw),
    otherDailyKm: round2(otherDailyRaw),
  }

  if (i.powertrain === 'bev') {
    return { ...shell, evKm: annualKm, iceKm: 0, evFromCommute: 0, evFromOther: 0 }
  }
  if (i.powertrain !== 'phev' || !i.chargesDaily) {
    return { ...shell, evKm: 0, iceKm: annualKm, evFromCommute: 0, evFromOther: 0 }
  }

  // One charge per day, on every day, whether or not it is a working day.
  const evFromCommuteRaw = commuteDays * Math.min(dailyCommuteRaw, effectiveEvRangeKm)
  const evFromOtherRaw = otherDays * Math.min(otherDailyRaw, effectiveEvRangeKm)
  const evFromCommute = round2(evFromCommuteRaw)
  const evFromOther = round2(evFromOtherRaw)

  // Clamped for safety, though the two buckets are bounded by their own
  // distances and so cannot exceed the annual total on their own.
  const evKm = round2(Math.min(evFromCommuteRaw + evFromOtherRaw, annualKm))
  return { ...shell, evKm, iceKm: round2(annualKm - evKm), evFromCommute, evFromOther }
}
