import { useState } from 'react'
import type { ReactNode } from 'react'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import type { Profile } from '../../state/profile'
import type { ServiceTier } from '../../engine/contributors/leaseSupplement'

/**
 * Everything the calculation is personal about, on one screen.
 *
 * Two rules govern it. Every control carries exactly one label and nothing
 * else — no helper line restating the label, no example the field already
 * implies. And any value whose policy entry is unverified says so, because a
 * number the organisation has not confirmed must not be presented as fact.
 *
 * Nothing here leaves the device: the caller holds the profile in localStorage
 * and this component only reads it and reports edits back.
 */

export type GradesToTier = {
  verified: boolean
  map: Record<string, ServiceTier>
}

export type ProfileFormProps = {
  profile: Profile
  /** Merges a change. Every field not named keeps its value. */
  onChange: (patch: Partial<Profile>) => void
  /** policy.gradesToTier. Empty while the organisation has not supplied it. */
  gradesToTier: GradesToTier
}

export function ProfileForm({ profile, onChange, gradesToTier }: ProfileFormProps) {
  const grades = Object.keys(gradesToTier.map)

  /*
   * The chosen grade is held here rather than in the profile, because the
   * profile carries a service tier and no grade — the tier is what the engine
   * reads. The consequence is that a reload reopens on the first grade that
   * maps to the stored tier, which is the right tier and may be the wrong
   * grade when several share one. Storing the grade would need a change to
   * src/state/profile.ts, which this task does not own.
   */
  const [grade, setGrade] = useState<string>(
    () => grades.find(g => gradesToTier.map[g] === profile.serviceTier) ?? grades[0] ?? '',
  )

  const pickGrade = (next: string) => {
    setGrade(next)
    const tier = gradesToTier.map[next]
    if (tier !== undefined) onChange({ serviceTier: tier })
  }

  return (
    <Sheet title="הנתונים שלך">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Num id="grossMonthlySalary" label="שכר ברוטו חודשי, ₪" step={500}
             value={profile.grossMonthlySalary}
             onValue={v => { onChange({ grossMonthlySalary: v }) }} />

        <Num id="creditPoints" label="נקודות זיכוי" step={0.25}
             value={profile.creditPoints}
             onValue={v => { onChange({ creditPoints: v }) }} />

        {grades.length > 0 ? (
          <Field label="דרגה" htmlFor="grade" unverified={!gradesToTier.verified}>
            <select id="grade" name="grade" className="field-select" value={grade}
                    onChange={e => { pickGrade(e.target.value) }}>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="רמת שירות" htmlFor="serviceTier" unverified>
            <select id="serviceTier" name="serviceTier" className="field-select"
                    value={profile.serviceTier}
                    onChange={e => {
                      onChange({ serviceTier: e.target.value === 'D' ? 'D' : 'C' })
                    }}>
              <option value="C">{"ג'"}</option>
              <option value="D">{"ד'"}</option>
            </select>
          </Field>
        )}

        <Num id="commuteOneWayKm" label={'מרחק חד־כיווני לעבודה, ק"מ'} step={1}
             value={profile.commuteOneWayKm}
             onValue={v => { onChange({ commuteOneWayKm: v }) }} />

        {/* Replaced "working days a month". The organisation fixes the working
            year at 210 days; what varies between employees is how many of them
            are worked from home, and that is the only part worth asking. */}
        <Field htmlFor="wfhDaysPerWeek" label="ימי עבודה מהבית בשבוע">
          {/* The resulting commuting days are named in the options rather than
              in a help line under the control. It is the fact the reader needs
              and the form's rule is one label and nothing after it. */}
          <select
            id="wfhDaysPerWeek"
            className="field-select"
            value={String(profile.wfhDaysPerWeek)}
            onChange={e => { onChange({ wfhDaysPerWeek: Number(e.target.value) }) }}
          >
            <option value="0">אין — 210 ימי נסיעה בשנה</option>
            <option value="1">יום אחד — 168 ימי נסיעה</option>
            <option value="2">יומיים — 126 ימי נסיעה</option>
          </select>
        </Field>

        <Num id="annualKm" label={'נסועה שנתית, ק"מ'} step={1000}
             value={profile.annualKm}
             onValue={v => { onChange({ annualKm: v }) }} />

        <Num id="monthlyFuelBudgetIce" label="קצובת דלק חודשית לרכב בנזין, ₪" step={100}
             value={profile.monthlyFuelBudgetIce}
             onValue={v => { onChange({ monthlyFuelBudgetIce: v }) }} />

        <Num id="monthlyFuelBudgetElectrified"
             label="קצובת דלק חודשית לרכב היברידי או פלאג־אין, ₪" step={100}
             value={profile.monthlyFuelBudgetElectrified}
             onValue={v => { onChange({ monthlyFuelBudgetElectrified: v }) }} />

        <Check id="chargesDaily" label="טעינה יומית בבית" checked={profile.chargesDaily}
               onValue={v => { onChange({ chargesDaily: v }) }} />

        <Check id="rambiEligible" label={'זכאות רמב"י'} checked={profile.rambiEligible}
               onValue={v => { onChange({ rambiEligible: v }) }} />
      </div>

      {/*
        * Each of these is a tick plus the amount, because the amount is
        * personal: the licence fee follows the car owned, the insurance
        * follows the quote paid, and the payslip components vary by grade.
        * The amount field appears only once the box is ticked, so an unticked
        * benefit does not leave a stray number on screen.
        */}
      <Group legend="מה אתה מקבל היום, ותפסיד אם תיקח רכב">
        <Check id="receivesLicenseFee" label="החזר אגרת רישוי"
               checked={profile.receivesLicenseFee}
               onValue={v => { onChange({ receivesLicenseFee: v }) }} />
        {profile.receivesLicenseFee && (
          <Num id="licenseFeeAnnualPaid" label="אגרת הרישוי ששילמת בשנה, ₪" step={50}
               helpHe="עד תקרה של 1,941 ₪"
               value={profile.licenseFeeAnnualPaid}
               onValue={v => { onChange({ licenseFeeAnnualPaid: v }) }} />
        )}

        <Check id="receivesPrivateInsurance" label="השתתפות בביטוח רכב פרטי"
               checked={profile.receivesPrivateInsurance}
               onValue={v => { onChange({ receivesPrivateInsurance: v }) }} />
        {profile.receivesPrivateInsurance && (
          <Num id="privateInsuranceAnnualPaid" label="עלות הביטוח שלך בשנה, ₪" step={100}
               helpHe="עד תקרה של 7,000 ₪"
               value={profile.privateInsuranceAnnualPaid}
               onValue={v => { onChange({ privateInsuranceAnnualPaid: v }) }} />
        )}

        <Check id="receivesServiceVehicleTierC" label={"רכב שירות ג'"}
               checked={profile.receivesServiceVehicleTierC}
               onValue={v => { onChange({ receivesServiceVehicleTierC: v }) }} />
        {profile.receivesServiceVehicleTierC && (
          <Num id="serviceVehicleTierCMonthly" label={"רכב שירות ג' בתלוש, ₪ לחודש"} step={10}
               helpHe="רכיב ברוטו. לדוגמה 570 ₪"
               value={profile.serviceVehicleTierCMonthly}
               onValue={v => { onChange({ serviceVehicleTierCMonthly: v }) }} />
        )}

        <Check id="receivesFixedNet" label="קבועות נטו"
               checked={profile.receivesFixedNet}
               onValue={v => { onChange({ receivesFixedNet: v }) }} />
        {profile.receivesFixedNet && (
          <Num id="fixedNetMonthly" label="קבועות נטו, ₪ לחודש" step={10}
               helpHe="לדוגמה 318 ₪"
               value={profile.fixedNetMonthly}
               onValue={v => { onChange({ fixedNetMonthly: v }) }} />
        )}

        <Check id="receivesVariableNet" label="משת.רגי.נטו"
               checked={profile.receivesVariableNet}
               onValue={v => { onChange({ receivesVariableNet: v }) }} />
        {profile.receivesVariableNet && (
          <Num id="variableNetMonthly" label="משת.רגי.נטו, ₪ לחודש" step={10}
               helpHe="לדוגמה 408 ₪"
               value={profile.variableNetMonthly}
               onValue={v => { onChange({ variableNetMonthly: v }) }} />
        )}
      </Group>

      {/* Reported beside the car, never inside a monthly figure. */}
      <Group legend="עמדת טעינה">
        <Check id="installsCharger" label="אתקין עמדת טעינה בבית"
               checked={profile.installsCharger}
               onValue={v => { onChange({ installsCharger: v }) }} />
        {profile.installsCharger && (
          <Num id="chargerInstallCost" label="עלות ההתקנה המשוערת, ₪" step={100}
               helpHe="הוצאה חד־פעמית על חשבונך. מוצגת בנפרד ואינה נכנסת לעלות החודשית."
               value={profile.chargerInstallCost}
               onValue={v => { onChange({ chargerInstallCost: v }) }} />
        )}
      </Group>
    </Sheet>
  )
}

