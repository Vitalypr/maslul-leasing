import { useState, type ReactNode } from 'react'
import { round2 } from '../../engine/round'
import type { TaxTreatment } from '../../engine/types'
import type { PolicyData } from '../../data/schema/policy'
import type { SettingsStore } from '../../state/policyOverride'
import { serializeSettings } from '../../state/policyOverride'
import { Sheet } from '../../ui/Sheet'
import { Field } from '../../ui/Field'

/**
 * The screen where the organisation's numbers are edited.
 *
 * The tax-treatment group is the point of the whole design. Every money line
 * the engine produces carries a treatment — net, gross, taxable benefit, or
 * grossed up — and every one of them is read from policy/org.json at
 * calculation time. Nothing is hardcoded. So the question the client keeps
 * asking, "does this component come off the gross or the net", is answered here
 * by a radio button, and the answer reaches the employee's total on the next
 * render. test/state/policyOverride.test.ts proves that: flipping the upgrade
 * supplement from net to gross changes the annual cost.
 *
 * Every edit is validated against the same Zod schema an imported file is, so
 * an override that reaches storage is always one the app can load again.
 */

type TaxTreatmentBlock = PolicyData['taxTreatment']

export type TreatmentKey = Exclude<keyof TaxTreatmentBlock, 'verified' | 'sourceRef'>

/** Display order, grouped the way a payslip groups them. */
export const TREATMENT_KEYS: readonly TreatmentKey[] = [
  'upgradeSupplement', 'usageValue', 'excessKm', 'fuelOverage',
  'unusedFuelCredit', 'homeChargingRefund', 'oneTime',
  'forgoneLicenseFee', 'forgoneInsurance', 'forgoneServiceVehicleTierC',
  'forgoneFixedNet', 'forgoneVariableNet',
]

/**
 * The four treatments, with what each one does to the payslip. The definitions
 * are shown once, above the switches — the terms are genuinely ambiguous and a
 * radio labelled "ברוטו" alone does not say which direction the money moves.
 */
export const TREATMENT_OPTIONS: readonly {
  id: TaxTreatment; labelHe: string; meaningHe: string
}[] = [
  { id: 'net', labelHe: 'נטו', meaningHe: 'נגבה אחרי מס. השכר החייב אינו משתנה.' },
  { id: 'gross', labelHe: 'ברוטו', meaningHe: 'נגבה לפני מס, ולכן מקטין גם את השכר החייב.' },
  { id: 'taxableBenefit', labelHe: 'זקיפה', meaningHe: 'לא נגבה כסף. השכר החייב עולה.' },
  { id: 'grossedUp', labelHe: 'נטו מגולם', meaningHe: 'המעסיק נושא במס, והעובד מקבל את הסכום המלא.' },
]

/**
 * A component absent from the verified map counts as unverified. The map is
 * where a treatment is confirmed against a source, and silence is not
 * confirmation.
 */
export function isTreatmentVerified(policy: PolicyData, key: TreatmentKey): boolean {
  return policy.taxTreatment.verified[key] === true
}

/** Names read from the policy where the policy already names them. */
export function treatmentLabelHe(policy: PolicyData, key: TreatmentKey): string {
  switch (key) {
    case 'upgradeSupplement': return 'השתתפות בשדרוג הרכב'
    case 'usageValue': return 'שווי שימוש'
    case 'excessKm': return 'חריגה ממכסת הקילומטרים'
    case 'fuelOverage': return 'חריגה מקצובת הדלק'
    case 'unusedFuelCredit': return 'זיכוי דלק שלא נוצל'
    case 'homeChargingRefund': return 'החזר טעינה ביתית'
    case 'oneTime': return 'אירועים חד־פעמיים'
    case 'forgoneLicenseFee': return policy.forgone.licenseFeeAnnual.labelHe
    case 'forgoneInsurance': return policy.forgone.privateInsuranceAnnual.labelHe
    case 'forgoneServiceVehicleTierC': return policy.forgone.serviceVehicleTierC.labelHe
    case 'forgoneFixedNet': return policy.forgone.fixedNetAllowance.labelHe
    case 'forgoneVariableNet': return policy.forgone.variableNetAllowance.labelHe
  }
}

