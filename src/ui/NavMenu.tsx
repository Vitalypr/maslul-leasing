import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconClose, IconMenu } from './Icons'

/**
 * Navigation, as a bar on a wide screen and a drawer on a phone.
 *
 * The bar came first and broke on a phone: four Hebrew labels with no room
 * between them ran together into one unreadable string. Rather than shrink the
 * type until it fit, the labels move into a drawer below the tablet breakpoint
 * and each one gains an icon, so a glance is enough at either size.
 */

export type NavItem = {
  id: string
  labelHe: string
  icon: ReactNode
  /** Shown after the label, e.g. how many cars are being compared. */
  badge?: string
}

export type NavMenuProps = {
  items: readonly NavItem[]
  activeId: string
  onSelect: (id: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NavMenu({ items, activeId, onSelect, open, onOpenChange }: NavMenuProps) {
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Escape closes, and focus goes back to the button that opened it — without
  // that, a keyboard user is dropped at the top of the document.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onOpenChange(false); trigger.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('button')?.focus()
    return () => { document.removeEventListener('keydown', onKey) }
  }, [open, onOpenChange])

  // A drawer over a scrolled page that still scrolls behind it reads as broken.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* Wide screens: the items sit in the bar, icon and label together. */}
      <nav className="navbar" role="tablist" aria-label="מסכים">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="navbar-item"
            aria-selected={item.id === activeId}
            onClick={() => { onSelect(item.id) }}
          >
            {item.icon}
            <span>{item.labelHe}</span>
            {item.badge === undefined ? null : <b className="nav-badge">{item.badge}</b>}
          </button>
        ))}
      </nav>

      {/* Phones: one button, and the labels move into the drawer. */}
      <button
        ref={trigger}
        type="button"
        className="icon-btn navmenu-trigger"
        aria-label="תפריט"
        aria-expanded={open}
        aria-controls="nav-drawer"
        onClick={() => { onOpenChange(!open) }}
      >
        <IconMenu />
      </button>

      {open && (
        <div className="nav-scrim" onClick={() => { onOpenChange(false) }} />
      )}

      <div
        id="nav-drawer"
        ref={panel}
        className={`nav-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט"
        // Hidden from the tab order when shut, so a phone user does not tab
        // into a panel they cannot see. React types `inert` as a boolean.
        inert={!open}
      >
        <div className="nav-drawer-head">
          <span className="brand">מס<span>לול</span></span>
          <button
            type="button"
            className="icon-btn"
            aria-label="סגירת התפריט"
            onClick={() => { onOpenChange(false); trigger.current?.focus() }}
          >
            <IconClose />
          </button>
        </div>

        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className="nav-drawer-item"
            aria-current={item.id === activeId}
            onClick={() => { onSelect(item.id); onOpenChange(false) }}
          >
            {item.icon}
            <span>{item.labelHe}</span>
            {item.badge === undefined ? null : <b className="nav-badge">{item.badge}</b>}
          </button>
        ))}
      </div>
    </>
  )
}