/**
 * A number the employee types. Money, distance and days are all non-negative,
 * so the control says so rather than letting a minus reach the engine.
 */
function Num({ id, label, value, step, onValue, helpHe }: {
  id: string
  label: string
  value: number
  step: number
  onValue: (value: number) => void
  /** A ceiling or a worked example. Guidance, never a prefilled value. */
  helpHe?: string
}) {
  return (
    <Field label={label} htmlFor={id} helpHe={helpHe}>
      <input
        id={id}
        name={id}
        className="field-input num"
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={e => { onValue(toNumber(e.target.value)) }}
      />
    </Field>
  )
}

/** The label wraps the box, so the whole row is the 44px target. */
function Check({ id, label, checked, onValue }: {
  id: string
  label: string
  checked: boolean
  onValue: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14px]"
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        className="h-[18px] w-[18px] flex-none accent-[var(--petrol)]"
        checked={checked}
        onChange={e => { onValue(e.target.checked) }}
      />
      {label}
    </label>
  )
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="mt-2 min-w-0 border-0 p-0">
      <legend className="mb-1 text-[13.5px] font-semibold text-[var(--ink-soft)]">
        {legend}
      </legend>
      <div className="grid gap-x-6 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/** A blank box reads as zero; anything unparseable is ignored. */
function toNumber(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