const POWERTRAINS: readonly { id: 'ice' | 'mhev' | 'hybrid' | 'phev' | 'bev'; labelHe: string }[] = [
  { id: 'ice', labelHe: 'בנזין' },
  { id: 'mhev', labelHe: 'היברידי מתון' },
  { id: 'hybrid', labelHe: 'היברידי' },
  { id: 'phev', labelHe: 'פלאג־אין' },
  { id: 'bev', labelHe: 'חשמלי' },
]

export type AdminPanelProps = {
  store: SettingsStore
}

export function AdminPanel({ store }: AdminPanelProps) {
  const { settings, overridden, errorHe } = store
  const { policy, taxRules, prices } = settings

  return (
    <>
      {errorHe !== null ? (
        <p
          role="alert"
          className="mb-5 rounded-[6px] border border-[var(--clay)] bg-[var(--clay-wash)] px-4 py-3 text-[13.5px] text-[var(--clay)]"
        >
          {errorHe}
        </p>
      ) : null}

      <Sheet title="תקציב ותוספות">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <NumberField
            id="budget-c" label="תקציב רמת שירות ג'" unitHe="₪"
            value={policy.supplement.budgetByTier.C}
            onCommit={n => { store.updatePolicy({ supplement: { budgetByTier: { C: n } } }) }}
          />
          <NumberField
            id="budget-d" label="תקציב רמת שירות ד'" unitHe="₪"
            value={policy.supplement.budgetByTier.D}
            onCommit={n => { store.updatePolicy({ supplement: { budgetByTier: { D: n } } }) }}
          />
          <NumberField
            id="rate-default" label="שיעור ברירת מחדל" unitHe="%" scale={100} step={0.01}
            value={policy.supplement.defaultRate}
            onCommit={n => { store.updatePolicy({ supplement: { defaultRate: n } }) }}
          />
          <NumberField
            id="rate-high" label="שיעור גבוה" unitHe="%" scale={100} step={0.01}
            value={policy.supplement.highRate}
            onCommit={n => { store.updatePolicy({ supplement: { highRate: n } }) }}
          />
          <NullableNumberField
            id="rate-threshold" label="מחיר שממנו חל השיעור הגבוה" unitHe="₪" unverified
            value={policy.supplement.highRateThreshold}
            emptyHe="ריק — נעשה שימוש בשיעור הרשום בקטלוג לכל רכב"
            onCommit={n => { store.updatePolicy({ supplement: { highRateThreshold: n } }) }}
          />
          <NumberField
            id="rambi" label="הנחת רמב&quot;י" unitHe="%" scale={100} step={1}
            value={policy.supplement.rambiDiscount}
            onCommit={n => { store.updatePolicy({ supplement: { rambiDiscount: n } }) }}
          />
          <NumberField
            id="term" label="תקופת החוזה" unitHe="חודשים" step={1}
            unverified={!policy.contract.verified}
            value={policy.contract.termMonths}
            onCommit={n => { store.updatePolicy({ contract: { termMonths: n } }) }}
          />
        </div>
      </Sheet>

      <Sheet title="קילומטראז'">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <NumberField
            id="km-quota" label="מכסה שנתית" unitHe="ק&quot;מ" step={1000}
            unverified={!policy.mileage.verified}
            value={policy.mileage.annualQuotaKm}
            onCommit={n => { store.updatePolicy({ mileage: { annualQuotaKm: n } }) }}
          />
          <NumberField
            id="km-rate" label="תעריף לקילומטר חריג" unitHe="₪" step={0.05}
            unverified={!policy.mileage.verified}
            value={policy.mileage.excessRatePerKm}
            onCommit={n => { store.updatePolicy({ mileage: { excessRatePerKm: n } }) }}
          />
        </div>
        <Switch
          id="km-credit" label="זיכוי על קילומטרים שלא נוצלו"
          unverified={!policy.mileage.verified}
          checked={policy.mileage.creditForUnusedKm}
          onChange={v => { store.updatePolicy({ mileage: { creditForUnusedKm: v } }) }}
        />
      </Sheet>

      {/* Only plug-ins read these, but they describe the working year rather
          than the car, so they sit apart from the plug-in settings. */}
      <Sheet title="שנת העבודה">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <NumberField
            id="commute-days" label="ימי נסיעה לעבודה בשנה" unitHe="ימים" step={5}
            unverified={!policy.usage.verified}
            value={policy.usage.commuteDaysPerYear}
            onCommit={n => { store.updatePolicy({ usage: { commuteDaysPerYear: n } }) }}
          />
          <NumberField
            id="days-per-year" label="ימים בשנה" unitHe="ימים" step={1}
            unverified={!policy.usage.verified}
            value={policy.usage.daysPerYear}
            onCommit={n => { store.updatePolicy({ usage: { daysPerYear: n } }) }}
          />
        </div>
        <p className="field-help">
          עבודה מהבית של יום או יומיים בשבוע מורידה מהמספר הזה חמישית או שתי חמישיות,
          והימים עוברים לשאר ימות השנה. נקבע לכל עובד במסך הפרופיל.
        </p>
      </Sheet>

      <Sheet title="הפחתות שווי שימוש">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <NumberField
            id="uv-rate" label="שיעור המודל הליניארי" unitHe="%" scale={100} step={0.01}
            unverified={!taxRules.usageValue.verified}
            value={taxRules.usageValue.linearRate}
            onCommit={n => { store.updateTaxRules({ usageValue: { linearRate: n } }) }}
          />
          <NumberField
            id="uv-ceiling" label="תקרת מחיר מחירון" unitHe="₪"
            unverified={!taxRules.usageValue.verified}
            value={taxRules.usageValue.listPriceCeiling}
            onCommit={n => { store.updateTaxRules({ usageValue: { listPriceCeiling: n } }) }}
          />
        </div>
        <div className="grid gap-x-6 sm:grid-cols-3">
          {POWERTRAINS.map(p => (
            <NumberField
              key={p.id}
              id={`uv-${p.id}`} label={`הפחתה חודשית · ${p.labelHe}`} unitHe="₪" step={10}
              unverified={!taxRules.usageValue.verified}
              value={taxRules.usageValue.monthlyDeduction[p.id]}
              onCommit={n => {
                const monthlyDeduction: Partial<Record<typeof p.id, number>> = { [p.id]: n }
                store.updateTaxRules({ usageValue: { monthlyDeduction } })
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet title="דלק ואנרגיה">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <NumberField
            id="petrol" label="בנזין 95 לליטר" unitHe="₪" step={0.01}
            unverified={!prices.verified}
            value={prices.petrol95PerLiter}
            onCommit={n => { store.updatePrices({ petrol95PerLiter: n }) }}
          />
          <NumberField
            id="kwh" label="חשמל ביתי לקילוואט־שעה" unitHe="₪" step={0.01}
            unverified={!prices.verified}
            value={prices.homeElectricityPerKwh}
            onCommit={n => { store.updatePrices({ homeElectricityPerKwh: n }) }}
          />
          <NumberField
            id="fuel-ice" label="קצובה חודשית · בנזין" unitHe="₪" step={50}
            unverified={!policy.fuel.verified}
            value={policy.fuel.defaultMonthlyBudgetIce}
            onCommit={n => { store.updatePolicy({ fuel: { defaultMonthlyBudgetIce: n } }) }}
          />
          <NumberField
            id="fuel-elec" label="קצובה חודשית · היברידי ופלאג־אין" unitHe="₪" step={50}
            unverified={!policy.fuel.verified}
            value={policy.fuel.defaultMonthlyBudgetElectrified}
            onCommit={n => {
              store.updatePolicy({ fuel: { defaultMonthlyBudgetElectrified: n } })
            }}
          />
        </div>
        <Switch
          id="fuel-entered" label="העובד מזין את הקצובה בעצמו"
          checked={policy.fuel.employeeEntersBudget}
          onChange={v => { store.updatePolicy({ fuel: { employeeEntersBudget: v } }) }}
        />
        <Switch
          id="fuel-credit" label="זיכוי על דלק שלא נוצל"
          checked={policy.fuel.unusedCreditEnabled}
          onChange={v => { store.updatePolicy({ fuel: { unusedCreditEnabled: v } }) }}
        />
        <Switch
          id="fuel-cap" label="הזיכוי מוגבל לגובה ההשתתפות בשדרוג"
          checked={policy.fuel.unusedCreditCappedAtSupplement}
          onChange={v => {
            store.updatePolicy({ fuel: { unusedCreditCappedAtSupplement: v } })
          }}
        />
      </Sheet>

      <Sheet title="פלאגין">
        <div className="max-w-[22rem]">
          <NumberField
            id="phev-factor" label="חלק הטווח המוצהר שמתקיים בנהיגה אמיתית"
            unitHe="%" scale={100} step={1}
            unverified={!policy.phev.verified}
            value={policy.phev.realWorldRangeFactor}
            onCommit={n => { store.updatePolicy({ phev: { realWorldRangeFactor: n } }) }}
          />
        </div>
      </Sheet>

      <Sheet title="מה מפסידים">
        <p className="mt-0 mb-4 text-[12.5px] text-[var(--ink-soft)]">
          הסכומים עצמם מוזנים על ידי העובד — אגרת רישוי וביטוח משתנים לפי הרכב
          שברשותו, ורכיבי התלוש משתנים לפי דרגה. כאן נקבעות רק התקרה והמלצה
          שתוצג לידו.
        </p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <ForgoneLimits
            id="fg-license" item={policy.forgone.licenseFeeAnnual} periodHe="לשנה"
            capKey="annualCap"
            onCap={n => {
              store.updatePolicy({ forgone: { licenseFeeAnnual: { annualCap: n } } })
            }}
            onSuggested={n => {
              store.updatePolicy({ forgone: { licenseFeeAnnual: { suggested: n } } })
            }}
            onEnabled={v => {
              store.updatePolicy({ forgone: { licenseFeeAnnual: { enabled: v } } })
            }}
          />
          <ForgoneLimits
            id="fg-insurance" item={policy.forgone.privateInsuranceAnnual} periodHe="לשנה"
            capKey="annualCap"
            onCap={n => {
              store.updatePolicy({ forgone: { privateInsuranceAnnual: { annualCap: n } } })
            }}
            onSuggested={n => {
              store.updatePolicy({ forgone: { privateInsuranceAnnual: { suggested: n } } })
            }}
            onEnabled={v => {
              store.updatePolicy({ forgone: { privateInsuranceAnnual: { enabled: v } } })
            }}
          />
          <ForgoneLimits
            id="fg-service" item={policy.forgone.serviceVehicleTierC} periodHe="לחודש"
            capKey="monthlyCap"
            onCap={n => {
              store.updatePolicy({ forgone: { serviceVehicleTierC: { monthlyCap: n } } })
            }}
            onSuggested={n => {
              store.updatePolicy({ forgone: { serviceVehicleTierC: { suggested: n } } })
            }}
            onEnabled={v => {
              store.updatePolicy({ forgone: { serviceVehicleTierC: { enabled: v } } })
            }}
          />
          <ForgoneLimits
            id="fg-fixed" item={policy.forgone.fixedNetAllowance} periodHe="לחודש"
            capKey="monthlyCap"
            onCap={n => {
              store.updatePolicy({ forgone: { fixedNetAllowance: { monthlyCap: n } } })
            }}
            onSuggested={n => {
              store.updatePolicy({ forgone: { fixedNetAllowance: { suggested: n } } })
            }}
            onEnabled={v => {
              store.updatePolicy({ forgone: { fixedNetAllowance: { enabled: v } } })
            }}
          />
          <ForgoneLimits
            id="fg-variable" item={policy.forgone.variableNetAllowance} periodHe="לחודש"
            capKey="monthlyCap"
            onCap={n => {
              store.updatePolicy({ forgone: { variableNetAllowance: { monthlyCap: n } } })
            }}
            onSuggested={n => {
              store.updatePolicy({ forgone: { variableNetAllowance: { suggested: n } } })
            }}
            onEnabled={v => {
              store.updatePolicy({ forgone: { variableNetAllowance: { enabled: v } } })
            }}
          />
        </div>
      </Sheet>

      <Sheet title="סיווגי מס">
        <dl className="m-0 mb-6 grid gap-y-1.5 text-[12.5px] text-[var(--ink-soft)] sm:grid-cols-[auto_1fr] sm:gap-x-4">
          {TREATMENT_OPTIONS.map(o => (
            <div key={o.id} className="contents">
              <dt className="font-bold">{o.labelHe}</dt>
              <dd className="m-0">{o.meaningHe}</dd>
            </div>
          ))}
        </dl>

        <div className="grid">
          {TREATMENT_KEYS.map(key => (
            <div
              key={key}
              className="grid gap-2 border-b border-[var(--line)] py-3.5 sm:grid-cols-[minmax(11rem,15rem)_1fr] sm:items-center"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[14px]">{treatmentLabelHe(policy, key)}</span>
                {isTreatmentVerified(policy, key)
                  ? null
                  : <span className="field-unverified">לא אומת</span>}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {TREATMENT_OPTIONS.map(o => (
                  <label
                    key={o.id}
                    htmlFor={`treatment-${key}-${o.id}`}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <input
                      type="radio"
                      id={`treatment-${key}-${o.id}`}
                      name={`treatment-${key}`}
                      value={o.id}
                      checked={policy.taxTreatment[key] === o.id}
                      onChange={() => {
                        const patch: Partial<Record<TreatmentKey, TaxTreatment>> = { [key]: o.id }
                        store.updatePolicy({ taxTreatment: patch })
                      }}
                    />
                    {o.labelHe}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 mb-0 text-[12px] leading-relaxed text-[var(--ink-faint)]">
          {policy.taxTreatment.sourceRef}
        </p>
      </Sheet>

      <Sheet title="קובץ המדיניות">
        <PolicyFile store={store} />
        {overridden ? (
          <button
            type="button"
            onClick={store.reset}
            className="mt-4 min-h-[44px] rounded-[6px] border border-[var(--line)] px-4 text-[13.5px] text-[var(--ink-soft)]"
          >
            שחזור לערכים שנשלחו עם האפליקציה
          </button>
        ) : null}
      </Sheet>
    </>
  )
}

/**
 * The two actions on the policy file, and what each one says when it is done.
 *
 * A button and its confirmation use the same word, so a reader who pressed
 * ייבוא is looking for ייבוא and not for a synonym. test/ui/copy.test.tsx holds
 * the pair together.
 */
export const POLICY_FILE_ACTIONS = {
  export: { labelHe: 'ייצוא לקובץ', doneHe: 'ייצוא הושלם' },
  import: { labelHe: 'ייבוא', doneHe: 'ייבוא הושלם' },
} as const

/**
 * Export and import.
 *
 * The textarea is the export: the whole bundle, indented, ready to be pasted
 * into a file and committed next to the code. Editing it and pressing ייבוא
 * replaces the whole policy — which is the same path a downloaded file takes,
 * so there is one code path to trust rather than two.
 */
function PolicyFile({ store }: { store: SettingsStore }) {
  const serialized = serializeSettings(store.settings)
  const [draft, setDraft] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  return (
    <>
      <textarea
        id="policy-json"
        className="field-input h-64 font-[family-name:var(--mono)] text-[12px] leading-relaxed"
        spellCheck={false}
        dir="ltr"
        value={draft ?? serialized}
        onChange={e => { setDraft(e.target.value); setDone(null) }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            download(serialized, store.settings.policy.version)
            setDone(POLICY_FILE_ACTIONS.export.doneHe)
          }}
          className="min-h-[44px] rounded-[6px] border border-[var(--line)] px-4 text-[13.5px]"
        >
          {POLICY_FILE_ACTIONS.export.labelHe}
        </button>
        <button
          type="button"
          onClick={() => {
            store.importJson(draft ?? serialized)
            setDraft(null)
            setDone(POLICY_FILE_ACTIONS.import.doneHe)
          }}
          className="min-h-[44px] rounded-[6px] border border-[var(--ink)] bg-[var(--ink)] px-4 text-[13.5px] font-bold text-[var(--on-accent)]"
        >
          {POLICY_FILE_ACTIONS.import.labelHe}
        </button>
        {/* A refusal is reported at the top of the screen, in the same render
            as this. Suppressing the confirmation there is what keeps the two
            from appearing side by side and contradicting each other. */}
        {done !== null && store.errorHe === null ? (
          <p role="status" className="m-0 text-[13px] text-[var(--ink-soft)]">{done}</p>
        ) : null}
      </div>
    </>
  )
}

function download(json: string, version: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `policy-${version}.json`
  link.click()
  URL.revokeObjectURL(url)
}

type NumberFieldProps = {
  id: string
  label: string
  value: number
  unitHe?: string
  /** 100 when the value is held as a fraction and shown as a percentage. */
  scale?: number
  step?: number
  unverified?: boolean
  onCommit: (value: number) => void
}

/**
 * A number that commits when the field is left, not on every keystroke.
 *
 * Committing per keystroke would push "2" through the schema on the way to
 * "24000", and a schema that rejects it would fight the person typing.
 */
function NumberField({
  id, label, value, unitHe, scale = 1, step, unverified = false, onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(round2(value * scale))

  const commit = () => {
    setDraft(null)
    if (draft === null) return
    const entered = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(entered)) return
    onCommit(scale === 1 ? entered : Math.round((entered / scale) * 1e8) / 1e8)
  }

  return (
    <Field label={label} htmlFor={id} unverified={unverified}>
      <span className="flex items-center gap-2">
        <input
          id={id}
          className="field-input"
          type="number"
          inputMode="decimal"
          {...(step === undefined ? {} : { step })}
          value={shown}
          onChange={e => { setDraft(e.target.value) }}
          onBlur={commit}
        />
        {unitHe === undefined
          ? null
          : <span className="shrink-0 text-[13px] text-[var(--ink-faint)]">{unitHe}</span>}
      </span>
    </Field>
  )
}

type NullableNumberFieldProps = {
  id: string
  label: string
  value: number | null
  unitHe?: string
  unverified?: boolean
  /** What an empty field means. This one is not obvious from the screen. */
  emptyHe: string
  onCommit: (value: number | null) => void
}

function NullableNumberField({
  id, label, value, unitHe, unverified = false, emptyHe, onCommit,
}: NullableNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === null ? '' : String(value))

  const commit = () => {
    setDraft(null)
    if (draft === null) return
    if (draft.trim() === '') { onCommit(null); return }
    const entered = Number(draft)
    if (Number.isFinite(entered)) onCommit(entered)
  }

  return (
    <Field label={label} htmlFor={id} unverified={unverified}>
      <span className="flex items-center gap-2">
        <input
          id={id}
          className="field-input"
          type="number"
          inputMode="decimal"
          value={shown}
          onChange={e => { setDraft(e.target.value) }}
          onBlur={commit}
        />
        {unitHe === undefined
          ? null
          : <span className="shrink-0 text-[13px] text-[var(--ink-faint)]">{unitHe}</span>}
      </span>
      <span className="text-[12px] text-[var(--ink-faint)]">{emptyHe}</span>
    </Field>
  )
}

type SwitchProps = {
  id: string
  label: string
  checked: boolean
  unverified?: boolean
  onChange: (checked: boolean) => void
}

function Switch({ id, label, checked, unverified = false, onChange }: SwitchProps) {
  return (
    <label htmlFor={id} className="mb-3 flex items-center gap-2.5 text-[14px]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => { onChange(e.target.checked) }}
      />
      {label}
      {unverified ? <span className="field-unverified">לא אומת</span> : null}
    </label>
  )
}

type ForgoneItem = {
  enabled: boolean
  verified: boolean
  labelHe: string
  annualCap?: number | null | undefined
  monthlyCap?: number | null | undefined
  suggested?: number | null | undefined
  helpHe?: string | undefined
  note?: string | undefined
}

function ForgoneLimits({
  id, item, periodHe, capKey, onCap, onSuggested, onEnabled,
}: {
  id: string
  item: ForgoneItem
  periodHe: string
  capKey: 'annualCap' | 'monthlyCap'
  onCap: (value: number) => void
  onSuggested: (value: number) => void
  onEnabled: (value: boolean) => void
}): ReactNode {
  const cap = item[capKey]
  return (
    <div>
      <NumberField
        id={`${id}-cap`} label={`${item.labelHe} · תקרה ${periodHe}`} unitHe="₪" step={50}
        unverified={!item.verified}
        value={cap ?? 0}
        onCommit={onCap}
      />
      <NumberField
        id={`${id}-suggested`} label={`${item.labelHe} · המלצה ${periodHe}`}
        unitHe="₪" step={10}
        value={item.suggested ?? 0}
        onCommit={onSuggested}
      />
      <Switch
        id={`${id}-enabled`} label="נכלל בחישוב"
        checked={item.enabled}
        onChange={onEnabled}
      />
      {item.helpHe === undefined
        ? null
        : (
          <p className="mt-0 mb-4 text-[12px] text-[var(--ink-faint)]">{item.helpHe}</p>
        )}
    </div>
  )
}
