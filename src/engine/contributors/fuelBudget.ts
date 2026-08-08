import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'
import { energyCostAnnual } from './energy'
import { supplementMonthly } from './leaseSupplement'

/**
 * Fuel the employer budgeted but the employee did not burn is settled once a
 * year and offsets the upgrade supplement — but only up to the supplement.
 * There is no cash payout beyond it, and none at all when no supplement exists.
 */
export function unusedFuelCredit(
  annualBudget: number, annualSpend: number, annualSupplement: number
): number {
  const unused = Math.max(0, annualBudget - annualSpend)
  return round2(Math.min(unused, Math.max(0, annualSupplement)))
}

/**
 * A mild hybrid runs on petrol alone, so it draws on the petrol budget. Every
 * other electrified powertrain draws on the electrified one.
 */
export function monthlyFuelBudget(ctx: CalcContext): number {
  const electrified = ctx.vehicle.powertrain === 'hybrid'
    || ctx.vehicle.powertrain === 'phev'
    || ctx.vehicle.powertrain === 'bev'
  const fromEmployee = electrified
    ? ctx.employee.monthlyFuelBudgetElectrified
    : ctx.employee.monthlyFuelBudgetIce
  const fromPolicy = electrified
    ? ctx.policy.fuel.defaultMonthlyBudgetElectrified
    : ctx.policy.fuel.defaultMonthlyBudgetIce
  return ctx.policy.fuel.employeeEntersBudget
    ? (fromEmployee ?? fromPolicy ?? 0)
    : (fromPolicy ?? 0)
}

/**
 * The employer's side of the fuel account, in two lines.
 *
 * The first cancels the energy cost the budget actually covers — never more
 * than was spent, because a budget reimburses fuel, it does not hand out cash.
 * Whatever energy cost is left over is the overage, and the employee pays it
 * from net.
 *
 * The second is the annual settlement of the other direction: budget that went
 * unspent comes back, capped at the upgrade supplement, and only when there is
 * a supplement for it to offset.
 */
export function fuelBudgetLines(ctx: CalcContext): MoneyLine[] {
  const monthlyBudget = monthlyFuelBudget(ctx)
  const annualBudget = round2(monthlyBudget * 12)

  const energy = energyCostAnnual(ctx.usage, ctx.vehicle.consumption ?? {}, ctx.prices)
  const annualSpend = round2(energy.petrolCost + energy.electricityCost)

  const out: MoneyLine[] = []
  const covered = round2(Math.min(annualBudget, annualSpend))

  if (covered !== 0) {
    out.push({
      id: 'fuelBudget',
      labelHe: 'קצובת דלק מהמעסיק',
      category: 'fuelBudget',
      annualAmount: -covered,
      treatment: ctx.policy.taxTreatment.fuelOverage,
      trace: {
        formulaHe:
          `תקציב ${fmt(monthlyBudget)} ₪ × 12 = ${fmt(annualBudget)} ₪\n` +
          `הוצאת אנרגיה בפועל ${fmt(annualSpend)} ₪ → מכוסה ${fmt(covered)} ₪`,
        inputs: { monthlyBudget, annualBudget, annualSpend, covered },
        sourceRef: 'policy/org.json · fuel',
      },
    })
  }

  const credit = creditFor(ctx, annualBudget, annualSpend)
  if (credit !== 0) {
    out.push({
      id: 'unusedFuelCredit',
      labelHe: 'זיכוי דלק שלא נוצל',
      category: 'fuelBudget',
      annualAmount: -credit,
      treatment: ctx.policy.taxTreatment.unusedFuelCredit,
      trace: {
        formulaHe:
          `${fmt(annualBudget)} − ${fmt(annualSpend)} = ${fmt(Math.max(0, annualBudget - annualSpend))} ₪ שלא נוצלו\n` +
          `מקוזז מול התוספת השנתית ${fmt(annualSupplement(ctx))} ₪ → ${fmt(credit)} ₪`,
        inputs: {
          annualBudget, annualSpend,
          annualSupplement: annualSupplement(ctx),
          credit,
        },
        sourceRef: 'policy/org.json · fuel.unusedCredit',
      },
    })
  }

  return out
}

function annualSupplement(ctx: CalcContext): number {
  return round2(supplementMonthly(
    ctx.vehicle.listPrice,
    ctx.employee.serviceTier,
    ctx.vehicle.supplementRate,
    ctx.employee.rambiEligible,
    ctx.policy
  ) * 12)
}

function creditFor(ctx: CalcContext, annualBudget: number, annualSpend: number): number {
  if (!ctx.policy.fuel.unusedCreditEnabled) return 0
  if (!ctx.policy.fuel.unusedCreditCappedAtSupplement) {
    return round2(Math.max(0, annualBudget - annualSpend))
  }
  return unusedFuelCredit(annualBudget, annualSpend, annualSupplement(ctx))
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 })
