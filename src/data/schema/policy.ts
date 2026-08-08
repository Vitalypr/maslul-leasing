import { z } from 'zod'

/**
 * The organisation's policy. This is the file an administrator edits, so the
 * schema is the only thing standing between a typo and a wrong figure on an
 * employee's screen.
 *
 * Two rules it enforces that matter more than the rest:
 *
 * 1. Every tax treatment must be one of the four known values. A treatment of
 *    "Net" or "grossed-up" would otherwise fall through splitByTreatment's
 *    switch, contribute nothing, and quietly understate the cost.
 * 2. `verified` flags are required, not optional. An unverified number that
 *    forgets to say so is an unverified number the UI presents as fact.
 */

export const TaxTreatmentSchema = z.enum([
  'net', 'gross', 'taxableBenefit', 'grossedUp',
])

/**
 * A forgone benefit as policy describes it.
 *
 * Policy states the ceiling and a figure to suggest, never the value. Two of
 * these differ per person by definition — the licence fee follows the car the
 * employee actually owns and the insurance follows the quote they actually
 * paid — so the amount belongs to the profile, not here.
 */
const ForgoneItemSchema = z.strictObject({
  enabled: z.boolean(),
  employeeEnters: z.boolean(),
  /** Ceiling on the yearly figure, or null where the component has none. */
  annualCap: z.number().nonnegative().nullable().optional(),
  /** Ceiling on the monthly figure, or null where the component has none. */
  monthlyCap: z.number().nonnegative().nullable().optional(),
  /** Shown as a hint beside the field. Never used as a value. */
  suggested: z.number().nonnegative().nullable().optional(),
  verified: z.boolean(),
  labelHe: z.string().min(1),
  helpHe: z.string().optional(),
  note: z.string().optional(),
})

export const PolicySchema = z.strictObject({
  version: z.string(),
  /**
   * Not a security control. In a static app anyone can read this file from dev
   * tools; it is a barrier against casual tampering and must never be presented
   * as protection. See docs/ASSUMPTIONS.md section ו.
   */
  adminPasscode: z.string(),

  supplement: z.strictObject({
    budgetByTier: z.strictObject({ C: z.number().positive(), D: z.number().positive() }),
    defaultRate: z.number().positive(),
    highRate: z.number().positive(),
    /**
     * null while what triggers the higher rate is unresolved; the per-vehicle
     * rate in the catalogue wins until a price band is decided.
     */
    highRateThreshold: z.number().positive().nullable(),
    rambiDiscount: z.number().min(0).max(1),
    /** Which vehicles the discount reaches. */
    rambiScope: z.enum(['markedVehiclesOnly', 'wholeFleet']).optional(),
    verified: z.boolean(),
    note: z.string().optional(),
  }),

  gradesToTier: z.strictObject({
    verified: z.boolean(),
    map: z.record(z.string(), z.enum(['C', 'D'])),
  }),

  mileage: z.strictObject({
    annualQuotaKm: z.number().positive(),
    excessRatePerKm: z.number().nonnegative(),
    creditForUnusedKm: z.boolean(),
    verified: z.boolean(),
  }),

  contract: z.strictObject({
    termMonths: z.number().int().positive(),
    verified: z.boolean(),
  }),

  fuel: z.strictObject({
    employeeEntersBudget: z.boolean(),
    defaultMonthlyBudgetIce: z.number().nonnegative(),
    defaultMonthlyBudgetElectrified: z.number().nonnegative(),
    unusedCreditEnabled: z.boolean(),
    unusedCreditCappedAtSupplement: z.boolean(),
    verified: z.boolean(),
  }),

  phev: z.strictObject({
    /** Share of the manufacturer's electric range that survives real driving. */
    realWorldRangeFactor: z.number().positive().max(1),
    verified: z.boolean(),
  }),

  /**
   * A wallbox for a plug-in, paid once by the employee. Held apart from every
   * other cost because it must never reach a per-month figure: it is a single
   * outlay on the employee's own property that outlives the lease.
   */
  chargerInstall: z.strictObject({
    appliesTo: z.array(z.string()),
    employeeEnters: z.boolean(),
    suggested: z.number().nonnegative().nullable().optional(),
    excludedFromTotals: z.literal(true),
    verified: z.boolean(),
    labelHe: z.string().min(1),
    helpHe: z.string().optional(),
  }),

  forgone: z.strictObject({
    licenseFeeAnnual: ForgoneItemSchema,
    privateInsuranceAnnual: ForgoneItemSchema,
    serviceVehicleTierC: ForgoneItemSchema,
    fixedNetAllowance: ForgoneItemSchema,
    variableNetAllowance: ForgoneItemSchema,
  }),

  taxTreatment: z.strictObject({
    upgradeSupplement: TaxTreatmentSchema,
    excessKm: TaxTreatmentSchema,
    fuelOverage: TaxTreatmentSchema,
    unusedFuelCredit: TaxTreatmentSchema,
    homeChargingRefund: TaxTreatmentSchema,
    usageValue: TaxTreatmentSchema,
    oneTime: TaxTreatmentSchema,
    forgoneLicenseFee: TaxTreatmentSchema,
    forgoneInsurance: TaxTreatmentSchema,
    forgoneServiceVehicleTierC: TaxTreatmentSchema,
    forgoneFixedNet: TaxTreatmentSchema,
    forgoneVariableNet: TaxTreatmentSchema,
    verified: z.record(z.string(), z.boolean()),
    sourceRef: z.string().min(1),
  }),
})

export type PolicyData = z.infer<typeof PolicySchema>
