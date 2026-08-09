/**
 * The navigation glyphs, drawn inline.
 *
 * Inline rather than an icon font or a package: six shapes do not justify a
 * dependency, and a font would arrive after first paint and shift the bar.
 * Every glyph is stroked on the same 24-grid at the same weight so they read
 * as one set rather than six borrowed pictures.
 */

export type IconProps = {
  /** Matches the text it sits beside; 20 in the bar, 22 in the drawer. */
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

/** The fleet: a car, because the screen is a list of cars. */
export function IconFleet({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 13.5 4.6 8.9A2.4 2.4 0 0 1 6.9 7.3h10.2a2.4 2.4 0 0 1 2.3 1.6L21 13.5" />
      <path d="M3 13.5h18v4.1a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.9H6.6v.9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <circle cx="7" cy="16" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17" cy="16" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Comparison: bars of different length — the screen's own chart, shrunk. */
export function IconCompare({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 6.5h16" />
      <path d="M4 12h11" />
      <path d="M4 17.5h6.5" />
    </svg>
  )
}

/** The profile: one person, because the figures belong to one reader. */
export function IconProfile({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 19.6a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  )
}

/** Settings: a gear, the one glyph nobody has to learn. */
export function IconSettings({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.5a1.5 1.5 0 0 0 .3 1.6l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5h-.2a1.8 1.8 0 0 1 0-3.6h.1a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.6.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.5 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.5h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9z" />
    </svg>
  )
}

export function IconMenu({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />
    </svg>
  )
}

export function IconClose({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 6l12 12" /><path d="M18 6L6 18" />
    </svg>
  )
}

/** Light and dark in one mark: a disc half filled. */
export function IconTheme({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" stroke="none" />
    </svg>
  )
}
