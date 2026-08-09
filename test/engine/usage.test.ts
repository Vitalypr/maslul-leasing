import { describe, it, expect } from 'vitest'
import { splitAnnualKm, commuteDaysAfterWfh } from '../../src/engine/usage'
import type { UsageInput } from '../../src/engine/usage'

/**
 * The split between battery and tank, which is the single biggest lever on a
 * plug-in's cost. Every assertion here is arithmetic a reader could check by
 * hand from the numbers on the vehicle screen.
 */

const base: UsageInput = {
  annualKm: 45000,
  commuteOneWayKm: 50,
  commuteDaysPerYear: 210,
  wfhDaysPerWeek: 0,
  daysPerYear: 365,
  powertrain: 'phev',
  chargesDaily: true,
  manufacturerEvRangeKm: 90,
  realEvRangeKm: 83,
  realWorldRangeFactor: 0.7,
}

const split = (over: Partial<UsageInput> = {}) => splitAnnualKm({ ...base, ...over })

describe('working from home', () => {
  it('removes one working day from each of the 42 working weeks', () => {
    expect(commuteDaysAfterWfh(210, 0)).toBe(210)
    expect(commuteDaysAfterWfh(210, 1)).toBe(168)
    expect(commuteDaysAfterWfh(210, 2)).toBe(126)
  })

  it('moves those days into the rest of the year rather than losing them', () => {
    for (const wfh of [0, 1, 2]) {
      const s = split({ wfhDaysPerWeek: wfh })
      expect(s.commuteDays + s.otherDays).toBe(365)
    }
  })

  it('is clamped, so a bad input cannot produce negative days', () => {
    expect(commuteDaysAfterWfh(210, 9)).toBe(0)
    expect(commuteDaysAfterWfh(210, -3)).toBe(210)
  })
})

describe('how the year divides', () => {
  it('gives the commute its days and everything else the rest', () => {
    const s = split()
    expect(s.commuteDays).toBe(210)
    expect(s.otherDays).toBe(155)
    expect(s.dailyCommuteKm).toBe(100)          // 50 each way
    expect(s.commuteKm).toBe(21000)             // 210 x 100
    expect(s.otherKm).toBe(24000)               // 45,000 - 21,000
    expect(s.otherDailyKm).toBeCloseTo(154.84, 2)
  })

  it('never invents kilometres the employee did not drive', () => {
    // A 60 km each-way commute over 210 days is 25,200 km, but only 15,000
    // were driven all year. The annual total is what the lease is written
    // against, so the commute gives way.
    const s = split({ annualKm: 15000, commuteOneWayKm: 60 })
    expect(s.commuteKm).toBe(15000)
    expect(s.otherKm).toBe(0)
    expect(s.dailyCommuteKm).toBeCloseTo(71.43, 2)
    expect(s.evKm + s.iceKm).toBe(15000)
  })

  it('puts everything in the other bucket when there is no commute', () => {
    const s = split({ commuteOneWayKm: 0 })
    expect(s.commuteKm).toBe(0)
    expect(s.otherKm).toBe(45000)
    expect(s.otherDailyKm).toBeCloseTo(290.32, 2)
  })
})

describe('one charge a day', () => {
  it('takes a full battery from every day of the year when both exceed it', () => {
    // 100 km commute and 155 km other, both over the 83 km range, so every one
    // of the 365 days contributes exactly one charge.
    const s = split()
    expect(s.evFromCommute).toBe(210 * 83)
    expect(s.evFromOther).toBe(155 * 83)
    expect(s.evKm).toBe(365 * 83)               // 30,295
    expect(s.iceKm).toBe(45000 - 30295)         // 14,705
  })

  it('never exceeds one battery a day, whatever the arrangement', () => {
    const ceiling = 365 * 83
    for (const annualKm of [5000, 20000, 45000, 90000, 200000])
      for (const oneWay of [0, 5, 25, 60, 400])
        for (const wfh of [0, 1, 2]) {
          const s = split({ annualKm, commuteOneWayKm: oneWay, wfhDaysPerWeek: wfh })
          expect(s.evKm, `${annualKm}km ${oneWay}each-way wfh${wfh}`)
            .toBeLessThanOrEqual(ceiling + 0.011)
        }
  })

  it('takes only what was driven when the day is shorter than the battery', () => {
    // 12,000 km a year, 30 km each way: 210 x 60 = 12,600 > 12,000, so the
    // commute absorbs everything and each day is under the battery.
    const s = split({ annualKm: 12000, commuteOneWayKm: 30 })
    expect(s.evKm).toBe(12000)
    expect(s.iceKm).toBe(0)
  })

  it('charges nothing to the battery when the employee cannot charge', () => {
    const s = split({ chargesDaily: false })
    expect(s.evKm).toBe(0)
    expect(s.iceKm).toBe(45000)
  })
})

