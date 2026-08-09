import { useMemo, useState } from 'react'
import { calculate } from '../../engine/calculate'
import type { CalcTaxRules, Vehicle } from '../../engine/calculate'
import type { EnergyPrices } from '../../engine/contributors/energy'
import type { Powertrain } from '../../engine/tax/usageValue'
import type { PolicyData } from '../../data/schema/policy'
import type { Profile } from '../../state/profile'
import { Money } from '../../ui/Money'
import { VehicleImage } from '../../ui/VehicleImage'

/**
 * The fleet, priced for one person.
 *
 * The point of the screen is the number on the card. A list price tells an
 * employee nothing — two cars with the same sticker can differ by hundreds a
 * month once the tier budget, the usage value and the fuel account are in.
 * So every card runs the full engine for this profile and leads with what the
 * car costs *this* reader, per month, after tax.
 */

/**
 * A catalogue row: what the engine reads, plus what the card shows.
 *
 * `icarUrl` is deliberately here and not on the engine's `Vehicle`. The engine
 * costs cars and must not grow a field it would never read; the screens link
 * out to the model's page, so the screens' type is where the link lives.
 */
export type FleetVehicle = Vehicle & {
  trim: string
  icarUrl?: string | undefined
  /** Set where the photograph does not exactly depict this trim. */
  imageNoteHe?: string | undefined
}

export type CatalogGridProps = {
  vehicles: readonly FleetVehicle[]
  profile: Profile
  policy: PolicyData
  taxRules: CalcTaxRules
  prices: EnergyPrices
  selectedId?: string | null
  onSelect: (id: string) => void
}

export const POWERTRAIN_LABEL_HE: Record<Powertrain, string> = {
  ice: 'דלק',
  mhev: 'היברידי קל',
  hybrid: 'היברידי',
  phev: 'פלאג־אין',
  bev: 'חשמלי',
}

export const POWERTRAIN_COLOR: Record<Powertrain, string> = {
  ice: 'var(--pt-ice)',
  mhev: 'var(--pt-ice)',
  hybrid: 'var(--pt-hybrid)',
  phev: 'var(--pt-phev)',
  bev: 'var(--pt-bev)',
}

const POWERTRAIN_ORDER: Powertrain[] = ['ice', 'mhev', 'hybrid', 'phev', 'bev']

type Filter = Powertrain | 'all'

/* `catalog-grid` is the hook index.css uses to drop to one card per row below
   the tablet breakpoint. */
const GRID = [
  'catalog-grid grid gap-px overflow-hidden rounded-[var(--r)]',
  'border border-[var(--line)] bg-[var(--line)]',
  '[grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]',
].join(' ')

const CARD = [
  'flex cursor-pointer flex-col items-start p-4 text-start',
  'bg-[var(--surface)] hover:bg-[var(--surface-sunk)]',
  'aria-[current=true]:bg-[var(--petrol-wash)]',
].join(' ')

const TERMS = [
  'mt-3.5 flex w-full justify-between border-t border-[var(--line)]',
  'pt-3 text-[12.5px] text-[var(--ink-faint)]',
].join(' ')

