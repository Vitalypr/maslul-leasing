import { describe, it, expect } from 'vitest'
import { round2 } from '../../src/engine/round'

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(644.785)).toBe(644.79)
    expect(round2(214.785)).toBe(214.79)
  })
  it('avoids binary floating point drift', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
  it('handles negatives symmetrically', () => {
    expect(round2(-644.785)).toBe(-644.79)
  })
  it('leaves whole numbers alone', () => {
    expect(round2(430)).toBe(430)
  })
})
