import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PROFILE, PROFILE_STORAGE_KEY, parseProfile, serializeProfile,
} from '../../src/state/profile'

describe('parseProfile', () => {
  it('falls back to the defaults when nothing is stored', () => {
    expect(parseProfile(null)).toEqual(DEFAULT_PROFILE)
    expect(parseProfile('')).toEqual(DEFAULT_PROFILE)
  })

  it('falls back to the defaults when the store holds junk', () => {
    expect(parseProfile('not json')).toEqual(DEFAULT_PROFILE)
    expect(parseProfile('[1,2,3]')).toEqual(DEFAULT_PROFILE)
    expect(parseProfile('null')).toEqual(DEFAULT_PROFILE)
  })

  it('takes the fields it recognises and defaults the rest', () => {
    const p = parseProfile('{"grossMonthlySalary":31000,"serviceTier":"D"}')
    expect(p.grossMonthlySalary).toBe(31000)
    expect(p.serviceTier).toBe('D')
    expect(p.workDaysPerMonth).toBe(DEFAULT_PROFILE.workDaysPerMonth)
  })

  it('rejects a value of the wrong type rather than carrying it into the engine', () => {
    const p = parseProfile('{"grossMonthlySalary":"31000","chargesDaily":"yes"}')
    expect(p.grossMonthlySalary).toBe(DEFAULT_PROFILE.grossMonthlySalary)
    expect(p.chargesDaily).toBe(DEFAULT_PROFILE.chargesDaily)
  })

  it('rejects numbers that cannot be money or distance', () => {
    expect(parseProfile('{"annualKm":-5}').annualKm)
      .toBe(DEFAULT_PROFILE.annualKm)
    expect(parseProfile('{"creditPoints":null}').creditPoints)
      .toBe(DEFAULT_PROFILE.creditPoints)
  })

  it('rejects a service tier outside C and D', () => {
    expect(parseProfile('{"serviceTier":"E"}').serviceTier).toBe('C')
  })

  it('drops keys it does not know', () => {
    expect(parseProfile('{"homeAddress":"רחוב הרצל 1"}'))
      .toEqual(DEFAULT_PROFILE)
  })

  it('round-trips', () => {
    const edited = { ...DEFAULT_PROFILE, grossMonthlySalary: 41250, rambiEligible: true }
    expect(parseProfile(serializeProfile(edited))).toEqual(edited)
  })
})

describe('the storage contract', () => {
  it('is namespaced and versioned, so a shape change cannot resurrect old data', () => {
    expect(PROFILE_STORAGE_KEY).toMatch(/^maslul\.profile\.v\d+$/)
  })
})
