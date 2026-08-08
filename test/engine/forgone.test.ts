import { describe, it, expect } from 'vitest'
import { forgoneLines, type ForgoneContext } from '../../src/engine/forgone'
import { splitByTreatment } from '../../src/engine/money'

type Employee = ForgoneContext['employee']
type Forgone = ForgoneContext['policy']['forgone']

const ctx = (
  employeeOver: Partial<Employee> = {},
  forgoneOver: Partial<Forgone> = {},
): ForgoneContext => ({
  policy: {
    forgone: {
      licenseFeeAnnual: { annual: 1800, enabled: true },
      privateInsuranceAnnual: { annual: 7000, enabled: true },
      serviceVehicleTierC: { monthly: 1200, enabled: true },
      fixedNetAllowance: { monthly: 900, enabled: true },
      variableNetAllowance: { monthly: 400, enabled: true },
      ...forgoneOver,
    },
    taxTreatment: {
      forgoneLicenseFee: 'grossedUp',
      forgoneInsurance: 'grossedUp',
      forgoneServiceVehicleTierC: 'gross',
      forgoneFixedNet: 'grossedUp',
      forgoneVariableNet: 'grossedUp',
    },
  },
  employee: {
    receivesLicenseFee: true,
    receivesPrivateInsurance: true,
    receivesServiceVehicleTierC: true,
    receivesFixedNet: true,
    receivesVariableNet: true,
    ...employeeOver,
  },
})

describe('forgoneLines', () => {
  it('lists every benefit the employee currently receives', () => {
    expect(forgoneLines(ctx()).map(l => l.id).sort()).toEqual([
      'forgoneFixedNet', 'forgoneInsurance', 'forgoneLicenseFee',
      'forgoneServiceVehicleTierC', 'forgoneVariableNet',
    ])
  })

  it('states each as an annual cost to the employee', () => {
    const byId = Object.fromEntries(
      forgoneLines(ctx()).map(l => [l.id, l.annualAmount]))
    expect(byId.forgoneLicenseFee).toBe(1800)
    expect(byId.forgoneInsurance).toBe(7000)
    expect(byId.forgoneServiceVehicleTierC).toBe(14400)
    expect(byId.forgoneFixedNet).toBe(10800)
    expect(byId.forgoneVariableNet).toBe(4800)
  })

  it('omits a benefit the employee does not receive', () => {
    const lines = forgoneLines(ctx({ receivesServiceVehicleTierC: false }))
    expect(lines.find(l => l.id === 'forgoneServiceVehicleTierC')).toBeUndefined()
  })

  it('omits a component switched off or left at zero in policy', () => {
    const off = forgoneLines(ctx({}, {
      serviceVehicleTierC: { monthly: 1200, enabled: false },
    }))
    expect(off.find(l => l.id === 'forgoneServiceVehicleTierC')).toBeUndefined()

    const zero = forgoneLines(ctx({}, {
      licenseFeeAnnual: { annual: 0, enabled: true },
    }))
    expect(zero.find(l => l.id === 'forgoneLicenseFee')).toBeUndefined()
  })

  /**
   * The whole reason the components are split. Losing a gross salary component
   * also lowers taxable income, so it costs less than its face value. Losing a
   * grossed-up reimbursement costs exactly its face value.
   */
  it('separates the gross component from the grossed-up ones', () => {
    const r = splitByTreatment(forgoneLines(ctx()))
    expect(r.cash).toBe(38800)          // 1800 + 7000 + 14400 + 10800 + 4800
    expect(r.taxableDelta).toBe(-14400) // only רכב שירות ג' moves taxable income
  })

  it('leaves taxable income alone when only grossed-up items are lost', () => {
    const r = splitByTreatment(forgoneLines(ctx({ receivesServiceVehicleTierC: false })))
    expect(r.cash).toBe(24400)
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
