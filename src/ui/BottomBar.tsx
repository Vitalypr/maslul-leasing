import type { ReactNode } from 'react'
import { Money } from './Money'

/**
 * The monthly figure, pinned to the bottom of a phone screen.
 *
 * On a wide screen the cost sheet sits beside the ledger and both are in view
 * at once. On a phone they stack, so by the time the reader reaches the line
 * that explains the cost, the cost itself has scrolled off. The bar is that one
 * number following them down the page; the stylesheet hides it from 768px up,
 * where there is nothing for it to solve.
 *
 * The spacer is part of the component rather than a global rule, because only a
 * screen that renders the bar has to reserve room for it.
 */
export type BottomBarProps = {
  labelHe: string
  /** Monthly shekels, as the engine produced them. */
  value: number
  /** An action alongside the figure. The bar is the one thing always in view
   *  on a long page, so it is where an action belongs. */
  action?: ReactNode
}

export function BottomBar({ labelHe, value, action }: BottomBarProps) {
  return (
    <>
      <div className="bottombar-space" aria-hidden="true" />
      <div className="bottombar">
        <span className="lbl">{labelHe}</span>
        <Money value={value} className="amt" />
        {action === undefined ? null : <span className="bottombar-action">{action}</span>}
      </div>
    </>
  )
}
