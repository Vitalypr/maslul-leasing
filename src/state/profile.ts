import { useCallback, useEffect, useState } from 'react'
import type { Employee } from '../engine/calculate'
import type { ServiceTier } from '../engine/contributors/leaseSupplement'

/**
 * The employee profile — salary, commute distance, everything the calculation
 * is personal about.
 *
 * It lives in localStorage and nowhere else. There is no server in this app and
 * no request that carries any of it: a gross salary and a home-to-work distance
 * are the two facts a person is least willing to hand over, and the honest way
 * to promise they stay on the device is to have nothing that could send them.
 */
export type Profile = Employee

/** Versioned, so a change to the shape cannot resurrect an incompatible blob. */
export const PROFILE_STORAGE_KEY = 'maslul.profile.v1'

/**
 * The starting point, matching the basis of the approved prototype. These are
 * a first screen the reader immediately edits, not a claim about anyone.
 */
export const DEFAULT_PROFILE: Profile = {
  grossMonthlySalary: 28400,
  creditPoints: 2.25,
  serviceTier: 'C',
  commuteOneWayKm: 34,
  workDaysPerMonth: 21,
  annualKm: 26000,
  rambiEligible: false,
  chargesDaily: true,
  monthlyFuelBudgetIce: 0,
  monthlyFuelBudgetElectrified: 0,
  receivesLicenseFee: false,
  receivesPrivateInsurance: false,
  receivesServiceVehicleTierC: false,
  receivesFixedNet: false,
  receivesVariableNet: false,
  /* The forgone amounts start empty on purpose: a suggested figure shown as a
     hint is guidance, the same figure prefilled as a value is a claim about
     this person's payslip that nobody made. */
  licenseFeeAnnualPaid: 0,
  privateInsuranceAnnualPaid: 0,
  serviceVehicleTierCMonthly: 0,
  fixedNetMonthly: 0,
  variableNetMonthly: 0,
  installsCharger: false,
  chargerInstallCost: 0,
}

/**
 * Reads a stored profile field by field.
 *
 * Anything missing, of the wrong type, or negative falls back to its default
 * rather than reaching the engine: a salary of "31000" as a string would make
 * every bracket comparison silently false, and the result would look like a
 * calculation instead of a bug.
 */
export function parseProfile(raw: string | null): Profile {
  const o = readObject(raw)
  if (o === null) return { ...DEFAULT_PROFILE }
  const d = DEFAULT_PROFILE
  return {
    grossMonthlySalary: num(o['grossMonthlySalary'], d.grossMonthlySalary),
    creditPoints: num(o['creditPoints'], d.creditPoints),
    serviceTier: tier(o['serviceTier']),
    commuteOneWayKm: num(o['commuteOneWayKm'], d.commuteOneWayKm),
    workDaysPerMonth: num(o['workDaysPerMonth'], d.workDaysPerMonth),
    annualKm: num(o['annualKm'], d.annualKm),
    rambiEligible: bool(o['rambiEligible'], d.rambiEligible),
    chargesDaily: bool(o['chargesDaily'], d.chargesDaily),
    monthlyFuelBudgetIce: num(o['monthlyFuelBudgetIce'], d.monthlyFuelBudgetIce),
    monthlyFuelBudgetElectrified:
      num(o['monthlyFuelBudgetElectrified'], d.monthlyFuelBudgetElectrified),
    receivesLicenseFee: bool(o['receivesLicenseFee'], d.receivesLicenseFee),
    receivesPrivateInsurance: bool(o['receivesPrivateInsurance'], d.receivesPrivateInsurance),
    receivesServiceVehicleTierC:
      bool(o['receivesServiceVehicleTierC'], d.receivesServiceVehicleTierC),
    receivesFixedNet: bool(o['receivesFixedNet'], d.receivesFixedNet),
    receivesVariableNet: bool(o['receivesVariableNet'], d.receivesVariableNet),
    licenseFeeAnnualPaid: num(o['licenseFeeAnnualPaid'], d.licenseFeeAnnualPaid),
    privateInsuranceAnnualPaid:
      num(o['privateInsuranceAnnualPaid'], d.privateInsuranceAnnualPaid),
    serviceVehicleTierCMonthly:
      num(o['serviceVehicleTierCMonthly'], d.serviceVehicleTierCMonthly),
    fixedNetMonthly: num(o['fixedNetMonthly'], d.fixedNetMonthly),
    variableNetMonthly: num(o['variableNetMonthly'], d.variableNetMonthly),
    installsCharger: bool(o['installsCharger'], d.installsCharger),
    chargerInstallCost: num(o['chargerInstallCost'], d.chargerInstallCost),
  }
}

export function serializeProfile(profile: Profile): string {
  return JSON.stringify(profile)
}

export type ProfileStore = {
  profile: Profile
  /** Merges a change; every field not named keeps its value. */
  update: (patch: Partial<Profile>) => void
  reset: () => void
}

export function useProfile(): ProfileStore {
  const [profile, setProfile] = useState<Profile>(() => parseProfile(readStored()))

  useEffect(() => { writeStored(serializeProfile(profile)) }, [profile])

  const update = useCallback((patch: Partial<Profile>) => {
    setProfile(current => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback(() => { setProfile({ ...DEFAULT_PROFILE }) }, [])

  return { profile, update, reset }
}

function readObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === '') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/** Money, distance and days are all non-negative and all finite. */
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback

const tier = (v: unknown): ServiceTier =>
  v === 'C' || v === 'D' ? v : DEFAULT_PROFILE.serviceTier

/* Storage can throw — Safari in private mode does. A profile that fails to
   persist is worth less than one that takes the app down with it. */
function readStored(): string | null {
  try {
    return window.localStorage.getItem(PROFILE_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string): void {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, value)
  } catch {
    /* nothing to do: the session still works, it just will not survive a reload */
  }
}
