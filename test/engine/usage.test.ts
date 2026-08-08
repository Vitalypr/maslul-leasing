import { describe, it, expect } from 'vitest'
import { splitAnnualKm } from '../../src/engine/usage'

const base = {
  annualKm: 26000, commuteOneWayKm: 34, workDaysPerMonth: 21,
  chargesDaily: true, manufacturerEvRangeKm: 58,
  realEvRangeKm: null, realWorldRangeFactor: 0.70,
}

describe('splitAnnualKm', () => {
  it('puts every km on petrol for an ICE car', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'ice' })
    expect(r.iceKm).toBe(26000)
    expect(r.evKm).toBe(0)
  })

  it('puts every km on electricity for a BEV', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'bev' })
    expect(r.evKm).toBe(26000)
    expect(r.iceKm).toBe(0)
  })

  it('derives the real EV range from the factor', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    expect(r.effectiveEvRangeKm).toBe(40.6)   // 58 * 0.70
  })

  it('prefers a per-model real range over the factor', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', realEvRangeKm: 45 })
    expect(r.effectiveEvRangeKm).toBe(45)
  })

  it('runs the daily commute on electricity up to the range, rest on petrol', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    // 68 km/day, 252 workdays => 17,136 km of daily driving
    expect(r.dailyCommuteKm).toBe(68)
    expect(r.workDaysPerYear).toBe(252)
    expect(r.dailyPortionKm).toBe(17136)
    // 26,000 - 17,136 = 8,864 km of long trips, all petrol
    expect(r.longTripKm).toBe(8864)
    // 40.6 EV km/day * 252 = 10,231.2
    expect(r.evKm).toBeCloseTo(10231.2, 1)
    expect(r.iceKm).toBeCloseTo(26000 - 10231.2, 1)
  })

  it('never splits more kilometres than were driven', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    expect(r.evKm + r.iceKm).toBeCloseTo(26000, 2)
  })

  it('caps the daily EV share at the daily distance, not the range', () => {
    // 5 km commute, 40.6 km of range — only 10 km/day can be electric
    const r = splitAnnualKm({ ...base, powertrain: 'phev', commuteOneWayKm: 5 })
    expect(r.evKm).toBeCloseTo(10 * 252, 1)
  })

  it('runs a plug-in entirely on petrol when the driver will not charge', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', chargesDaily: false })
    expect(r.evKm).toBe(0)
    expect(r.iceKm).toBe(26000)
  })

  it('clamps long trips at zero when commuting exceeds annual km', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', annualKm: 10000 })
    expect(r.longTripKm).toBe(0)
    expect(r.evKm + r.iceKm).toBeCloseTo(10000, 2)
  })
})
