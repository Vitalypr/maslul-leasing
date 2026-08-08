import { describe, it, expect } from 'vitest'
import { forgoneLines, applyCap } from '../../src/engine/forgone'
import type { ForgoneContext } from '../../src/engine/forgone'
import { splitByTreatment } from '../../src/engine/money'

/**
 * The forgone side is the only place where policy states a ceiling and the
 * employee states the amount. Two things must hold: the reimbursement is the
 * lower of the two, and the gross payslip component is not priced like the
 * grossed-up ones.
 */

const policy: ForgoneContext['policy'] = {
  forgone: {
    licenseFeeAnnual: {
      enabled: true, employeeEnters: true, annualCap: 1941,
      labelHe: 'החזר אגרת רישוי',
    },
    privateInsuranceAnnual: {
      enabled: true, employeeEnters: true, annualCap: 7000,
      labelHe: 'החזר ביטוח רכב פרטי',
    },
    serviceVehicleTierC: {
      enabled: true, employeeEnters: true, suggested: 570,
      labelHe: "רכב שירות ג'",
    },
    fixedNetAllowance: {
      enabled: true, employeeEnters: true, suggested: 318,
      labelHe: 'קבועות נטו',
    },
    variableNetAllowance: {
      enabled: true, employeeEnters: true, suggested: 408,
      labelHe: 'משת.רגי.נטו',
    },
  },
  taxTreatment: {
    forgoneLicenseFee: 'grossedUp',
    forgoneInsurance: 'grossedUp',
    forgoneServiceVehicleTierC: 'gross',
    forgoneFixedNet: 'grossedUp',
    forgoneVariableNet: 'grossedUp',
  },
}

const employee = (over: Partial<ForgoneContext['employee']> = {})
: ForgoneContext['employee'] => ({
  receivesLicenseFee: true,
  receivesPrivateInsurance: true,
  receivesServiceVehicleTierC: true,
  receivesFixedNet: true,
  receivesVariableNet: true,
  licenseFeeAnnualPaid: 1500,
  privateInsuranceAnnualPaid: 4200,
  serviceVehicleTierCMonthly: 570,
  fixedNetMonthly: 318,
  variableNetMonthly: 408,
  ...over,
})

const ctx = (over: Partial<ForgoneContext['employee']> = {}): ForgoneContext =>
  ({ policy, employee: employee(over) })

const byId = (c: ForgoneContext) =>
  Object.fromEntries(forgoneLines(c).map(l => [l.id, l.annualAmount]))

describe('applyCap', () => {
  it('returns what was paid when it is under the ceiling', () => {
    expect(applyCap(1500, 1941)).toBe(1500)
  })
  it('returns the ceiling when what was paid exceeds it', () => {
    expect(applyCap(2400, 1941)).toBe(1941)
  })
  it('leaves an uncapped component alone', () => {
    expect(applyCap(9999, null)).toBe(9999)
    expect(applyCap(9999, undefined)).toBe(9999)
  })
  it('never returns a negative reimbursement', () => {
    expect(applyCap(-50, 1941)).toBe(0)
  })
})

describe('forgoneLines', () => {
  it('lists every benefit the employee receives', () => {
    expect(forgoneLines(ctx()).map(l => l.id).sort()).toEqual([
      'forgoneFixedNet', 'forgoneInsurance', 'forgoneLicenseFee',
      'forgoneServiceVehicleTierC', 'forgoneVariableNet',
    ])
  })

  it('uses the employee figure, annualising the monthly ones', () => {
    const b = byId(ctx())
    expect(b['forgoneLicenseFee']).toBe(1500)          // under the 1,941 cap
    expect(b['forgoneInsurance']).toBe(4200)           // under the 7,000 cap
    expect(b['forgoneServiceVehicleTierC']).toBe(6840) // 570 x 12
    expect(b['forgoneFixedNet']).toBe(3816)            // 318 x 12
    expect(b['forgoneVariableNet']).toBe(4896)         // 408 x 12
  })

  it('caps the licence fee at 1,941 a year', () => {
    expect(byId(ctx({ licenseFeeAnnualPaid: 2600 }))['forgoneLicenseFee']).toBe(1941)
  })

  it('caps the insurance at 7,000 a year', () => {
    expect(byId(ctx({ privateInsuranceAnnualPaid: 9500 }))['forgoneInsurance']).toBe(7000)
  })

  it('says in the trace when a figure was capped', () => {
    const line = forgoneLines(ctx({ privateInsuranceAnnualPaid: 9500 }))
      .find(l => l.id === 'forgoneInsurance')!
    expect(line.trace.formulaHe).toContain('9500')
    expect(line.trace.formulaHe).toContain('תקרה')
  })

  it('omits a benefit the employee does not receive', () => {
    expect(byId(ctx({ receivesServiceVehicleTierC: false }))['forgoneServiceVehicleTierC'])
      .toBeUndefined()
  })

  it('omits a benefit whose amount is still zero', () => {
    expect(byId(ctx({ fixedNetMonthly: 0 }))['forgoneFixedNet']).toBeUndefined()
  })

  /**
   * The whole reason the components are held apart. Losing a gross salary
   * component also lowers taxable income, so it costs less than face value.
   * Losing a grossed-up reimbursement costs exactly face value.
   */
  it('separates the gross component from the grossed-up ones', () => {
    const r = splitByTreatment(forgoneLines(ctx()))
    expect(r.cash).toBe(21252)          // 1500 + 4200 + 6840 + 3816 + 4896
    expect(r.taxableDelta).toBe(-6840)  // only רכב שירות ג' moves taxable income
  })

  it('leaves taxable income alone when only grossed-up items are lost', () => {
    const r = splitByTreatment(forgoneLines(ctx({ receivesServiceVehicleTierC: false })))
    expect(r.cash).toBe(14412)
    expect(r.taxableDelta).toBe(0)
  })

  it('produces nothing when the employee receives none of them', () => {
    expect(forgoneLines(ctx({
      receivesLicenseFee: false, receivesPrivateInsurance: false,
      receivesServiceVehicleTierC: false, receivesFixedNet: false,
      receivesVariableNet: false,
    }))).toEqual([])
  })
})
