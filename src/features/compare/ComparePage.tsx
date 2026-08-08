import { useState } from 'react'
import { round2 } from '../../engine/round'
import type { CalcResult, Vehicle } from '../../engine/calculate'
import { Money } from '../../ui/Money'
import { Sheet } from '../../ui/Sheet'

/**
 * Four cars side by side.
 *
 * The bar is the part worth explaining. A plain zero-baseline bar was built
 * first and thrown away: every option in this fleet lands between roughly 78%
 * and 100% of the dearest one, so four bars of nearly equal length said
 * nothing that the numbers beside them did not already say, and said it less
 * precisely.
 *
 * What replaced it splits each bar in two. The pale segment is the floor — the
 * cost the cheapest car in the set already carries, and therefore the cost of
 * having a car at all rather than of having *this* car. The solid segment is
 * what this car adds on top of that floor. The pale segment is identical in
 * every row by construction, so the eye has nothing to compare there and goes
 * straight to the solid part, which is the only thing the choice controls.
 *
 * The axis stays the dearest car's total, so the bars remain true to scale: the
 * solid segments are small because the differences really are small next to the
 * shared floor, and inflating them to fill the axis would be a lie about how
 * much this decision is worth.
 */

/** Four fits the axis and the table. A fifth column has nowhere to go. */
export const MAX_COMPARED = 4

export type Horizon = 'month' | 'year' | 'contract'

export type CompareEntry = {
  vehicle: Vehicle
  result: CalcResult
}

export type Bar = {
  /** Width of the pale segment, as a percentage of the axis. */
  sharedPct: number
  /** Width of the solid segment, as a percentage of the axis. */
  deltaPct: number
  /** The excess over the cheapest car, in annual shekels. */
  delta: number
}

/** The engine works in years; the screen offers three horizons. */
export function horizonFactor(horizon: Horizon): number {
  switch (horizon) {
    case 'month': return 1 / 12
    case 'year': return 1
    case 'contract': return 3
  }
}

const HORIZONS: readonly { id: Horizon; labelHe: string; totalHe: string }[] = [
  { id: 'month', labelHe: 'חודש', totalHe: 'סה"כ לחודש' },
  { id: 'year', labelHe: 'שנה', totalHe: 'סה"כ לשנה' },
  { id: 'contract', labelHe: '3 שנים', totalHe: 'סה"כ ל־3 שנים' },
]

export function compareBars(values: readonly number[]): Bar[] {
  if (values.length === 0) return []
  const axis = Math.max(...values)
  const floor = Math.min(...values)
  if (axis <= 0) return values.map(() => ({ sharedPct: 0, deltaPct: 0, delta: 0 }))

  // A car that pays out more than it costs would put the floor below zero and
  // the bar behind the axis. Clamping keeps the drawing honest: no bar rather
  // than a bar pointing the wrong way.
  const shared = Math.max(0, floor)
  const sharedPct = round2((shared / axis) * 100)

  return values.map(v => ({
    sharedPct,
    deltaPct: round2(Math.max(0, (v - shared) / axis) * 100),
    delta: round2(Math.max(0, v - floor)),
  }))
}

export type CompareRow = {
  id: string
  labelHe: string
  /** Annual shekels, one per compared car. */
  values: number[]
  /** Index of the lowest value, or null when the row is flat. */
  cheapest: number | null
  /** Paid once over the contract rather than once a year. */
  oneTime: boolean
}

/**
 * What to multiply a row by for the horizon on screen.
 *
 * A one-time event — a deposit, a return charge — is paid once over the whole
 * contract, so the three-year column shows it as itself and not as three of
 * it. calculate() draws the same distinction in threeYearNet; without this the
 * body would stop adding up to the footer the moment the client supplies the
 * first one-time figure.
 */
export function rowFactor(horizon: Horizon, oneTime: boolean): number {
  return horizon === 'contract' && oneTime ? 1 : horizonFactor(horizon)
}

