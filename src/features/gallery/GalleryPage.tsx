import { useMemo, useState } from 'react'
import { calculate } from '../../engine/calculate'
import type { CalcTaxRules } from '../../engine/calculate'
import type { EnergyPrices } from '../../engine/contributors/energy'
import type { Powertrain } from '../../engine/tax/usageValue'
import type { PolicyData } from '../../data/schema/policy'
import type { Profile } from '../../state/profile'
import { Money } from '../../ui/Money'
import { VehicleImage } from '../../ui/VehicleImage'
import {
  POWERTRAIN_COLOR, POWERTRAIN_LABEL_HE, type FleetVehicle,
} from '../catalog/CatalogGrid'

/**
 * The whole fleet at once, sorted into engines.
 *
 * The fleet screen answers "what does this car cost me"; this one answers the
 * question that comes before it — "what am I choosing between". So the tiles
 * are small and there are no controls on them: picture, name, price, and
 * nothing else competing for the eye. Grouping by powertrain is what makes the
 * screen worth having, because the powertrain is the single decision that moves
 * the monthly figure most, and seeing eleven plug-ins priced side by side is
 * the comparison a list sorted by price cannot show.
 *
 * The price is the same engine result the fleet screen and the comparison use,
 * for the same profile. It is called an estimate on screen because it moves
 * with mileage and salary, not because it is computed any less carefully.
 */

export type GalleryPageProps = {
  vehicles: readonly FleetVehicle[]
  profile: Profile
  policy: PolicyData
  taxRules: CalcTaxRules
  prices: EnergyPrices
  onSelect: (id: string) => void
}

/* Cheapest engine first, so the screen reads as a ladder rather than a list. */
const ORDER: readonly Powertrain[] = ['bev', 'phev', 'hybrid', 'mhev', 'ice']

type Priced = { vehicle: FleetVehicle; monthly: number; missing: string | null }

/* Cars whose cost cannot be computed sort last either way: they have no price
   to rank, and putting them at the top of "cheapest first" would read as a
   claim that they are cheap. */
const SORTS = [
  { id: 'asc', labelHe: 'מהזול ליקר', sign: 1 },
  { id: 'desc', labelHe: 'מהיקר לזול', sign: -1 },
] as const

type SortId = (typeof SORTS)[number]['id']

export function GalleryPage({
  vehicles, profile, policy, taxRules, prices, onSelect,
}: GalleryPageProps) {
  const [sort, setSort] = useState<SortId>('asc')

  const groups = useMemo(() => {
    const priced: Priced[] = vehicles.map(vehicle => {
      const r = calculate({ vehicle, employee: profile, policy, taxRules, prices })
      return { vehicle, monthly: r.monthlyNet, missing: r.missingDataHe }
    })

    return ORDER
      .map(pt => ({
        powertrain: pt,
        labelHe: POWERTRAIN_LABEL_HE[pt],
        // Sorted within the group: the reason to group is comparison.
        items: priced
          .filter(p => p.vehicle.powertrain === pt)
          .sort((a, b) => {
            if ((a.missing === null) !== (b.missing === null)) return a.missing === null ? -1 : 1
            return (a.monthly - b.monthly) * (SORTS.find(x => x.id === sort)?.sign ?? 1)
          }),
      }))
      .filter(g => g.items.length > 0)
  }, [vehicles, profile, policy, taxRules, prices, sort])

  return (
    <section className="py-6">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight">גלריית הצי</h1>
        <p className="mt-1 text-[14px] text-[var(--soft)]">
          כל הרכבים לפי סוג מנוע, עם העלות החודשית המוערכת נטו לפרופיל שלך.
        </p>

        <div className="seg seg-sort" role="tablist" aria-label="סדר תצוגה">
          {SORTS.map(o => (
            <button
              key={o.id}
              type="button"
              role="tab"
              className="seg-btn"
              aria-selected={sort === o.id}
              onClick={() => { setSort(o.id) }}
            >
              {o.labelHe}
            </button>
          ))}
        </div>
      </header>

      {groups.map(g => (
        <div key={g.powertrain} className="gallery-group">
          <h2 className="gallery-head">
            <i className="dot" style={{ background: POWERTRAIN_COLOR[g.powertrain] }} />
            {g.labelHe}
            <b>{g.items.length}</b>
          </h2>

          <div className="gallery-grid">
            {g.items.map(({ vehicle, monthly, missing }) => (
              <button
                key={vehicle.id}
                type="button"
                className="tile"
                onClick={() => { onSelect(vehicle.id) }}
              >
                <VehicleImage
                  vehicleId={vehicle.id}
                  altHe={vehicle.nameHe}
                  className="tile-img"
                />
                <span className="tile-name">{vehicle.nameHe}</span>
                <span className="tile-trim">{vehicle.trim}</span>
                {missing === null ? (
                  <span className="tile-price">
                    <Money value={monthly} />
                    <em>לחודש</em>
                  </span>
                ) : (
                  <span className="tile-price missing">חסרים נתונים</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
