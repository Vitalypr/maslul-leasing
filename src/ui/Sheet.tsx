import type { ReactNode } from 'react'

/**
 * A surface. One hairline, one tone above the paper, no shadow.
 *
 * Both headings are optional because a sheet is often placed under a heading
 * that already names it, and repeating that name is noise.
 */
export type SheetProps = {
  /** Small caps line above the title, e.g. the horizon a figure belongs to. */
  eyebrow?: string
  title?: string
  className?: string
  children: ReactNode
}

export function Sheet({ eyebrow, title, className, children }: SheetProps) {
  return (
    <section className={className ? `sheet ${className}` : 'sheet'}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="sheet-title">{title}</h2> : null}
      {children}
    </section>
  )
}
