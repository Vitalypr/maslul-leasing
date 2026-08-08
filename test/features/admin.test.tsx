import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AdminGate, ADMIN_SESSION_KEY, ADMIN_SESSION_OPEN, checkPasscode, isUnlocked,
} from '../../src/features/admin/AdminGate'
import {
  AdminPanel, TREATMENT_KEYS, TREATMENT_OPTIONS,
  isTreatmentVerified, treatmentLabelHe,
} from '../../src/features/admin/AdminPanel'
import {
  BUNDLED_SETTINGS, type SettingsStore,
} from '../../src/state/policyOverride'

/** React escapes an apostrophe and a double quote; the copy carries both. */
const esc = (s: string) => s.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

const memoryWindow = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed))
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  }
  return { sessionStorage: store, localStorage: store }
}

afterEach(() => { vi.unstubAllGlobals() })

const store: SettingsStore = {
  settings: BUNDLED_SETTINGS,
  overridden: false,
  errorHe: null,
  updatePolicy: () => undefined,
  updateTaxRules: () => undefined,
  updatePrices: () => undefined,
  importJson: () => undefined,
  reset: () => undefined,
}

describe('checkPasscode', () => {
  it('accepts the passcode from the policy file', () => {
    expect(checkPasscode('0000', '0000')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(checkPasscode('0001', '0000')).toBe(false)
    expect(checkPasscode('00000', '0000')).toBe(false)
  })

  it('forgives whitespace a paste brings with it', () => {
    expect(checkPasscode('  0000 ', '0000')).toBe(true)
  })

  it('never opens on an empty entry, whatever the policy says', () => {
    expect(checkPasscode('', '')).toBe(false)
    expect(checkPasscode('   ', '0000')).toBe(false)
  })
})

describe('isUnlocked', () => {
  it('is true only for the token the gate itself writes', () => {
    expect(isUnlocked(ADMIN_SESSION_OPEN)).toBe(true)
    expect(isUnlocked(null)).toBe(false)
    expect(isUnlocked('true')).toBe(false)
    expect(isUnlocked('0000')).toBe(false)
  })

  it('is held under a versioned key', () => {
    expect(ADMIN_SESSION_KEY).toMatch(/\.v\d+$/)
  })
})

describe('<AdminGate>', () => {
  it('keeps what it guards out of the document until it is opened', () => {
    const html = renderToStaticMarkup(
      <AdminGate passcode="0000"><p>מכסה שנתית</p></AdminGate>,
    )
    expect(html).not.toContain('מכסה שנתית')
    expect(html).toContain('type="password"')
  })

  it('says plainly that the code is not security', () => {
    const html = renderToStaticMarkup(
      <AdminGate passcode="0000"><p>x</p></AdminGate>,
    )
    expect(html).toContain('אינו אבטחה')
    expect(html).toContain(esc('כלי הפיתוח'))
  })

  it('shows what it guards once the session is open', () => {
    vi.stubGlobal('window', memoryWindow({ [ADMIN_SESSION_KEY]: ADMIN_SESSION_OPEN }))
    const html = renderToStaticMarkup(
      <AdminGate passcode="0000"><p>מכסה שנתית</p></AdminGate>,
    )
    expect(html).toContain('מכסה שנתית')
    expect(html).not.toContain('type="password"')
  })
})

describe('the tax treatment switches', () => {
  it('covers every treatment the engine reads, and nothing else', () => {
    expect([...TREATMENT_KEYS].sort())
      .toEqual(Object.keys(BUNDLED_SETTINGS.policy.taxTreatment)
        .filter(k => k !== 'verified' && k !== 'sourceRef').sort())
  })

  it('offers the four treatments and only those four', () => {
    expect(TREATMENT_OPTIONS.map(o => o.id))
      .toEqual(['net', 'gross', 'taxableBenefit', 'grossedUp'])
  })

  it('treats a component missing from the verified map as unverified', () => {
    const policy = BUNDLED_SETTINGS.policy
    expect(policy.taxTreatment.verified['usageValue']).toBeUndefined()
    expect(isTreatmentVerified(policy, 'usageValue')).toBe(false)
    expect(isTreatmentVerified(policy, 'upgradeSupplement')).toBe(true)
    expect(isTreatmentVerified(policy, 'forgoneLicenseFee')).toBe(false)
  })

  it('names a forgone component the way the policy file names it', () => {
    const policy = BUNDLED_SETTINGS.policy
    expect(treatmentLabelHe(policy, 'forgoneInsurance'))
      .toBe(policy.forgone.privateInsuranceAnnual.labelHe)
    expect(treatmentLabelHe(policy, 'forgoneServiceVehicleTierC'))
      .toBe(policy.forgone.serviceVehicleTierC.labelHe)
  })
})

describe('<AdminPanel>', () => {
  const html = renderToStaticMarkup(<AdminPanel store={store} />)

  it('opens every group the administrator has to reach', () => {
    for (const title of [
      'תקציב ותוספות', "קילומטראז'", 'הפחתות שווי שימוש',
      'דלק ואנרגיה', 'פלאגין', 'מה מפסידים', 'סיווגי מס',
    ]) expect(html).toContain(esc(title))
  })

  it('gives every component four options in its own radio group', () => {
    expect(html.match(/type="radio"/g))
      .toHaveLength(TREATMENT_KEYS.length * TREATMENT_OPTIONS.length)
    for (const key of TREATMENT_KEYS) {
      expect(html.match(new RegExp(`name="treatment-${key}"`, 'g')))
        .toHaveLength(TREATMENT_OPTIONS.length)
    }
  })

  it('selects the treatment the policy currently holds', () => {
    expect(html).toMatch(/id="treatment-usageValue-taxableBenefit"[^>]*checked/)
    expect(html).toMatch(/id="treatment-upgradeSupplement-net"[^>]*checked/)
    expect(html).not.toMatch(/id="treatment-upgradeSupplement-gross"[^>]*checked/)
  })

  it('puts the source citation beside the switches', () => {
    expect(html).toContain(esc(BUNDLED_SETTINGS.policy.taxTreatment.sourceRef))
  })

  it('marks what has not been verified', () => {
    expect(html).toContain('לא אומת')
  })

  it('carries the current figures into the inputs', () => {
    expect(html).toContain(`value="${BUNDLED_SETTINGS.policy.mileage.annualQuotaKm}"`)
    expect(html).toContain(`value="${BUNDLED_SETTINGS.prices.petrol95PerLiter}"`)
    expect(html).toContain(
      `value="${BUNDLED_SETTINGS.taxRules.usageValue.monthlyDeduction.phev}"`,
    )
  })

  it('offers the whole policy as JSON, ready to be committed', () => {
    expect(html).toContain('&quot;adminPasscode&quot;')
    expect(html).toContain('ייצוא')
    expect(html).toContain('ייבוא')
  })

  it('offers to undo only once something has been changed', () => {
    expect(html).not.toContain('שחזור')
    const changed = renderToStaticMarkup(
      <AdminPanel store={{ ...store, overridden: true }} />,
    )
    expect(changed).toContain('שחזור')
  })

  it('shows the reason an edit was refused', () => {
    const refused = renderToStaticMarkup(
      <AdminPanel store={{ ...store, errorHe: 'policy · mileage.annualQuotaKm — הערך נמוך מהמותר' }} />,
    )
    expect(refused).toContain('annualQuotaKm')
    expect(refused).toContain('role="alert"')
  })

  it('uses no physical direction in its layout', () => {
    expect(html).not.toMatch(/\b(text-left|text-right|ml-|mr-|pl-|pr-|left-|right-)/)
  })
})
