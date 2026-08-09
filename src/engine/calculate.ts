import { round2 } from './round'
import { splitByTreatment } from './money'
import { deltaTaxAnnual } from './tax/marginal'
import { type TaxRules } from './tax/incomeTax'
import { type Powertrain, type UsageValueRules } from './tax/usageValue'
import { splitAnnualKm, type UsageSplit } from './usage'
import { CONTRIBUTORS } from './contributors'
import type { ServiceTier } from './contributors/leaseSupplement'
import { energyCostAnnual } from './contributors/energy'
import type { EnergyPrices, VehicleConsumption } from './contributors/energy'
import { forgoneLines } from './forgone'
import type { ForgoneAnnualItem, ForgoneMonthlyItem } from './forgone'
import type { MoneyLine, TaxTreatment } from './types'

/**
 * Consumption as the catalogue records it. Every field is optional because the
 * shape follows the powertrain: a petrol car has kmPerLiter and no battery
 * figures, a plug-in has both. `fuel` and `source` are carried so a caller can
 * mark a cost as resting on an estimate — every figure in the catalogue is one
 * today (docs/ASSUMPTIONS.md section ה).
 */
export type VehicleConsumptionData = VehicleConsumption & {
  evRangeKm?: number
  fuel?: string
  source?: string
}

/** The slice of a catalogue row the engine reads. */
export type Vehicle = {
  id: string
  nameHe: string
  powertrain: Powertrain
  listPrice: number
  supplementRate: number
  consumption?: VehicleConsumptionData
  /**
   * A measured electric range, when one exists. It beats the manufacturer
   * figure times the policy factor, because the factor is a guess and this is
   * not.
   */
  realEvRangeKm?: number | null
}

/**
 * Everything the employee supplies. Salary and commute distance are the reason
 * this stays on the device: they never leave localStorage.
 */
export type Employee = {
  grossMonthlySalary: number
  creditPoints: number
  serviceTier: ServiceTier
  commuteOneWayKm: number
  workDaysPerMonth: number
  annualKm: number
  rambiEligible: boolean
  chargesDaily: boolean
  monthlyFuelBudgetIce: number
  monthlyFuelBudgetElectrified: number
  receivesLicenseFee: boolean
  receivesPrivateInsurance: boolean
  receivesServiceVehicleTierC: boolean
  receivesFixedNet: boolean
  receivesVariableNet: boolean
  /* The forgone amounts are the employee's own figures. The licence fee follows
     the car actually owned and the insurance follows the quote actually paid,
     so policy can only supply the ceiling, never the value. */
  licenseFeeAnnualPaid: number
  privateInsuranceAnnualPaid: number
  serviceVehicleTierCMonthly: number
  fixedNetMonthly: number
  variableNetMonthly: number
  /** A plug-in needs a wallbox, and the employee pays for it. */
  installsCharger: boolean
  chargerInstallCost: number
}

/**
 * Every tax treatment the engine reads, and nothing else. Each is a data value
 * in policy/org.json — changing whether a component comes off the gross or the
 * net is a one-word edit there, never a code change. That is the point of the
 * whole design, so the type names the keys explicitly rather than accepting an
 * index signature that would let a typo pass as `undefined`.
 */
export type PolicyTaxTreatment = {
  upgradeSupplement: TaxTreatment
  excessKm: TaxTreatment
  fuelOverage: TaxTreatment
  unusedFuelCredit: TaxTreatment
  homeChargingRefund: TaxTreatment
  usageValue: TaxTreatment
  oneTime: TaxTreatment
  forgoneLicenseFee: TaxTreatment
  forgoneInsurance: TaxTreatment
  forgoneServiceVehicleTierC: TaxTreatment
  forgoneFixedNet: TaxTreatment
  forgoneVariableNet: TaxTreatment
}

export type Policy = {
  supplement: {
    budgetByTier: Record<ServiceTier, number>
    defaultRate: number
    highRate: number
    highRateThreshold: number | null
    rambiDiscount: number
  }
  mileage: {
    annualQuotaKm: number
    excessRatePerKm: number
    creditForUnusedKm: boolean
  }
  contract: { termMonths: number }
  fuel: {
    employeeEntersBudget: boolean
    defaultMonthlyBudgetIce: number
    defaultMonthlyBudgetElectrified: number
    unusedCreditEnabled: boolean
    unusedCreditCappedAtSupplement: boolean
  }
  phev: { realWorldRangeFactor: number }
  chargerInstall: { appliesTo: string[]; excludedFromTotals: boolean }
  forgone: {
    licenseFeeAnnual: ForgoneAnnualItem
    privateInsuranceAnnual: ForgoneAnnualItem
    serviceVehicleTierC: ForgoneMonthlyItem
    fixedNetAllowance: ForgoneMonthlyItem
    variableNetAllowance: ForgoneMonthlyItem
  }
  taxTreatment: PolicyTaxTreatment
}