describe('the other powertrains', () => {
  it('runs a battery car entirely on electricity', () => {
    const s = split({ powertrain: 'bev' })
    expect(s.evKm).toBe(45000)
    expect(s.iceKm).toBe(0)
  })

  it('runs everything else entirely on petrol, charging or not', () => {
    for (const powertrain of ['ice', 'mhev', 'hybrid'] as const)
      for (const chargesDaily of [true, false]) {
        const s = split({ powertrain, chargesDaily })
        expect(s.evKm, powertrain).toBe(0)
        expect(s.iceKm, powertrain).toBe(45000)
      }
  })
})

describe('the range it uses', () => {
  it('prefers the measured figure over the manufacturer claim', () => {
    expect(split().effectiveEvRangeKm).toBe(83)
  })

  it('discounts the manufacturer claim when nothing was measured', () => {
    expect(split({ realEvRangeKm: null }).effectiveEvRangeKm).toBe(63)  // 90 x 0.7
  })

  it('never lets a longer range shorten the electric distance', () => {
    let previous = -1
    for (const realEvRangeKm of [10, 30, 60, 83, 120, 300]) {
      const s = split({ realEvRangeKm })
      expect(s.evKm).toBeGreaterThanOrEqual(previous)
      previous = s.evKm
    }
  })
})

describe('what must always hold', () => {
  const cases: UsageInput[] = []
  for (const annualKm of [0, 1200, 15000, 30000, 45000, 80000])
    for (const commuteOneWayKm of [0, 8, 34, 75])
      for (const wfhDaysPerWeek of [0, 1, 2])
        for (const realEvRangeKm of [40, 83, null])
          for (const chargesDaily of [true, false])
            cases.push({ ...base, annualKm, commuteOneWayKm, wfhDaysPerWeek, realEvRangeKm, chargesDaily })

  it('always splits the year exactly, with nothing lost or created', () => {
    for (const c of cases) {
      const s = splitAnnualKm(c)
      expect(s.evKm + s.iceKm, JSON.stringify(c)).toBeCloseTo(c.annualKm, 2)
      expect(s.commuteKm + s.otherKm).toBeCloseTo(c.annualKm, 2)
      expect(s.commuteDays + s.otherDays).toBe(365)
    }
  })

  it('never produces a negative distance', () => {
    for (const c of cases) {
      const s = splitAnnualKm(c)
      for (const [k, v] of Object.entries(s))
        expect(v as number, `${k} in ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('never lets more driving mean less electricity', () => {
    for (const commuteOneWayKm of [0, 34, 75])
      for (const wfhDaysPerWeek of [0, 1, 2]) {
        let previous = -1
        for (const annualKm of [0, 5000, 12000, 25000, 40000, 60000]) {
          const s = split({ annualKm, commuteOneWayKm, wfhDaysPerWeek })
          expect(s.evKm, `${annualKm}km ${commuteOneWayKm}each-way`)
            .toBeGreaterThanOrEqual(previous - 0.011)
          previous = s.evKm
        }
      }
  })

  it('survives a year with no driving at all', () => {
    const s = split({ annualKm: 0 })
    expect(s.evKm).toBe(0)
    expect(s.iceKm).toBe(0)
    expect(s.otherDailyKm).toBe(0)
  })
})
