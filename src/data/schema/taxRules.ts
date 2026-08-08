import { z } from 'zod'

/**
 * Statutory rates for one tax year.
 *
 * The bracket shape carries the real constraint: only the last bracket may have
 * a null ceiling, and the ceilings must ascend. A bracket table that is out of
 * order does not throw — bracketTax walks it in array order — it just returns a
 * plausible wrong number, which is the worst kind.
 *
 * The national-insurance ceiling is expressed as a final zero-rate bracket
 * rather than a max(), so the same walk handles it.
 */

const BracketSchema = z.strictObject({
  upTo: z.number().positive().nullable(),
  rate: z.number().min(0).max(1),
})

const BracketTableSchema = z.array(BracketSchema).nonempty()
  .refine(
    bs => bs.every((b, i) => (b.upTo === null) === (i === bs.length - 1)),
    { message: 'only the last bracket may be open-ended, and it must be' },
  )
  .refine(
    bs => bs.every((b, i) => {
      const prev = bs[i - 1]
      return i === 0 || prev === undefined || prev.upTo === null || b.upTo === null
        || b.upTo > prev.upTo
    }),
    { message: 'bracket ceilings must ascend' },
  )

export const TaxRulesSchema = z.strictObject({
  year: z.number().int(),
  effectiveFrom: z.string(),
  sourceUrl: z.string(),

  usageValue: z.strictObject({
    linearRate: z.number().positive(),
    listPriceCeiling: z.number().positive(),
    /**
     * Mild hybrid is 0 on purpose: the client's price list marks it as not
     * recognised as a hybrid for benefit attribution. Data, not a code branch.
     */
    monthlyDeduction: z.strictObject({
      ice: z.number().nonnegative(),
      mhev: z.number().nonnegative(),
      hybrid: z.number().nonnegative(),
      phev: z.number().nonnegative(),
      bev: z.number().nonnegative(),
    }),
    verified: z.boolean(),
  }),

  incomeTaxMonthlyBrackets: BracketTableSchema,
  bracketsVerified: z.boolean(),
  bracketsNote: z.string().optional(),
  creditPointValueMonthly: z.number().positive(),

  nationalInsuranceMonthlyBrackets: BracketTableSchema,
  healthInsuranceMonthlyBrackets: BracketTableSchema,
  socialInsuranceVerified: z.boolean(),
  socialInsuranceNote: z.string().optional(),
})

export type TaxRulesData = z.infer<typeof TaxRulesSchema>