/** Brackets and credit points, plus the usage-value model. */
export type CalcTaxRules = TaxRules & UsageValueRules

/** What a caller hands the engine. */
export type CalcInput = {
  vehicle: Vehicle
  employee: Employee
  policy: Policy
  taxRules: CalcTaxRules
  prices: EnergyPrices
}

/**
 * The input plus the mileage split, computed once and shared.
 *
 * Deriving it here rather than inside each contributor matters: the split is
 * the single most expensive assumption in the model for a plug-in, and two
 * contributors disagreeing about it would be invisible in the totals.
 */
export type CalcContext = CalcInput & { usage: UsageSplit }

export type CalcResult = {
  /**
   * The computational truth: every contributor's output, including the imputed
   * benefit lines that move taxable income without moving cash.
   */
  lines: MoneyLine[]
  /**
   * The same cost, arranged so a reader can add it up.
   *
   * `lines` contains שווי שימוש at its full imputed value — 2,714 a month on a
   * 154,990 plug-in — but nobody pays that. They pay the tax on it, which at a
   * 35,000 salary is 1,280. Printing the imputation in a column of costs makes
   * the column disagree with its own total by the difference, and a reader who
   * adds it up finds the app wrong.
   *
   * So every taxable-benefit line is folded into one line carrying the actual
   * tax, and the imputation moves into that line's trace where it belongs as
   * an input. These lines sum to annualNet.
   */
  ledger: MoneyLine[]
  forgone: MoneyLine[]
  /** Annual cash the employee parts with, before the tax effect. */
  annualCash: number
  /** Annual change to taxable income, from the lease alone. */
  annualTaxableDelta: number
  annualTaxDelta: number
  /** annualCash + annualTaxDelta. The real annual cost of the car. */
  annualNet: number
  monthlyNet: number
  oneTimeTotal: number
  threeYearNet: number
  /** Face value of the benefits that stop arriving. */
  forgoneCash: number
  /** The tax effect of losing them; negative when a gross component is lost. */
  forgoneTaxDelta: number
  /** What giving them up actually costs, after the tax effect. */
  forgoneAnnual: number
  /**
   * Installing a home charger, paid once by the employee.
   *
   * Deliberately NOT in annualNet, monthlyNet or threeYearNet. It is a single
   * outlay on the employee's own property that outlives the lease, so folding
   * it into a monthly figure would misstate the cost of the car in both
   * directions — inflating the month and implying it recurs.
   */
  chargerInstallOneTime: number
  /**
   * What is missing before this car can be costed at all, in Hebrew, or null.
   *
   * Non-null means the totals above are incomplete and must not be presented
   * as a cost. Suppressing the figure is the point: a confident number built
   * on an absent input is worse than an admission.
   */
  missingDataHe: string | null
}

/**
 * The wallbox, when the car needs one and the employee says they will fit one.
 * Reported on its own so the screen can show it beside the car without it ever
 * reaching a per-month figure.
 */
/**
 * Whether a required input is absent. Today that is only the diesel price:
 * Israel does not regulate it, so no official figure exists to fall back on,
 * and one car in the fleet runs on it.
 */
function missingData(ctx: CalcContext): string | null {
  return energyCostAnnual(
    ctx.usage, ctx.vehicle.consumption ?? {}, ctx.prices,
  ).missingPriceForHe
}

/**
 * Rewrites the computed lines into a column that adds up.
 *
 * Taxable-benefit lines are replaced by a single line holding the tax they
 * actually caused. The benefit itself, and the marginal rate it came off at,
 * move into the trace — which is where an input belongs.
 */
