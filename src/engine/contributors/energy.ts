import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { UsageSplit } from '../usage'
import type { CalcContext } from '../calculate'

export type EnergyPrices = {
  petrol95PerLiter: number
  homeElectricityPerKwh: number
}

export type VehicleConsumption = {
  kmPerLiter?: number
  kmPerLiterHybridMode?: number
  kwhPer100km?: number
}

export type EnergyCost = {
  petrolCost: number
  electricityCost: number
  liters: number
  kwh: number
}

/**
 * A plug-in burns petrol only once the battery is empty, so the figure that
 * applies to its petrol kilometres is the hybrid-mode one, not a combined
 * cycle number that already assumes some electric driving.
 */
export function kmPerLiterOf(cons: VehicleConsumption): number {
  return cons.kmPerLiterHybridMode ?? cons.kmPerLiter ?? 0
}

export function energyCostAnnual(
  split: UsageSplit, cons: VehicleConsumption, prices: EnergyPrices
): EnergyCost {
  const kpl = kmPerLiterOf(cons)
  const liters = kpl > 0 ? split.iceKm / kpl : 0
  const kwh = cons.kwhPer100km ? (split.evKm * cons.kwhPer100km) / 100 : 0
  return {
    liters: round2(liters),
    kwh: round2(kwh),
    petrolCost: round2(liters * prices.petrol95PerLiter),
    electricityCost: round2(kwh * prices.homeElectricityPerKwh),
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
        formulaHe:
          `${fmt(split.iceKm)} ק"מ ÷ ${fmt(kpl)} קמ"ל = ${fmt(liters)} ליטר\n` +
          `× ${fmt(prices.petrol95PerLiter)} ₪ = ${fmt(petrolCost)} ₪ לשנה`,
        inputs: { iceKm: split.iceKm, kmPerLiter: kpl, liters, pricePerLiter: prices.petrol95PerLiter },
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
          `× ${fmt(prices.homeElectricityPerKwh)} ₪ = ${fmt(electricityCost)} ₪ לשנה`,
        inputs: { evKm: split.evKm, kwhPer100km: per100, kwh, pricePerKwh: prices.homeElectricityPerKwh },
        sourceRef: 'catalog/fleet-2026.json · consumption · energy/prices-2026.json',
      },
    })
  }

  return out
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 })
