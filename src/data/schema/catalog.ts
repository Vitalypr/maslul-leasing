import { z } from 'zod'

/**
 * The catalogue is the client's price list, transcribed. The schema's job is to
 * catch transcription damage — a renamed key, a price that became a string, a
 * powertrain spelled two ways — not to re-derive anything in it.
 *
 * Objects are strict. A key the schema does not know about is far more likely
 * to be a typo that silently reads as `undefined` than a deliberate addition,
 * and a silent `undefined` in this file becomes a wrong number on screen.
 */

export const PowertrainSchema = z.enum(['ice', 'mhev', 'hybrid', 'phev', 'bev'])

export const ConsumptionSchema = z.strictObject({
  /** Petrol economy. Absent on a car that never burns petrol. */
  kmPerLiter: z.number().positive().optional(),
  /**
   * A plug-in's economy once the battery is flat. This, not a combined-cycle
   * figure, is what applies to its petrol kilometres — a combined number
   * already assumes electric driving and would count the battery twice.
   */
  kmPerLiterHybridMode: z.number().positive().optional(),
  kwhPer100km: z.number().positive().optional(),
  /** Manufacturer's electric range. The engine discounts it by a policy factor. */
  evRangeKm: z.number().positive().optional(),
  fuel: z.enum(['petrol95', 'diesel']).optional(),
  /**
   * 'estimate' means the figure was supplied so the engine could run and has no
   * importer behind it. Every row reads 'estimate' today; the UI must mark any
   * cost derived from one.
   */
  source: z.enum(['estimate', 'importer', 'manufacturer']),
  /** Where the figure came from, in Hebrew, for the trace. */
  sourceNote: z.string().optional(),
})

export const VehicleSchema = z.strictObject({
  id: z.string().min(1),
  nameHe: z.string().min(1),
  /** Empty on one row: the source table omits the manufacturer. */
  make: z.string(),
  modelFamily: z.string(),
  trim: z.string(),
  powertrain: PowertrainSchema,
  bodyStyle: z.enum(['hatch', 'suv', 'sedan', 'mpv']),
  listPrice: z.number().positive(),
  /** True only where the price list actually quotes a rambi cost. */
  rambiEligible: z.boolean().optional(),
  /** Where the photograph does not exactly depict this trim. Shown on screen. */
  imageNoteHe: z.string().optional(),
  /** The model's page on icar.co.il, linked from the vehicle screen. */
  icarUrl: z.string().url().optional(),
  /** Measured in road tests; beats the manufacturer claim in the engine. */
  realEvRangeKm: z.number().positive().nullable().optional(),
  supplementRate: z.number().positive(),
  /** As printed in the source table. test/data/schema.test.ts checks the formula against it. */
  supplementTierC: z.number().nonnegative(),
  supplementTierD: z.number().nonnegative(),
  consumption: ConsumptionSchema,

  seats: z.number().int().positive().optional(),
  /** Published rambi prices, where the source table printed them. */
  rambiTierC: z.number().nonnegative().optional(),
  rambiTierD: z.number().nonnegative().optional(),
  /** A mild hybrid the price list flags as not a hybrid for tax or fuel quota. */
  treatAsIce: z.boolean().optional(),

  badgeHe: z.string().optional(),
  noteHe: z.string().optional(),
  colorsNote: z.string().optional(),
  warningHe: z.string().optional(),
  /** An unresolved question about the row, to put to the client. */
  dataQueryHe: z.string().optional(),
})

export const CatalogSchema = z.strictObject({
  $schema: z.string().optional(),
  version: z.string(),
  source: z.string(),
  currency: z.literal('ILS'),
  vatIncluded: z.boolean(),
  vatRate: z.number().nonnegative(),
  notes: z.strictObject({
    supplement: z.string(),
    consumption: z.string(),
    images: z.string(),
  }),
  vehicles: z.array(VehicleSchema).nonempty(),
})

export type CatalogVehicle = z.infer<typeof VehicleSchema>
export type Catalog = z.infer<typeof CatalogSchema>
