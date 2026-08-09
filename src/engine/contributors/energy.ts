import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { UsageSplit } from '../usage'
import type { CalcContext } from '../calculate'

export type EnergyPrices = {
  petrol95PerLiter: number
  homeElectricityPerKwh: number
  /**
   * Diesel is not price-regulated in Israel, so unlike petrol there is no
   * official maximum to anchor to. Optional because most fleets have none.
   */
  dieselPerLiter?: number | null | undefined
}

export type VehicleConsumption = {
  kmPerLiter?: number
  kmPerLiterHybridMode?: number
  kwhPer100km?: number
  /** Which liquid fuel, when the car burns one. Absent means petrol 95. */
  fuel?: string | undefined
}

export type EnergyCost = {
  petrolCost: number
  electricityCost: number
  liters: number
  kwh: number
  /**
   * Names the fuel whose price is missing, when one is. Non-null means
   * petrolCost is not a cost — it is a blank, and the caller must say so
   * rather than print it.
   */
  missingPriceForHe: string | null
}

/**
 * A plug-in burns petrol only once the battery is empty, so the figure that
 * applies to its petrol kilometres is the hybrid-mode one, not a combined
 * cycle number that already assumes some electric driving.
 */
export function kmPerLiterOf(cons: VehicleConsumption): number {
  return cons.kmPerLiterHybridMode ?? cons.kmPerLiter ?? 0
}

/**
 * The pump price for whatever this car actually burns, or null when nobody has
 * supplied one.
 *
 * One car in the fleet is diesel — the Toyota CITY 5, which the source price
 * list recorded as petrol because the manufacturer column had dropped out of
 * the export. Diesel is not price-regulated in Israel, so there is no official
 * figure to fall back on.
 *
 * Returning null rather than substituting the petrol price is the whole point.
 * A car priced on the wrong fuel would show a confident number that is simply
 * untrue, and nothing on screen would say so. A null propagates to the surface
 * as "data missing", which is the honest answer.
 */
export function pricePerLiter(
  cons: VehicleConsumption, prices: EnergyPrices
): number | null {
  if (cons.fuel === 'diesel') return prices.dieselPerLiter ?? null
  return prices.petrol95PerLiter
}

export function energyCostAnnual(
  split: UsageSplit, cons: VehicleConsumption, prices: EnergyPrices
): EnergyCost {
  const kpl = kmPerLiterOf(cons)
  const liters = kpl > 0 ? split.iceKm / kpl : 0
  const kwh = cons.kwhPer100km ? (split.evKm * cons.kwhPer100km) / 100 : 0
  const price = pricePerLiter(cons, prices)
  const missingPriceForHe = price === null && liters > 0 ? 'מחיר סולר' : null
  return {
    liters: round2(liters),
    kwh: round2(kwh),
    petrolCost: price === null ? 0 : round2(liters * price),
    electricityCost: round2(kwh * prices.homeElectricityPerKwh),
    missingPriceForHe,
  }
}

/**
 * The raw cost of moving the car for a year, before the employer's fuel budget
 * is applied. The budget is a separate contributor: keeping the two apart is
 * what lets the ledger show what the driving actually costs next to what the
 * employer covers, instead of one netted number that hides both.
 *
 * Both lines carry the fuel-overage treatment, because together with the
 * budget line that is exactly what they net out to.
 */
