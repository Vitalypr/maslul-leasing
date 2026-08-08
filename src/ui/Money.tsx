/**
 * Every currency figure in the app goes through here.
 *
 * The reason is `dir="ltr"`. In an RTL document a bare "−₪1,178" has its
 * leading minus reordered to the far side of the number by the bidi
 * algorithm, which turns a credit into something that reads like a debit.
 * Isolating the figure in an LTR span is the fix, and putting it in one
 * component is what stops the next screen from forgetting it.
 *
 * The engine keeps two decimals (round2). Display is whole shekels.
 */

export type MoneySign = 'auto' | 'always'

/** U+2212 MINUS SIGN — a hyphen is too short next to tabular figures. */
const MINUS = '−'

const group = (whole: number): string =>
  String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * `sign: 'always'` marks a difference, as in the comparison screen: +₪120.
 * Zero never takes a sign, including a figure that only rounds to zero —
 * "−₪0" states a direction the number does not have.
 */
export function formatIls(value: number, sign: MoneySign = 'auto'): string {
  const whole = Math.round(Math.abs(value))
  const lead = whole === 0 ? '' : value < 0 ? MINUS : sign === 'always' ? '+' : ''
  return `${lead}₪${group(whole)}`
}

export type MoneyProps = {
  /** Shekels, at whatever precision the engine produced. */
  value: number
  sign?: MoneySign
  className?: string
}

export function Money({ value, sign = 'auto', className }: MoneyProps) {
  return (
    <span className={className ? `money num ${className}` : 'money num'} dir="ltr">
      {formatIls(value, sign)}
    </span>
  )
}
