import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { PolicySchema, type PolicyData } from '../data/schema/policy'
import { TaxRulesSchema, type TaxRulesData } from '../data/schema/taxRules'
import policyJson from '../data/policy/org.json'
import taxRulesJson from '../data/tax-rules/2026.json'
import pricesJson from '../data/energy/prices-2026.json'

/**
 * The administrator's edits to the three data files the engine reads.
 *
 * Three, not one, because the settings an administrator has to reach are spread
 * across them: the budgets and the tax treatments live in policy/org.json, the
 * usage-value model in tax-rules/2026.json, and the pump and socket prices in
 * energy/prices-2026.json. Presenting them as one editable bundle is what lets
 * the admin screen be organised by subject instead of by file.
 *
 * An override is stored as a *patch over the bundled files*, never as a
 * replacement for them. A stored blob written before a field existed still
 * merges cleanly onto a newer build, and a field the administrator never
 * touched keeps tracking the shipped value rather than freezing at whatever it
 * happened to be on the day they opened the screen.
 *
 * Nothing here is secret. The policy is organisational, not personal, and the
 * bundled copy is already in the JavaScript the browser downloaded.
 */

/** No schema file exists for the energy prices; this is it. */
export const PricesSchema = z.strictObject({
  petrol95PerLiter: z.number().nonnegative(),
  /** One car in the fleet is diesel; Israel does not regulate its price. */
  dieselPerLiter: z.number().nonnegative().nullable().optional(),
  homeElectricityPerKwh: z.number().nonnegative(),
  asOf: z.string(),
  verified: z.boolean(),
  source: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
})

export type PricesData = z.infer<typeof PricesSchema>

export type Settings = {
  policy: PolicyData
  taxRules: TaxRulesData
  prices: PricesData
}

/** Versioned, so a change to the shape cannot resurrect an incompatible blob. */
export const SETTINGS_STORAGE_KEY = 'maslul.policy.v1'

/**
 * The shipped files, parsed once. A failure here is a build defect rather than
 * a runtime condition — test/data/schema.test.ts is what keeps it from
 * reaching a browser — so it throws instead of degrading.
 */
export const BUNDLED_SETTINGS: Settings = Object.freeze({
  policy: PolicySchema.parse(policyJson),
  taxRules: TaxRulesSchema.parse(taxRulesJson),
  prices: PricesSchema.parse(pricesJson),
})

/**
 * A patch shape: any subset, to any depth. Arrays stop the recursion because a
 * half-replaced bracket table is never what anyone means.
 */
export type DeepPartial<T> =
  T extends readonly unknown[] ? T
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Merges a patch onto a base, leaf by leaf. A key the patch does not mention
 * keeps its value; an array is replaced whole.
 */
export function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch ?? base) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] = isPlainObject(current) && isPlainObject(value)
      ? deepMerge(current, value)
      : value
  }
  return out as T
}

export type MergeResult =
  | { ok: true; settings: Settings }
  | { ok: false; errorHe: string }

/**
 * Applies an arbitrary patch — typed from the admin screen, untyped from an
 * imported file — and validates the result before letting it out.
 *
 * Two shapes are accepted: the bundle this module exports, and a bare policy
 * file. The second one matters because it means `src/data/policy/org.json`,
 * the artefact that gets versioned in the repository, can be dropped straight
 * into the import box.
 */
export function mergeSettings(base: Settings, patch: unknown): MergeResult {
  if (!isPlainObject(patch)) {
    return {
      ok: false,
      errorHe: 'הקובץ אינו אובייקט JSON. הדבק את התוכן של policy/org.json.',
    }
  }

  const bundle = 'taxTreatment' in patch ? { policy: patch } : patch

  const policy = PolicySchema.safeParse(
    deepMerge(base.policy, (bundle['policy'] ?? {}) as DeepPartial<PolicyData>),
  )
  if (!policy.success) return { ok: false, errorHe: describe('policy', policy.error) }

  const taxRules = TaxRulesSchema.safeParse(
    deepMerge(base.taxRules, (bundle['taxRules'] ?? {}) as DeepPartial<TaxRulesData>),
  )
  if (!taxRules.success) return { ok: false, errorHe: describe('tax-rules', taxRules.error) }

  const prices = PricesSchema.safeParse(
    deepMerge(base.prices, (bundle['prices'] ?? {}) as DeepPartial<PricesData>),
  )
  if (!prices.success) return { ok: false, errorHe: describe('prices', prices.error) }

  return {
    ok: true,
    settings: { policy: policy.data, taxRules: taxRules.data, prices: prices.data },
  }
}

