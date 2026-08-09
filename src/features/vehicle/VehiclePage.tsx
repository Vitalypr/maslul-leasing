import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { calculate } from '../../engine/calculate'
import type { CalcTaxRules } from '../../engine/calculate'
import type { EnergyPrices } from '../../engine/contributors/energy'
import { splitAnnualKm } from '../../engine/usage'
import type { MoneyLine } from '../../engine/types'
import type { PolicyData } from '../../data/schema/policy'
import type { Profile } from '../../state/profile'
import { Money } from '../../ui/Money'
import { VehicleImage } from '../../ui/VehicleImage'
import { Sheet } from '../../ui/Sheet'
import { Ledger } from '../../ui/Ledger'
import { BottomBar } from '../../ui/BottomBar'
import { IconExternal } from '../../ui/Icons'
import {
  POWERTRAIN_COLOR, POWERTRAIN_LABEL_HE, type FleetVehicle,
} from '../catalog/CatalogGrid'

/**
 * One car, taken apart.
 *
 * Three things this screen refuses to do. It will not show a cost without the
 * line items behind it, so every ledger row opens onto the formula the engine
 * used and the file it read. It will not bury the plug-in electricity share in
 * a constant, so the share appears as a result of splitAnnualKm with its inputs
 * beside it. And it will not add what the employee gives up into what the car
 * costs — those are two questions, and one number cannot answer both.
 */

export type VehiclePageProps = {
  vehicle: FleetVehicle
  profile: Profile
  policy: PolicyData
  taxRules: CalcTaxRules
  prices: EnergyPrices
  onBack?: () => void
}

const HORIZONS = [
  { id: 'month', tabHe: 'חודש', ofHe: 'לחודש', factor: 1 / 12 },
  { id: 'year', tabHe: 'שנה', ofHe: 'לשנה', factor: 1 },
  { id: 'contract', tabHe: '3 שנים', ofHe: 'ל־3 שנים', factor: 3 },
] as const

type Horizon = (typeof HORIZONS)[number]['id']

