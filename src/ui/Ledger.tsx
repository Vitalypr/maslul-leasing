import { useState } from 'react'
import type { MoneyLine } from '../engine/types'
import { Money } from './Money'

/**
 * The ledger with its spine — the signature layout of the prototype.
 *
 * The spine is a bar per line, scaled to the largest figure in the set, so the
 * shape of the cost is visible before a single number is read. Opening a line
 * shows the trace the engine produced for it: the formula and where it came
 * from. Nothing here computes money. Amounts arrive annual, as the engine
 * produces them, and `factor` converts the display to a month or a contract —
 * one multiplication, applied identically to the lines and to the total, so
 * they cannot disagree.
 */
export type LedgerProps = {
  lines: MoneyLine[]
  /** 1 for a year, 1/12 for a month, 3 for the contract. */
  factor?: number
  /** The closing figure, annual. Given rather than summed: the tax effect is
   *  priced once by calculate(), across every line at once, and re-adding the
   *  lines here would double it. */
  totalAnnual: number
  totalLabelHe: string
  onExpand?: (id: string | null) => void
}

export function Ledger({
  lines, factor = 1, totalAnnual, totalLabelHe, onExpand,
}: LedgerProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (lines.length === 0) return null

  const tallest = Math.max(1, ...lines.map(l => Math.abs(l.annualAmount)))

  const toggle = (id: string) => {
    const next = openId === id ? null : id
    setOpenId(next)
    onExpand?.(next)
  }

  return (
    <>
      <div className="ledger">
        <div className="spine" aria-hidden="true">
          {lines.map(l => {
            const marks = [
              l.annualAmount < 0 ? 'neg' : '',
              openId !== null && openId !== l.id ? 'dim' : '',
            ].filter(Boolean).join(' ')
            return (
              <i
                key={l.id}
                {...(marks ? { className: marks } : {})}
                style={{ height: `${6 + (Math.abs(l.annualAmount) / tallest) * 46}px` }}
              />
            )
          })}
        </div>

        <div className="lines">
          {lines.map(l => {
            const open = openId === l.id
            return (
              <div key={l.id} className={open ? 'line open' : 'line'}>
                <button
                  type="button"
                  className="line-btn"
                  aria-expanded={open}
                  onClick={() => toggle(l.id)}
                >
                  <span className="caret" aria-hidden="true">▾</span>
                  <span className="lbl">{l.labelHe}</span>
                  <Money
                    value={l.annualAmount * factor}
                    className={l.annualAmount < 0 ? 'amt neg' : 'amt'}
                  />
                </button>
                {open ? (
                  <div className="trace">
                    <code>{l.trace.formulaHe}</code>
                    <p className="trace-src" dir="ltr">{l.trace.sourceRef}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="sumline">
        <span className="lbl">{totalLabelHe}</span>
        <Money value={totalAnnual * factor} className="amt" />
      </div>
    </>
  )
}