/**
 * One row per cost component, and the column adds up.
 *
 * Usage value is left out of the body on purpose. It is an imputation, not
 * cash — no money moves — and a column containing it would not reconcile with
 * its own total. What it actually costs appears as the tax row underneath,
 * priced once across all the lines at the employee's real marginal rate. The
 * imputed figure itself is shown in the column header, where it is reference
 * rather than arithmetic.
 */
export function compareRows(results: readonly CalcResult[]): CompareRow[] {
  const order: string[] = []
  const labels = new Map<string, string>()
  const oneTimeIds = new Set<string>()
  for (const r of results) {
    for (const l of r.lines) {
      if (l.treatment === 'taxableBenefit') continue
      if (l.category === 'oneTime') oneTimeIds.add(l.id)
      if (labels.has(l.id)) continue
      labels.set(l.id, l.labelHe)
      order.push(l.id)
    }
  }

  const rows: CompareRow[] = order.map(id => {
    // A car without a component is a zero in that row, not a missing row: the
    // absence is the comparison.
    const values = results.map(
      r => r.lines.find(l => l.id === id)?.annualAmount ?? 0,
    )
    return {
      id,
      labelHe: labels.get(id) ?? id,
      values,
      cheapest: cheapestIndex(values),
      oneTime: oneTimeIds.has(id),
    }
  })

  const taxValues = results.map(r => r.annualTaxDelta)
  rows.push({
    id: 'taxDelta',
    labelHe: 'מס על הזקיפה',
    values: taxValues,
    cheapest: cheapestIndex(taxValues),
    oneTime: false,
  })
  return rows
}

function cheapestIndex(values: readonly number[]): number | null {
  if (values.length < 2) return null
  const min = Math.min(...values)
  if (round2(min) === round2(Math.max(...values))) return null
  return values.indexOf(min)
}

const totalFor = (result: CalcResult, horizon: Horizon): number => {
  switch (horizon) {
    case 'month': return result.monthlyNet
    // Not annualNet x 3: a one-time event is paid once over the contract.
    case 'contract': return result.threeYearNet
    case 'year': return result.annualNet
  }
}

/** The monthly imputation, taken from the line the engine already produced. */
const usageValueMonthlyOf = (result: CalcResult): number => {
  const line = result.lines.find(l => l.treatment === 'taxableBenefit')
  return line === undefined ? 0 : line.annualAmount / 12
}

export type ComparePageProps = {
  entries: readonly CompareEntry[]
  onRemove?: (vehicleId: string) => void
}

