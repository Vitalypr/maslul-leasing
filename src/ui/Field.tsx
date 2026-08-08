import type { ReactNode } from 'react'

/**
 * A labelled control. One label, bound by id, and nothing else — no helper
 * sentence restating the label, no example the field already implies.
 *
 * `unverified` is the single exception, and it is not prose: it marks a value
 * whose source carries `verified: false`, so the reader knows the number in
 * front of them has not been confirmed against the organisation.
 */
export type FieldProps = {
  label: string
  /** id of the control this labels. */
  htmlFor: string
  unverified?: boolean
  /** A ceiling or a worked example, shown under the control. */
  helpHe?: string | undefined
  children: ReactNode
}

export function Field({
  label, htmlFor, unverified = false, helpHe, children,
}: FieldProps) {
  const helpId = helpHe === undefined ? undefined : `${htmlFor}-help`
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {unverified ? <span className="field-unverified">לא אומת</span> : null}
      </label>
      {children}
      {/* A ceiling or a worked example. It sits under the control and is tied
          to it for screen readers, so it reads as guidance rather than as part
          of the label. */}
      {helpHe === undefined
        ? null
        : <p id={helpId} className="field-help">{helpHe}</p>}
    </div>
  )
}
