import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { calculate } from './engine/calculate'
import type { CalcTaxRules, Vehicle } from './engine/calculate'
import type { EnergyPrices } from './engine/contributors/energy'
import { useProfile } from './state/profile'
import { useSettings } from './state/policyOverride'
import { useSelection } from './state/selection'
import { ProfileForm } from './features/profile/ProfileForm'
import { CatalogGrid } from './features/catalog/CatalogGrid'
import type { FleetVehicle } from './features/catalog/CatalogGrid'
import { VehiclePage } from './features/vehicle/VehiclePage'
import { ComparePage } from './features/compare/ComparePage'
import type { CompareEntry } from './features/compare/ComparePage'
import { AdminGate } from './features/admin/AdminGate'
import { AdminPanel } from './features/admin/AdminPanel'
import fleetJson from './data/catalog/fleet-2026.json'
import { NavMenu } from './ui/NavMenu'
import type { NavItem } from './ui/NavMenu'
import {
  IconCompare, IconFleet, IconProfile, IconSettings, IconTheme,
} from './ui/Icons'

/**
 * The application shell, and the thing that composes the screens.
 *
 * Every screen owns its own state and its own tests. What lives here is only
 * what none of them can own alone: which screen is showing, which car is open,
 * and the three stores — profile, settings, comparison selection — that all of
 * them read from. Keeping those here is what stops two screens disagreeing
 * about the same number.
 */

type Screen = 'catalog' | 'vehicle' | 'compare' | 'profile' | 'admin'
type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'maslul.theme'

const TABS: readonly { id: Screen; labelHe: string; icon: () => ReactNode }[] = [
  { id: 'catalog', labelHe: 'הצי', icon: () => <IconFleet /> },
  { id: 'compare', labelHe: 'השוואה', icon: () => <IconCompare /> },
  { id: 'profile', labelHe: 'הפרופיל שלי', icon: () => <IconProfile /> },
  { id: 'admin', labelHe: 'הגדרות', icon: () => <IconSettings /> },
]

/** The catalogue is data, so it is parsed once rather than on every render. */
const FLEET: readonly FleetVehicle[] = (fleetJson.vehicles as unknown as FleetVehicle[])

export function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'),
  )
  const [screen, setScreen] = useState<Screen>('catalog')
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const profileStore = useProfile()
  const settingsStore = useSettings()
  const selection = useSelection()

  const { policy, taxRules, prices } = settingsStore.settings
  const { profile } = profileStore

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
    writeTheme(theme)
  }, [theme])

  const openVehicle = useMemo(
    () => FLEET.find(v => v.id === openVehicleId) ?? null,
    [openVehicleId],
  )

  // The comparison runs the same engine as the cards, from the same stores, so
  // a figure can never differ between the grid and the comparison table.
  const compareEntries = useMemo<CompareEntry[]>(
    () => selection.selected
      .map(id => FLEET.find(v => v.id === id))
      .filter((v): v is FleetVehicle => v !== undefined)
      .map(vehicle => ({
        vehicle: vehicle as Vehicle,
        result: calculate({
          vehicle: vehicle as Vehicle,
          employee: profile,
          policy,
          taxRules: taxRules as CalcTaxRules,
          prices: prices as EnergyPrices,
        }),
      })),
    [selection.selected, profile, policy, taxRules, prices],
  )

  const navItems = useMemo<NavItem[]>(() => TABS.map(t => ({
    id: t.id,
    labelHe: t.labelHe,
    icon: t.icon(),
    ...(t.id === 'compare' && selection.selected.length > 0
      ? { badge: String(selection.selected.length) }
      : {}),
  })), [selection.selected.length])

  function openCar(id: string): void {
    setOpenVehicleId(id)
    setScreen('vehicle')
  }

  function goTab(id: Screen): void {
    setScreen(id)
    if (id !== 'vehicle') setOpenVehicleId(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">מס<span>לול</span></div>

          <NavMenu
            items={navItems}
            activeId={screen === 'vehicle' ? 'catalog' : screen}
            onSelect={id => { goTab(id as Screen) }}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />

          <button
            type="button"
            className="icon-btn"
            aria-label="החלפת ערכת צבעים"
            onClick={() => { setTheme(current => (current === 'dark' ? 'light' : 'dark')) }}
          >
            <IconTheme />
          </button>
        </div>
      </header>

      <main className="wrap" id="main">
        {screen === 'catalog' && (
          <CatalogGrid
            vehicles={FLEET}
            profile={profile}
            policy={policy}
            taxRules={taxRules as CalcTaxRules}
            prices={prices as EnergyPrices}
            selectedId={openVehicleId}
            onSelect={openCar}
          />
        )}

        {screen === 'vehicle' && openVehicle !== null && (
          <VehiclePage
            vehicle={openVehicle}
            profile={profile}
            policy={policy}
            taxRules={taxRules as CalcTaxRules}
            prices={prices as EnergyPrices}
            onBack={() => { goTab('catalog') }}
          />
        )}

        {screen === 'compare' && (
          compareEntries.length > 0
            ? <ComparePage entries={compareEntries} onRemove={selection.toggle} />
            : <EmptyCompare onBrowse={() => { goTab('catalog') }} />
        )}

        {screen === 'profile' && (
          <ProfileForm
            profile={profile}
            onChange={profileStore.update}
            gradesToTier={policy.gradesToTier}
          />
        )}

        {screen === 'admin' && (
          <AdminGate passcode={policy.adminPasscode}>
            <AdminPanel store={settingsStore} />
          </AdminGate>
        )}
      </main>
    </>
  )
}

/** An empty comparison is an invitation, so it says what to do next. */
function EmptyCompare({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className="py-14">
      <h1 className="mb-2 text-[26px] font-bold tracking-tight">לא נבחרו רכבים להשוואה</h1>
      <p className="mb-6 text-[15px] text-[var(--soft)]">
        אפשר לבחור עד ארבעה רכבים מהצי ולראות אותם זה מול זה.
      </p>
      <button type="button" className="chip" onClick={onBrowse}>לצי</button>
    </section>
  )
}

function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* the toggle still works for this session */
  }
}