export function VehiclePage({
  vehicle, profile, policy, taxRules, prices, onBack,
}: VehiclePageProps) {
  const [horizon, setHorizon] = useState<Horizon>('month')

  const result = useMemo(
    () => calculate({ vehicle, employee: profile, policy, taxRules, prices }),
    [vehicle, profile, policy, taxRules, prices],
  )

  // The same split calculate() ran on, recomputed rather than guessed at, so
  // the share on screen and the energy lines in the ledger cannot disagree.
  const usage = useMemo(() => splitAnnualKm({
    annualKm: profile.annualKm,
    commuteOneWayKm: profile.commuteOneWayKm,
    commuteDaysPerYear: policy.usage.commuteDaysPerYear,
    wfhDaysPerWeek: profile.wfhDaysPerWeek,
    daysPerYear: policy.usage.daysPerYear,
    powertrain: vehicle.powertrain,
    chargesDaily: profile.chargesDaily,
    manufacturerEvRangeKm: vehicle.consumption?.evRangeKm ?? null,
    realEvRangeKm: vehicle.realEvRangeKm ?? null,
    realWorldRangeFactor: policy.phev.realWorldRangeFactor,
  }), [vehicle, profile, policy])

  const h = HORIZONS.find(x => x.id === horizon) ?? HORIZONS[0]

  /*
   * A one-time event is paid once over the contract, not once a year, so it is
   * the one line the contract view must not multiply. calculate() already
   * separates it out of the recurring annual figure; this mirrors that rule on
   * the display side so the rows still add up to the total beneath them.
   */
  const scale = (line: MoneyLine): MoneyLine => ({
    ...line,
    annualAmount: line.annualAmount
      * (horizon === 'contract' && line.category === 'oneTime' ? 1 : h.factor),
  })

  const total = horizon === 'month' ? result.monthlyNet
    : horizon === 'year' ? result.annualNet
      : result.threeYearNet

  const estimated = vehicle.consumption?.source === 'estimate'
  const evShare = share(usage.evKm, usage.annualKm)

  return (
    <article>
      <header className="pb-7">
        {onBack === undefined ? null : (
          <button type="button" onClick={onBack}
                  className="mb-1 inline-flex min-h-[44px] cursor-pointer items-center text-[13.5px] font-semibold text-[var(--petrol)]">
            חזרה לצי
          </button>
        )}
        <h1 className="m-0 text-[clamp(28px,3.6vw,40px)] font-bold tracking-tight">
          {vehicle.nameHe}
        </h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[14px] text-[var(--ink-soft)]">
          {/* Latin and Hebrew trims both occur; let the string decide. */}
          {vehicle.trim === '' ? null : <span dir="auto">{vehicle.trim}</span>}
          <span className="inline-flex items-center gap-1.5"
                style={{ color: POWERTRAIN_COLOR[vehicle.powertrain] }}>
            <i className="h-[7px] w-[7px] flex-none rounded-full bg-current" />
            {POWERTRAIN_LABEL_HE[vehicle.powertrain]}
          </span>
          <span>מחיר מחירון <Money value={vehicle.listPrice} /></span>
        </p>

        <figure className="mt-5 mb-0 overflow-hidden rounded-[var(--r)] border border-[var(--line)]">
          <VehicleImage vehicleId={vehicle.id} altHe={vehicle.nameHe} priority />
          {/* Everything on this screen is about cost. The spec sheet, the
              colours, the road tests — those live on icar, and pointing at
              them is more useful than reproducing a worse version here. */}
          {/* Where the only photograph available does not exactly depict this
              trim, say so under it rather than letting the reader assume. */}
          {vehicle.imageNoteHe === undefined ? null : (
            <figcaption className="image-note">{vehicle.imageNoteHe}</figcaption>
          )}
          {vehicle.icarUrl === undefined ? null : (
            <figcaption>
              <a
                className="icar-link"
                href={vehicle.icarUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <IconExternal />
                מפרט מלא ותמונות נוספות באתר icar
              </a>
            </figcaption>
          )}
        </figure>
      </header>

      {result.missingDataHe === null ? null : (
        <p role="status" className="missing-data mb-5">
          <b>חסרים נתונים לרכב הזה</b>
          {`אין ${result.missingDataHe}, ולכן לא מוצגת עלות. `}
          סולר אינו מפוקח בישראל ואין לו מחיר מרבי רשמי — נדרש המחיר שלקוח ליסינג
          משלם בפועל. עד אז כל מספר כאן היה ניחוש שנראה כמו חישוב.
        </p>
      )}

      <div className="grid gap-5 lg:[grid-template-columns:1fr_460px]">
        {/* The heading above already identifies the car — its powertrain and
            its list price. What is left for this sheet is the terms it would
            be held under, which the heading does not carry. */}
        <Sheet>
          <dl className="grid gap-x-7 sm:grid-cols-2">
            <Spec term="צריכה" estimated={estimated}>
              {consumptionHe(vehicle)}
            </Spec>

            <Spec term={'מכסת ק"מ שנתית'} unverified={!policy.mileage.verified}>
              {km(policy.mileage.annualQuotaKm)}
            </Spec>

            {/* A per-kilometre rate is cents, so it is written out rather than
                passed through Money, which displays whole shekels. The dir="ltr"
                that keeps a sign on its own side still applies. */}
            <Spec term={'תעריף חריגה לק"מ'} unverified={!policy.mileage.verified}>
              <span dir="ltr" className="num">{policy.mileage.excessRatePerKm} ₪</span>
            </Spec>

            <Spec term="תקופת החוזה" unverified={!policy.contract.verified}>
              {policy.contract.termMonths} חודשים
            </Spec>
          </dl>

          {vehicle.powertrain === 'phev' ? (
            <div className="mt-6 rounded-[var(--r)] border border-dashed border-[var(--line-strong)] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-semibold">
                  מהנסועה השנתית על חשמל
                </span>
                <output className="num text-[15px] font-semibold text-[var(--petrol)]"
                        style={{ fontFamily: 'var(--mono)' }}>
                  {Math.round(evShare * 100)}%
                </output>
              </div>
              <div className="mt-2.5 h-[13px] overflow-hidden rounded-full bg-[var(--surface-sunk)]">
                <i className="block h-full bg-[var(--petrol)]"
                   style={{ inlineSize: `${(evShare * 100).toFixed(1)}%` }} />
              </div>
              <dl className="mt-3 grid gap-x-7 sm:grid-cols-2">
                <Spec
                  term="טווח חשמלי אפקטיבי"
                  unverified={vehicle.realEvRangeKm == null && !policy.phev.verified}
                >
                  {km(usage.effectiveEvRangeKm)}
                </Spec>
                {/* Both buckets, because the reader needs to see which one
                    empties the battery — that is what decides the petrol. */}
                <Spec term="נסיעה לעבודה">
                  {km(usage.dailyCommuteKm)} × {usage.commuteDays} ימים
                </Spec>
                <Spec term="שאר ימות השנה">
                  {km(usage.otherDailyKm)} × {usage.otherDays} ימים
                </Spec>
                <Spec term={'ק"מ על חשמל בשנה'}>
                  {km(usage.evKm)} מתוך {km(usage.annualKm)}
                </Spec>
                <Spec term={'ק"מ על דלק בשנה'}>{km(usage.iceKm)}</Spec>
              </dl>
            </div>
          ) : null}
        </Sheet>

        <Sheet>
          {/* The tabs below name the horizon; the caption says what kind of
              figure it is, and neither repeats the other. */}
          <Money value={total}
                 className="block text-[clamp(38px,5vw,52px)] font-extrabold leading-none tracking-tighter" />
          <p className="mt-[7px] mb-5 text-[14px] text-[var(--ink-soft)]">נטו לכיס</p>

          <div role="tablist" aria-label="טווח זמן" className="seg">
            {HORIZONS.map(x => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={horizon === x.id}
                data-horizon={x.id}
                aria-controls="lease-ledger"
                onClick={() => { setHorizon(x.id) }}
                className="seg-btn"
              >
                {x.tabHe}
              </button>
            ))}
          </div>

          <div id="lease-ledger" role="tabpanel">
            <Ledger
              lines={result.ledger.map(scale)}
              totalAnnual={total}
              totalLabelHe={`סה"כ ${h.ofHe}`}
            />
          </div>
        </Sheet>
      </div>

      {result.forgone.length === 0 ? null : (
        <Sheet title="מה תפסיד">
          <Ledger
            lines={result.forgone.map(scale)}
            totalAnnual={result.forgoneAnnual * h.factor}
            totalLabelHe={`אחרי מס, ${h.ofHe}`}
          />
        </Sheet>
      )}

      {/*
        * The wallbox, reported and deliberately not counted.
        *
        * It is a single outlay on the employee's own property that outlives
        * the lease, so putting it into a monthly figure would misstate the
        * cost twice over — inflating the month and implying it recurs. It is
        * stated plainly instead, and the note says why it sits outside.
        */}
      {result.chargerInstallOneTime > 0 && (
        <Sheet title="הוצאה חד־פעמית">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span>התקנת עמדת טעינה</span>
            <Money value={result.chargerInstallOneTime} className="font-semibold" />
          </div>
          <p className="mt-2 mb-0 text-[12.5px] text-[var(--ink-faint)]">
            על חשבונך, פעם אחת. אינה נכללת בעלות החודשית, השנתית או התלת־שנתית —
            העמדה נשארת אצלך גם אחרי סוף החוזה.
          </p>
        </Sheet>
      )}

      {/* Phone only. It carries the figure from the sheet above, at whatever
          horizon is selected, so the two can never disagree. */}
      <BottomBar labelHe="נטו לכיס" value={total} />
    </article>
  )
}