export function CatalogGrid({
  vehicles, profile, policy, taxRules, prices, selectedId = null, onSelect,
}: CatalogGridProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const priced = useMemo(
    () => vehicles.map(vehicle => ({
      vehicle,
      result: calculate({ vehicle, employee: profile, policy, taxRules, prices }),
    })),
    [vehicles, profile, policy, taxRules, prices],
  )

  // Only the powertrains the fleet actually contains. A chip that filters to an
  // empty grid is a control that does nothing.
  const present = POWERTRAIN_ORDER.filter(
    pt => vehicles.some(v => v.powertrain === pt),
  )
  const shown = priced.filter(p => filter === 'all' || p.vehicle.powertrain === filter)

  return (
    <div>
      <div className="flex flex-wrap gap-2 pb-5" role="group" aria-label="סוג הנעה">
        <Chip active={filter === 'all'} powertrain="all" label="הכל"
              onPick={() => { setFilter('all') }} />
        {present.map(pt => (
          <Chip key={pt} active={filter === pt} powertrain={pt}
                label={POWERTRAIN_LABEL_HE[pt]} color={POWERTRAIN_COLOR[pt]}
                onPick={() => { setFilter(pt) }} />
        ))}
      </div>

      {/* One hairline between cards: a 1px gap over a --line background, so the
          rules are the grid itself rather than a border on every card. */}
      <div className={GRID}>
        {shown.map(({ vehicle, result }) => (
          <button
            key={vehicle.id}
            type="button"
            data-vehicle-id={vehicle.id}
            aria-current={vehicle.id === selectedId}
            onClick={() => { onSelect(vehicle.id) }}
            className={CARD}
          >
            {/* Bled to the card edges — the photograph is the card's top edge,
                not a picture sitting inside a frame. */}
            <span className="-mx-4 -mt-4 mb-3 block w-[calc(100%+2rem)] overflow-hidden border-b border-[var(--line)]">
              <VehicleImage vehicleId={vehicle.id} altHe={vehicle.nameHe} />
            </span>

            <span
              className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider"
              style={{ color: POWERTRAIN_COLOR[vehicle.powertrain] }}
            >
              <i className="h-[7px] w-[7px] flex-none rounded-full bg-current" />
              {POWERTRAIN_LABEL_HE[vehicle.powertrain]}
            </span>

            <span className="mt-3 text-[17px] font-bold tracking-tight">
              {vehicle.nameHe}
            </span>
            {/* Trims are a mix of Latin ("Comfort") and Hebrew ("סלקשן"), so the
                direction is resolved per string instead of forced one way. */}
            {vehicle.trim === '' ? null : (
              <span dir="auto" className="text-[13px] text-[var(--ink-faint)]">
                {vehicle.trim}
              </span>
            )}

            {/*
              * A car with a missing input shows the gap, not a price. The
              * engine still returns totals, but they were built without a
              * required figure, so printing them would present a guess with
              * the same confidence as a calculation.
              */}
            {result.missingDataHe === null ? (
              <>
                <Money
                  value={result.monthlyNet}
                  className="mt-4 block text-[30px] font-extrabold leading-none tracking-tight"
                />
                <span className="mt-1.5 text-[12.5px] text-[var(--ink-soft)]">
                  לחודש, נטו לכיס
                </span>

                <span className={TERMS}>
                  <span>
                    שנה{' '}
                    <Money value={result.annualNet}
                           className="font-semibold text-[var(--ink-soft)]" />
                  </span>
                  <span>
                    3 שנים{' '}
                    <Money value={result.threeYearNet}
                           className="font-semibold text-[var(--ink-soft)]" />
                  </span>
                </span>
              </>
            ) : (
              <span className="missing-data mt-4">
                <b>חסרים נתונים</b>
                {`לא ניתן לחשב עלות ללא ${result.missingDataHe}.`}
              </span>
            )}

            {/* Every consumption figure in the catalogue is still an estimate
                (docs/ASSUMPTIONS.md section ה), and the cost above rests on it. */}
            {vehicle.consumption?.source === 'estimate' ? (
              <span className="field-unverified mt-3">צריכה משוערת</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, powertrain, label, color, onPick }: {
  active: boolean
  powertrain: Filter
  label: string
  color?: string
  onPick: () => void
}) {
  // `.chip` in index.css carries the shape, the 44px target and the pressed
  // state, which it reads from aria-pressed rather than a second class.
  return (
    <button
      type="button"
      aria-pressed={active}
      data-powertrain={powertrain}
      onClick={onPick}
      className="chip"
    >
      {color === undefined ? null : <i style={{ background: color }} />}
      {label}
    </button>
  )
}