export function energyLines(ctx: CalcContext): MoneyLine[] {
  const split: UsageSplit = ctx.usage
  const cons: VehicleConsumption = ctx.vehicle.consumption ?? {}
  const prices: EnergyPrices = ctx.prices
  const { petrolCost, electricityCost, liters, kwh } = energyCostAnnual(split, cons, prices)
  const unitPrice = pricePerLiter(cons, prices) ?? 0
  const treatment = ctx.policy.taxTreatment.fuelOverage
  const out: MoneyLine[] = []

  if (petrolCost !== 0) {
    const kpl = kmPerLiterOf(cons)
    out.push({
      id: 'fuelCost',
      labelHe: 'דלק',
      category: 'energy',
      annualAmount: petrolCost,
      treatment,
      trace: {
        /*
         * On a plug-in the litre count is surprising unless the reader is told
         * where the petrol kilometres come from. The battery covers one charge
         * per working day and no more; everything past that, and every
         * kilometre driven on a day that is not a working day, is petrol. Said
         * plainly here the figure stops looking like a broken economy number
         * and starts looking like the commute it actually describes.
         */
        formulaHe: whyIceKm(split) +
          `${fmt(split.iceKm)} ק"מ ÷ ${fmt(kpl)} קמ"ל = ${fmt(liters)} ליטר\n` +
          `× ${fmt(unitPrice)} ₪ = ${fmt(petrolCost)} ₪ לשנה`,
        inputs: { iceKm: split.iceKm, kmPerLiter: kpl, liters, pricePerLiter: unitPrice },
        sourceRef: 'catalog/fleet-2026.json · consumption · energy/prices-2026.json',
      },
    })
  }

  if (electricityCost !== 0) {
    const per100 = cons.kwhPer100km ?? 0
    out.push({
      id: 'electricityCost',
      labelHe: 'חשמל לטעינה',
      category: 'energy',
      annualAmount: electricityCost,
      treatment,
      trace: {
        formulaHe:
          `${fmt(split.evKm)} ק"מ × ${fmt(per100)} kWh ל-100 ק"מ = ${fmt(kwh)} kWh\n` +
          `× ${fmt(prices.homeElectricityPerKwh)} ₪ = ${fmt(electricityCost)} ₪ לשנה`
          // The one thing a reader cannot infer from the arithmetic: who pays.
          + (ctx.policy.fuel.budgetCoversElectricity ? ''
            : '\nטעינה ביתית אינה מכוסה בקצובת הדלק — העובד משלם אותה בעצמו.'),
        inputs: { evKm: split.evKm, kwhPer100km: per100, kwh, pricePerKwh: prices.homeElectricityPerKwh },
        sourceRef: 'catalog/fleet-2026.json · consumption · energy/prices-2026.json',
      },
    })
  }

  return out
}

/**
 * Where the petrol kilometres came from, for a plug-in that is being charged.
 * Empty for everything else, where the answer is just "all of them".
 *
 * It shows both buckets — commuting days and the rest of the year — and marks
 * the ones where the battery ran out, because that is the fact that decides
 * the number. A reader whose battery empties on both is looking at a car too
 * small for their driving; a reader whose battery empties on neither is paying
 * for petrol they could avoid only by driving less.
 */
function whyIceKm(s: UsageSplit): string {
  if (s.evKm <= 0 || s.iceKm <= 0) return ''
  const full = (perDay: number) => perDay >= s.effectiveEvRangeKm - 0.011
  const commuteEv = Math.min(s.dailyCommuteKm, s.effectiveEvRangeKm)
  const otherEv = Math.min(s.otherDailyKm, s.effectiveEvRangeKm)
  const lines = [
    `טווח חשמלי אמיתי ${fmt(s.effectiveEvRangeKm)} ק"מ, טעינה אחת בבוקר`,
    `נסיעה לעבודה: ${fmt(s.commuteDays)} ימים × ${fmt(s.dailyCommuteKm)} ק"מ`
      + ` → ${fmt(commuteEv)} על חשמל${full(s.dailyCommuteKm) ? ' (הסוללה נגמרת)' : ''}`,
    `שאר השנה: ${fmt(s.otherDays)} ימים × ${fmt(s.otherDailyKm)} ק"מ`
      + ` → ${fmt(otherEv)} על חשמל${full(s.otherDailyKm) ? ' (הסוללה נגמרת)' : ''}`,
    `חשמל בסה"כ: ${fmt(s.evFromCommute)} + ${fmt(s.evFromOther)} = ${fmt(s.evKm)} ק"מ`,
    `דלק: ${fmt(s.annualKm)} − ${fmt(s.evKm)} = ${fmt(s.iceKm)} ק"מ`
      + ` (${Math.round(s.iceKm / s.annualKm * 100)}% מהנסועה)`,
  ]
  return `${lines.join('\n')}\n`
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 })