export function ComparePage({ entries, onRemove }: ComparePageProps) {
  const [horizon, setHorizon] = useState<Horizon>('month')

  const shown = entries.slice(0, MAX_COMPARED)
  if (shown.length === 0) {
    return (
      <Sheet>
        <p className="text-[15px] text-[var(--ink-soft)]">
          בחר עד ארבעה רכבים בקטלוג.
        </p>
      </Sheet>
    )
  }

  const totals = shown.map(e => totalFor(e.result, horizon))
  const bars = compareBars(totals)
  const rows = compareRows(shown.map(e => e.result))
  const cheapestTotal = cheapestIndex(totals)
  const horizonMeta = HORIZONS.find(h => h.id === horizon) ?? HORIZONS[0]

  return (
    <>
      <Sheet>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <p className="eyebrow mb-0">השוואה</p>
          <div className="flex gap-1" role="group" aria-label="טווח הזמן המוצג">
            {HORIZONS.map(h => (
              <button
                key={h.id}
                type="button"
                aria-pressed={h.id === horizon}
                onClick={() => { setHorizon(h.id) }}
                className={
                  h.id === horizon
                    ? 'min-h-[44px] rounded-[6px] border border-[var(--ink)] bg-[var(--ink)] px-4 text-[13px] font-bold text-[var(--on-accent)]'
                    : 'min-h-[44px] rounded-[6px] border border-[var(--line)] px-4 text-[13px] text-[var(--ink-soft)]'
                }
              >
                {h.labelHe}
              </button>
            ))}
          </div>
        </div>

        <ul className="m-0 grid list-none gap-5 p-0">
          {shown.map((e, i) => {
            const bar = bars[i]
            const total = totals[i] ?? 0
            return (
              <li key={e.vehicle.id}>
                <div className="flex items-baseline gap-3">
                  <span className="flex-1 text-[14.5px]">{e.vehicle.nameHe}</span>
                  <Money value={total} className="amt" />
                </div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-[3px] border border-[var(--line)]">
                  <span
                    className="cmp-shared block h-full bg-[var(--surface-sunk)]"
                    style={{ width: `${bar?.sharedPct ?? 0}%` }}
                  />
                  <span
                    className="cmp-delta block h-full bg-[var(--ink)]"
                    style={{ width: `${bar?.deltaPct ?? 0}%` }}
                  />
                </div>
                {/* The legend below already names what the solid segment is;
                    the row only has to say how much of it there is. */}
                {bar !== undefined && bar.delta > 0 ? (
                  <p className="mt-1.5 mb-0 text-[12.5px] text-[var(--ink-soft)]">
                    <Money value={bar.delta} sign="always" />
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>

        <p className="mt-6 mb-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--ink-faint)]">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-6 rounded-[2px] border border-[var(--line)] bg-[var(--surface-sunk)]"
            />
            עלות שכל הרכבים ברשימה נושאים
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-6 rounded-[2px] bg-[var(--ink)]"
            />
            ההפרש מעל הזול ביותר
          </span>
        </p>
      </Sheet>

      <Sheet>
        {/* Four columns will not fit a phone. The table scrolls inside this
            box rather than making the page pan. */}
        <div className="scroll-x">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <td className="w-[34%] min-w-[9rem] border-b border-[var(--line)] py-3" />
                {shown.map(e => (
                  <th
                    key={e.vehicle.id}
                    scope="col"
                    className="border-b border-[var(--line)] px-2 py-3 text-start align-bottom font-normal"
                  >
                    <span className="block text-[14.5px] font-bold">{e.vehicle.nameHe}</span>
                    <span className="mt-1 block text-[12px] text-[var(--ink-faint)]">
                      מחירון <Money value={e.vehicle.listPrice} />
                    </span>
                    <span className="block text-[12px] text-[var(--ink-faint)]">
                      זקיפה חודשית <Money value={usageValueMonthlyOf(e.result)} />
                    </span>
                    {onRemove !== undefined ? (
                      <button
                        type="button"
                        className="mt-2 min-h-[44px] rounded-[6px] border border-[var(--line)] px-3 text-[12px] text-[var(--ink-soft)]"
                        onClick={() => { onRemove(e.vehicle.id) }}
                      >
                        הסר
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="border-b border-[var(--line)] py-2.5 text-start text-[14px] font-normal text-[var(--ink-soft)]"
                  >
                    {row.labelHe}
                  </th>
                  {row.values.map((value, i) => (
                    <td
                      key={shown[i]?.vehicle.id ?? i}
                      className={cellClass(row.cheapest === i)}
                    >
                      <Money
                        value={value * rowFactor(horizon, row.oneTime)}
                        className={value < 0 ? 'amt neg' : 'amt'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="border-t-2 border-[var(--ink)] py-3 text-start text-[15px] font-bold"
                >
                  {horizonMeta?.totalHe ?? ''}
                </th>
                {totals.map((total, i) => (
                  <td
                    key={shown[i]?.vehicle.id ?? i}
                    className={
                      cheapestTotal === i
                        ? 'border-t-2 border-[var(--ink)] bg-[var(--petrol-wash)] px-2 py-3 text-start'
                        : 'border-t-2 border-[var(--ink)] px-2 py-3 text-start'
                    }
                  >
                    <Money value={total} className="amt text-[18px]" />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Sheet>
    </>
  )
}

const cellClass = (best: boolean): string =>
  best
    ? 'border-b border-[var(--line)] bg-[var(--petrol-wash)] px-2 py-2.5 text-start font-bold'
    : 'border-b border-[var(--line)] px-2 py-2.5 text-start'
