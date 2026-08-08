import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Field } from '../../ui/Field'

/**
 * The passcode in front of the settings screen.
 *
 * It is a latch, not a lock, and the screen says so in as many words. This app
 * is static: the policy file is inside the JavaScript the browser already
 * downloaded, and anyone who opens the developer tools can read every figure in
 * it — including this passcode. What the latch buys is that nobody changes an
 * organisational figure by wandering into the wrong screen.
 *
 * That is an acceptable trade only because the policy holds no personal data.
 * The employee's salary and commute never come near it; they stay in
 * localStorage under the profile, and the calculation runs on the device.
 */

/** Versioned, so a change to the token cannot leave an old session open. */
export const ADMIN_SESSION_KEY = 'maslul.admin.v1'

/** The only value the gate treats as open. */
export const ADMIN_SESSION_OPEN = 'open'

export function checkPasscode(entered: string, expected: string): boolean {
  const trimmed = entered.trim()
  // An empty entry never opens the gate, even against an empty passcode —
  // otherwise clearing the field in the policy file would remove the latch
  // without anyone noticing.
  return trimmed !== '' && trimmed === expected.trim()
}

export function isUnlocked(stored: string | null): boolean {
  return stored === ADMIN_SESSION_OPEN
}

export type AdminGateProps = {
  /** policy.adminPasscode. Read from the policy, never written in code. */
  passcode: string
  children: ReactNode
}

export function AdminGate({ passcode, children }: AdminGateProps) {
  const [open, setOpen] = useState<boolean>(() => isUnlocked(readSession()))
  const [entered, setEntered] = useState('')
  const [refused, setRefused] = useState(false)

  useEffect(() => { if (open) writeSession() }, [open])

  const submit = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    if (checkPasscode(entered, passcode)) {
      setRefused(false)
      setOpen(true)
      return
    }
    setRefused(true)
  }, [entered, passcode])

  if (open) return <>{children}</>

  return (
    <Sheet title="הגדרות מנהל">
      <form onSubmit={submit} className="max-w-[22rem]">
        <Field label="קוד כניסה" htmlFor="admin-passcode">
          <input
            id="admin-passcode"
            className="field-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={entered}
            onChange={e => { setEntered(e.target.value); setRefused(false) }}
          />
        </Field>

        {refused ? (
          <p role="alert" className="mt-0 mb-4 text-[13px] text-[var(--clay)]">
            הקוד שגוי. הוא נמצא בקובץ המדיניות, בשדה adminPasscode.
          </p>
        ) : null}

        <button
          type="submit"
          className="min-h-[44px] rounded-[6px] border border-[var(--ink)] bg-[var(--ink)] px-5 text-[14px] font-bold text-[var(--on-accent)]"
        >
          כניסה
        </button>
      </form>

      <p className="mt-6 mb-0 max-w-[42rem] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
        הקוד הזה אינו אבטחה. האפליקציה סטטית, וכל מי שפותח את כלי הפיתוח קורא
        את קובץ המדיניות ואת הקוד הזה שבתוכו. תפקידו למנוע שינוי מקרי בנתוני
        הארגון. אין במדיניות נתונים אישיים.
      </p>
    </Sheet>
  )
}

/* Storage can throw — Safari in private mode does, and there is no window at
   all when this renders on a server. A gate that cannot read its session is a
   closed gate, which is the safe direction. */
function readSession(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY)
  } catch {
    return null
  }
}

function writeSession(): void {
  try {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, ADMIN_SESSION_OPEN)
  } catch {
    /* the screen stays open for this render; it just will not survive a reload */
  }
}
