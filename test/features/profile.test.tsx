import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileForm } from '../../src/features/profile/ProfileForm'
import { DEFAULT_PROFILE, type Profile } from '../../src/state/profile'

/**
 * The test environment is node, not jsdom, so these assert the markup the form
 * produces rather than what happens when it is clicked. That is enough to hold
 * the two rules this screen has to obey — one label per control, and an
 * unverified source is marked — and it is the whole of what the environment
 * allows without a config change this task may not make.
 */

const emptyGrades = { verified: false, map: {} }
const filledGrades = {
  verified: true,
  map: { '40': 'C', '41': 'C', '42': 'D' } as Record<string, 'C' | 'D'>,
}

const render = (profile: Profile = DEFAULT_PROFILE, grades = emptyGrades) =>
  renderToStaticMarkup(
    <ProfileForm profile={profile} onChange={() => {}} gradesToTier={grades} />,
  )

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0

describe('<ProfileForm>', () => {
  it('gives every control exactly one label and no second sentence', () => {
    const html = render()
    const controls = count(html, /<input/g) + count(html, /<select/g)
    expect(controls).toBeGreaterThan(10)
    expect(count(html, /<label/g)).toBe(controls)
    expect(html).not.toContain('<p')
  })

  it('binds every non-checkbox control to its label by id', () => {
    const html = render()
    for (const id of [
      'grossMonthlySalary', 'creditPoints', 'serviceTier', 'commuteOneWayKm',
      'workDaysPerMonth', 'annualKm', 'monthlyFuelBudgetIce',
      'monthlyFuelBudgetElectrified',
    ]) {
      expect(html, id).toContain(`for="${id}"`)
      expect(html, id).toContain(`id="${id}"`)
    }
  })

  it('shows the values it was given', () => {
    const html = render({
      ...DEFAULT_PROFILE,
      grossMonthlySalary: 31000,
      annualKm: 18000,
      monthlyFuelBudgetIce: 1200,
      monthlyFuelBudgetElectrified: 700,
    })
    expect(html).toContain('value="31000"')
    expect(html).toContain('value="18000"')
    expect(html).toContain('value="1200"')
    expect(html).toContain('value="700"')
  })

  it('falls back to a manual tier picker, marked unverified, while the grade map is empty', () => {
    const html = render()
    expect(html).toContain('for="serviceTier"')
    expect(html).toContain('לא אומת')
    expect(html).not.toContain('for="grade"')
  })

  it('picks the tier through the grade once the map is populated', () => {
    const html = render(DEFAULT_PROFILE, filledGrades)
    expect(html).toContain('for="grade"')
    expect(html).toContain('>42<')
    expect(html).not.toContain('for="serviceTier"')
  })

  it('still marks the grade picker when the map itself is unverified', () => {
    const unverifiedMap = { verified: false, map: filledGrades.map }
    expect(render(DEFAULT_PROFILE, unverifiedMap)).toContain('לא אומת')
    expect(render(DEFAULT_PROFILE, filledGrades)).not.toContain('לא אומת')
  })

  it('reflects the checkbox flags rather than defaulting them on', () => {
    const off = render()
    expect(count(off, /checked=""/g)).toBe(1)          // chargesDaily alone

    const on = render({
      ...DEFAULT_PROFILE,
      rambiEligible: true,
      receivesLicenseFee: true,
      receivesPrivateInsurance: true,
      receivesServiceVehicleTierC: true,
      receivesFixedNet: true,
      receivesVariableNet: true,
    })
    expect(count(on, /checked=""/g)).toBe(7)
  })

  it('offers a box for each of the five payslip components, not one lumped field', () => {
    const html = render()
    for (const id of [
      'receivesLicenseFee', 'receivesPrivateInsurance',
      'receivesServiceVehicleTierC', 'receivesFixedNet', 'receivesVariableNet',
    ]) {
      expect(html, id).toContain(`id="${id}"`)
    }
  })
})