function toLedger(
  lines: MoneyLine[], annualTaxDelta: number, ctx: CalcContext,
): MoneyLine[] {
  const imputed = lines.filter(l => l.treatment === 'taxableBenefit')
  const cash = lines.filter(l => l.treatment !== 'taxableBenefit')
  if (imputed.length === 0) return cash

  const benefitAnnual = round2(imputed.reduce((s, l) => s + l.annualAmount, 0))
  const effectiveRate = benefitAnnual === 0 ? 0 : annualTaxDelta / benefitAnnual
  const monthly = (n: number) => round2(n / 12).toLocaleString('en-US')

  const taxLine: MoneyLine = {
    id: 'usageValueTax',
    labelHe: 'מס על שווי שימוש',
    category: 'tax',
    annualAmount: annualTaxDelta,
    // Cash out of the payslip. It shifts no further taxable income of its own —
    // it IS the tax on the shift already counted.
    treatment: 'net',
    trace: {
      formulaHe:
        `${imputed.map(l => l.labelHe).join(' + ')}: ` +
        `${monthly(benefitAnnual)} ₪ לחודש נזקפים לשכר
` +
        `מס(שכר + זקיפה) − מס(שכר) = ${monthly(annualTaxDelta)} ₪ לחודש
` +
        `שיעור שולי בפועל ${(effectiveRate * 100).toFixed(2)}% — מדרגת מס הכנסה ` +
        `בתוספת ביטוח לאומי ובריאות`,
      inputs: {
        usageValueMonthly: round2(benefitAnnual / 12),
        taxMonthly: round2(annualTaxDelta / 12),
        effectiveMarginalRate: round2(effectiveRate * 100),
        grossMonthlySalary: ctx.employee.grossMonthlySalary,
      },
      sourceRef: 'tax-rules/2026.json · מדרגות מס, ביטוח לאומי ובריאות',
    },
  }

  // Keep the tax where the imputation stood, so the order still reads as the
  // order the money is accounted in.
  const at = lines.findIndex(l => l.treatment === 'taxableBenefit')
  const before = lines.slice(0, at).filter(l => l.treatment !== 'taxableBenefit')
  const after = lines.slice(at).filter(l => l.treatment !== 'taxableBenefit')
  return [...before, taxLine, ...after]
}

function chargerInstall(ctx: CalcContext): number {
  const { installsCharger, chargerInstallCost } = ctx.employee
  if (!installsCharger) return 0
  if (!ctx.policy.chargerInstall.appliesTo.includes(ctx.vehicle.powertrain)) return 0
  return round2(Math.max(0, chargerInstallCost))
}

function withUsage(input: CalcInput): CalcContext {
  const { vehicle, employee, policy } = input
  return {
    ...input,
    usage: splitAnnualKm({
      annualKm: employee.annualKm,
      commuteOneWayKm: employee.commuteOneWayKm,
      workDaysPerMonth: employee.workDaysPerMonth,
      powertrain: vehicle.powertrain,
      chargesDaily: employee.chargesDaily,
      manufacturerEvRangeKm: vehicle.consumption?.evRangeKm ?? null,
      realEvRangeKm: vehicle.realEvRangeKm ?? null,
      realWorldRangeFactor: policy.phev.realWorldRangeFactor,
    }),
  }
}

/**
 * The single entry point. Runs both pipelines and prices the tax once for each.
 *
 * The two are kept apart on purpose. The lease cost answers "what does this car
 * cost me"; the forgone benefits answer "what do I stop receiving". Adding them
 * together would produce a number that answers neither.
 */
export function calculate(input: CalcInput): CalcResult {
  const ctx = withUsage(input)
  const annualSalary = ctx.employee.grossMonthlySalary * 12
  const { creditPoints } = ctx.employee

  const lines = CONTRIBUTORS.flatMap(c => c(ctx))
  const forgone = forgoneLines(ctx)

  const { cash, taxableDelta } = splitByTreatment(lines)
  const annualTaxDelta = deltaTaxAnnual(
    annualSalary, taxableDelta, creditPoints, ctx.taxRules,
  )

  const oneTimeTotal = round2(
    lines.filter(l => l.category === 'oneTime')
         .reduce((s, l) => s + l.annualAmount, 0),
  )
  const annualNet = round2(cash + annualTaxDelta)
  // A one-time event is paid once over the contract, not once a year, so it is
  // lifted out before the recurring part is multiplied and added back after.
  const recurringAnnual = round2(annualNet - oneTimeTotal)

  // Forgone benefits need their own tax pass, because "רכב שירות ג'" is a gross
  // salary component — giving it up lowers taxable income and therefore costs
  // less than its face value. Its delta is measured on top of the lease's own
  // taxable change, since if the employee takes the car both happen at once and
  // land on the same marginal rate. Pricing it against a bare salary instead
  // would value it at the wrong bracket.
  const fg = splitByTreatment(forgone)
  const forgoneTaxDelta = round2(
    deltaTaxAnnual(
      annualSalary, taxableDelta + fg.taxableDelta, creditPoints, ctx.taxRules,
    ) - annualTaxDelta,
  )

  return {
    lines,
    ledger: toLedger(lines, annualTaxDelta, ctx),
    forgone,
    annualCash: cash,
    annualTaxableDelta: taxableDelta,
    annualTaxDelta,
    annualNet,
    monthlyNet: round2(annualNet / 12),
    oneTimeTotal,
    threeYearNet: round2(recurringAnnual * 3 + oneTimeTotal),
    forgoneCash: fg.cash,
    forgoneTaxDelta,
    forgoneAnnual: round2(fg.cash + forgoneTaxDelta),
    chargerInstallOneTime: chargerInstall(ctx),
    missingDataHe: missingData(ctx),
  }
}