/**
 * One row of the spec list: a term, its value, and any mark it has earned.
 *
 * Two marks, because they say different things. `unverified` means the
 * organisation has not confirmed the number; `estimated` means nobody has —
 * it was supplied so the engine could run (docs/ASSUMPTIONS.md section ה).
 */
function Spec({ term, children, unverified = false, estimated = false }: {
  term: string
  children: ReactNode
  unverified?: boolean
  estimated?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-[9px] text-[13.5px]">
      <dt className="flex items-baseline gap-2 text-[var(--ink-soft)]">
        {term}
        {unverified ? <span className="field-unverified">לא אומת</span> : null}
        {estimated ? <span className="field-unverified">משוערת</span> : null}
      </dt>
      <dd className="num m-0 font-semibold">{children}</dd>
    </div>
  )
}

/**
 * What the car burns, in the units that apply to it. A plug-in gets both,
 * because both are true of it and each governs a different part of the year.
 */
function consumptionHe(vehicle: FleetVehicle): string {
  const c = vehicle.consumption
  if (c === undefined) return '—'
  const petrol = c.kmPerLiterHybridMode ?? c.kmPerLiter
  const electric = c.kwhPer100km
  const parts: string[] = []
  if (electric !== undefined) parts.push(`${electric} kWh ל-100 ק"מ`)
  if (petrol !== undefined) parts.push(`${petrol} קמ"ל`)
  return parts.length === 0 ? '—' : parts.join(' · ')
}

const share = (part: number, whole: number): number => (whole > 0 ? part / whole : 0)

const km = (n: number): string =>
  `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} ק"מ`