/** Reads a stored or pasted override. Never throws; falls back to the bundle. */
export function readSettings(raw: string | null, base = BUNDLED_SETTINGS): Settings {
  if (raw === null || raw === '') return base
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return base
  }
  const merged = mergeSettings(base, parsed)
  return merged.ok ? merged.settings : base
}

/** Indented, because the export is meant to be committed and diffed. */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2)
}

export function isOverridden(
  settings: Settings, base = BUNDLED_SETTINGS,
): boolean {
  return JSON.stringify(settings) !== JSON.stringify(base)
}

export type SettingsStore = {
  settings: Settings
  /** True while anything differs from the files that shipped. */
  overridden: boolean
  /** The reason the last edit or import was refused, or null. */
  errorHe: string | null
  updatePolicy: (patch: DeepPartial<PolicyData>) => void
  updateTaxRules: (patch: DeepPartial<TaxRulesData>) => void
  updatePrices: (patch: DeepPartial<PricesData>) => void
  /** Replaces everything from a pasted or uploaded file. */
  importJson: (raw: string) => void
  /** Back to the shipped files. */
  reset: () => void
}

export function useSettings(): SettingsStore {
  const [settings, setSettings] = useState<Settings>(() => readSettings(readStored()))
  const [errorHe, setErrorHe] = useState<string | null>(null)

  useEffect(() => {
    if (isOverridden(settings)) writeStored(serializeSettings(settings))
    else clearStored()
  }, [settings])

  // Every edit goes through the same validation as an import. A budget of -1
  // typed into the screen is exactly as wrong as one pasted from a file, and
  // refusing it here is what keeps the stored override always loadable.
  const apply = useCallback((patch: unknown) => {
    setSettings(current => {
      const merged = mergeSettings(current, patch)
      if (!merged.ok) {
        setErrorHe(merged.errorHe)
        return current
      }
      setErrorHe(null)
      return merged.settings
    })
  }, [])

  const updatePolicy = useCallback(
    (patch: DeepPartial<PolicyData>) => { apply({ policy: patch }) }, [apply],
  )
  const updateTaxRules = useCallback(
    (patch: DeepPartial<TaxRulesData>) => { apply({ taxRules: patch }) }, [apply],
  )
  const updatePrices = useCallback(
    (patch: DeepPartial<PricesData>) => { apply({ prices: patch }) }, [apply],
  )

  const importJson = useCallback((raw: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setErrorHe('הטקסט אינו JSON תקין. הדבק את התוכן של policy/org.json.')
      return
    }
    // An import replaces, so it is merged onto the shipped files rather than
    // onto the edits already on screen.
    const merged = mergeSettings(BUNDLED_SETTINGS, parsed)
    if (!merged.ok) {
      setErrorHe(merged.errorHe)
      return
    }
    setErrorHe(null)
    setSettings(merged.settings)
  }, [])

  const reset = useCallback(() => {
    setErrorHe(null)
    setSettings(BUNDLED_SETTINGS)
  }, [])

  const overridden = useMemo(() => isOverridden(settings), [settings])

  return {
    settings, overridden, errorHe,
    updatePolicy, updateTaxRules, updatePrices, importJson, reset,
  }
}

/**
 * Turns a Zod failure into one Hebrew line naming the field.
 *
 * The path is left in English on purpose: it is the key in the JSON file the
 * administrator is about to open, and translating it would send them looking
 * for a key that does not exist.
 */
function describe(file: string, error: z.ZodError): string {
  const issue = error.issues[0]
  if (issue === undefined) return `${file}: הקובץ אינו תקין.`
  const path = issue.path.join('.')
  const where = path === '' ? file : `${file} · ${path}`
  return `${where} — ${reasonHe(issue)}`
}

function reasonHe(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type': return 'סוג הערך אינו מתאים'
    case 'invalid_value': return 'הערך אינו אחת האפשרויות המותרות'
    case 'unrecognized_keys': return 'שדה לא מוכר'
    case 'too_small': return 'הערך נמוך מהמותר'
    case 'too_big': return 'הערך גבוה מהמותר'
    default: return issue.message
  }
}

/* Storage can throw — Safari in private mode does. An override that fails to
   persist is worth less than one that takes the screen down with it. */
function readStored(): string | null {
  try {
    return window.localStorage.getItem(SETTINGS_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, value)
  } catch {
    /* the session still works, it just will not survive a reload */
  }
}

function clearStored(): void {
  try {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
  } catch {
    /* nothing to do */
  }
}
