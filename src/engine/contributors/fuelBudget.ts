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

  /*
   * What the budget is allowed to pay for.
   *
   * Petrol only. The employer budgets fuel; home charging is on the employee's
   * own electricity bill and never touches this account. The distinction is
   * invisible in the total for an ordinary plug-in — the arithmetic happens to
   * land in the same place — but it is not invisible for a battery car, where
   * treating charging as budget-eligible would silently refund an expense the
   * employer never agreed to cover.
   */
  const energy = energyCostAnnual(ctx.usage, ctx.vehicle.consumption ?? {}, ctx.prices)
  const annualSpend = ctx.policy.fuel.budgetCoversElectricity
    ? round2(energy.petrolCost + energy.electricityCost)
    : round2(energy.petrolCost)

  const out: MoneyLine[] = []
  const covered = round2(Math.min(annualBudget, annualSpend))
  // Named on screen so nobody has to infer the scope of the budget.
  const spendHe = ctx.policy.fuel.budgetCoversElectricity ? 'אנרגיה' : 'דלק'

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
          `הוצאת ${spendHe} בפועל ${fmt(annualSpend)} ₪ → מכוסה ${fmt(covered)} ₪`
          + (ctx.policy.fuel.budgetCoversElectricity ? ''
            : '\nהקצובה מיועדת לדלק בלבד. חשמל לטעינה משולם על ידי העובד.'),
        inputs: { monthlyBudget, annualBudget, annualSpend, covered },
        sourceRef: 'policy/org.json · fuel',
      },
    })
  }

  /*
   * The annual settlement always appears, including when it settles to zero.
   *
   * It used to be emitted only when there was money in it, which is what a
   * ledger normally wants — a row of nought is noise. It is the wrong rule
   * here. This is the one line a reader goes looking for, and finding nothing
   * where they expected a refund reads as a fault in the app rather than as an
   * answer. So the row states the outcome either way, and when the outcome is
   * nothing it says by how much the budget was overspent.
   */
  if (ctx.policy.fuel.unusedCreditEnabled && annualBudget > 0) {
    const unused = round2(Math.max(0, annualBudget - annualSpend))
    const over = round2(Math.max(0, annualSpend - annualBudget))
    const credit = creditFor(ctx, annualBudget, annualSpend)
    const cap = annualSupplement(ctx)

    out.push({
      id: 'unusedFuelCredit',
      labelHe: credit > 0 ? 'זיכוי קצובת דלק שלא נוצלה' : 'זיכוי קצובת דלק — אין',
      category: 'fuelBudget',
      // Normalised: -0 is a real JS value and would print as a negative nought.
      annualAmount: credit === 0 ? 0 : -credit,
      /*
       * Settled once a year against the supplement, not returned monthly — and
       * the year's figure is written in here rather than left to the display.
       * A line arrives at the ledger already scaled to whichever horizon the
       * reader picked, so by then the annual sum cannot be recovered, and
       * "₪27" against "settled once a year" is a question, not an answer.
       */
      cadenceHe: credit > 0
        ? `מסולק פעם בשנה · ₪${fmt(Math.round(credit))} בשנה`
        : 'מסולק פעם בשנה',
      treatment: ctx.policy.taxTreatment.unusedFuelCredit,
      trace: {
        formulaHe: over > 0
          ? `קצובה ${fmt(annualBudget)} ₪ − הוצאת ${spendHe} ${fmt(annualSpend)} ₪ = חריגה של ${fmt(over)} ₪\n`
            + 'ההוצאה גבוהה מהקצובה, ולכן לא נותר ממה לזכות. אין החזר.'
          : `קצובה ${fmt(annualBudget)} ₪ − הוצאת ${spendHe} ${fmt(annualSpend)} ₪ = ${fmt(unused)} ₪ שלא נוצלו\n`
            + `תקרה: התוספת השנתית ${fmt(cap)} ₪ → מוחזר ${fmt(credit)} ₪`,
        inputs: {
          annualBudget, annualSpend, unused, overspend: over,
          annualSupplement: cap, credit,
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
