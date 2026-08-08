import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Money, formatIls } from '../../src/ui/Money'

describe('formatIls', () => {
  it('shows whole shekels with thousands separators', () => {
    expect(formatIls(1178.4)).toBe('₪1,178')
    expect(formatIls(66492)).toBe('₪66,492')
    expect(formatIls(7)).toBe('₪7')
  })

  it('puts the minus before the currency sign', () => {
    expect(formatIls(-1178)).toBe('−₪1,178')
  })

  it('rounds a half away from zero, symmetrically', () => {
    expect(formatIls(1177.5)).toBe('₪1,178')
    expect(formatIls(-1177.5)).toBe('−₪1,178')
  })

  it('drops the sign once the figure rounds to nothing', () => {
    expect(formatIls(-0.2)).toBe('₪0')
    expect(formatIls(0)).toBe('₪0')
  })

  it('adds a plus only when asked, and never at zero', () => {
    expect(formatIls(120, 'always')).toBe('+₪120')
    expect(formatIls(-120, 'always')).toBe('−₪120')
    expect(formatIls(0, 'always')).toBe('₪0')
  })
})

describe('<Money>', () => {
  it('isolates every figure with dir="ltr"', () => {
    expect(renderToStaticMarkup(<Money value={-1178} />)).toContain('dir="ltr"')
    expect(renderToStaticMarkup(<Money value={1178} />)).toContain('dir="ltr"')
  })

  it('renders −₪1,178 in exactly that order', () => {
    const html = renderToStaticMarkup(<Money value={-1178} />)
    expect(html).toContain('−₪1,178')
    expect(html.indexOf('−')).toBeLessThan(html.indexOf('₪'))
    expect(html.indexOf('₪')).toBeLessThan(html.indexOf('1,178'))
  })

  it('uses tabular figures so columns of sums line up', () => {
    expect(renderToStaticMarkup(<Money value={1178} />)).toContain('num')
  })

  it('keeps a caller class alongside its own', () => {
    const html = renderToStaticMarkup(<Money value={1} className="amt" />)
    expect(html).toContain('amt')
    expect(html).toContain('money')
  })
})
