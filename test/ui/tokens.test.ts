import { describe, it, expect } from 'vitest'
/* Read as text. A ?raw import would come back empty here — vitest stubs CSS —
   and these assertions are about what actually ships in the stylesheet. */
// @ts-expect-error node:fs is untyped in this project: no @types/node is installed
import { readFileSync } from 'node:fs'

/** Relative to the repository root, which is where vitest runs. */
const read = (path: string): string => readFileSync(path, 'utf8')

const tokens = read('src/ui/tokens.css')
const base = read('src/index.css')
const html = read('index.html')

/** Everything between `selector{` and the next `}`. */
function block(css: string, selector: string): string {
  const at = css.indexOf(selector)
  if (at < 0) throw new Error(`missing block: ${selector}`)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

/** Custom properties whose value is a literal colour. */
function colourTokens(css: string): string[] {
  return [...css.matchAll(/(--[\w-]+)\s*:\s*#[0-9a-fA-F]{3,8}\s*;/g)]
    .map(m => m[1] as string)
    .sort()
}

const light = colourTokens(block(tokens, ':root{'))
const dark = colourTokens(block(tokens, ':root[data-theme="dark"]{'))

describe('design tokens', () => {
  it('defines a light palette at all', () => {
    expect(light.length).toBeGreaterThan(10)
  })

  it('defines every colour token in both themes', () => {
    expect(dark).toEqual(light)
  })

  it('carries the powertrain colours the catalogue needs', () => {
    for (const pt of ['--pt-ice', '--pt-hybrid', '--pt-phev', '--pt-bev']) {
      expect(light).toContain(pt)
    }
  })

  it('uses Heebo for text and IBM Plex Mono for formula traces', () => {
    expect(tokens).toMatch(/--ui:\s*"Heebo"/)
    expect(tokens).toMatch(/--display:\s*"Heebo"/)
    expect(tokens).toMatch(/--mono:\s*"IBM Plex Mono"/)
  })

  it('has no shadows and no gradients, in either stylesheet', () => {
    for (const css of [tokens, base]) {
      expect(css).not.toMatch(/box-shadow/)
      expect(css).not.toMatch(/text-shadow/)
      expect(css).not.toMatch(/gradient\(/)
    }
  })

  it('uses logical properties only — never left or right', () => {
    for (const css of [tokens, base]) {
      expect(css).not.toMatch(/[^-\w](margin|padding|border)-(left|right)\s*:/)
      expect(css).not.toMatch(/[^-\w](left|right)\s*:/)
    }
  })
})

describe('document shell', () => {
  it('is Hebrew and right-to-left', () => {
    expect(html).toMatch(/<html[^>]+lang="he"/)
    expect(html).toMatch(/<html[^>]+dir="rtl"/)
  })

  it('loads Heebo 300-900 and IBM Plex Mono from Google Fonts', () => {
    expect(html).toContain('fonts.googleapis.com')
    expect(html).toMatch(/Heebo:wght@300\.\.900/)
    expect(html).toMatch(/IBM\+Plex\+Mono:wght@400;500/)
  })
})
