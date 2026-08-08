import { describe, it, expect } from 'vitest'
/* Read as text, for the same reason test/ui/tokens.test.ts does: vitest stubs
   CSS imports, so a ?raw import would come back empty, and these assertions are
   about what actually ships in the stylesheet. */
// @ts-expect-error node:fs is untyped in this project: no @types/node is installed
import { readFileSync } from 'node:fs'

const read = (path: string): string => readFileSync(path, 'utf8')

const css = read('src/index.css')

/** Everything between `selector{` and the next `}`. */
function block(source: string, selector: string): string {
  const at = source.indexOf(selector)
  if (at < 0) throw new Error(`missing block: ${selector}`)
  const open = source.indexOf('{', at)
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

/** The body of a media query, braces balanced rather than counted. */
function media(source: string, query: string): string {
  const at = source.indexOf(query)
  if (at < 0) throw new Error(`missing media query: ${query}`)
  let depth = 0
  const open = source.indexOf('{', at)
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`unterminated media query: ${query}`)
}

describe('breakpoints', () => {
  it('sets the two the design names, so every utility lands on them', () => {
    expect(css).toMatch(/--breakpoint-sm:\s*768px/)
    expect(css).toMatch(/--breakpoint-lg:\s*1180px/)
  })

  it('holds the page to the desktop breakpoint', () => {
    expect(block(css, '.wrap{')).toMatch(/max-width:\s*1180px/)
  })

  it('has a band below the tablet breakpoint to write the phone against', () => {
    expect(() => media(css, '@media (max-width:767px)')).not.toThrow()
  })
})

describe('the body never scrolls sideways', () => {
  it('clips the document rather than letting it pan', () => {
    // clip, not hidden: hidden makes the element a scroll container, which
    // breaks the sticky top bar.
    expect(css).toMatch(/html,\s*body\{[^}]*overflow-x:\s*clip/)
  })

  it('gives wide content a scroller of its own', () => {
    expect(block(css, '.scroll-x{')).toMatch(/overflow-x:\s*auto/)
    expect(block(css, '.scroll-x{')).toMatch(/max-inline-size:\s*100%/)
  })

  it('lets a long formula scroll inside its own box', () => {
    expect(block(css, '.trace code{')).toMatch(/overflow-x:\s*auto/)
  })
})

describe('touch targets', () => {
  const at44 = (selector: string) => {
    const rule = block(css, selector)
    expect(rule, selector).toMatch(/(min-height|height|min-block-size):\s*44px/)
  }

  it('gives every control a thumb 44px to land on', () => {
    at44('.icon-btn{')
    at44('.line-btn{')
    at44('.chip{')
    at44('.seg-btn{')
    at44('.field-input,.field-select{')
  })
})

describe('the phone layout', () => {
  const phone = media(css, '@media (max-width:767px)')

  it('puts one vehicle card in a row', () => {
    expect(phone).toMatch(/\.catalog-grid\{[^}]*grid-template-columns:\s*1fr/)
  })

  it('puts the ledger in a single column', () => {
    expect(phone).toMatch(/\.ledger\{[^}]*grid-template-columns:\s*1fr/)
  })

  it('trims the page gutter for a 390px screen', () => {
    expect(phone).toMatch(/\.wrap\{[^}]*padding:\s*0 16px/)
  })
})

describe('the bottom bar', () => {
  it('pins itself to the end of the viewport', () => {
    const bar = block(css, '.bottombar{')
    expect(bar).toMatch(/position:\s*fixed/)
    expect(bar).toMatch(/inset-block-end:\s*0/)
    expect(bar).toMatch(/inset-inline:\s*0/)
  })

  it('leaves room so it cannot cover the last row of the page', () => {
    expect(media(css, '@media (max-width:767px)'))
      .toMatch(/\.bottombar-space\{[^}]*block-size:/)
  })

  it('is a phone control and disappears at the tablet breakpoint', () => {
    expect(media(css, '@media (min-width:768px)'))
      .toMatch(/\.bottombar\{[^}]*display:\s*none/)
  })
})
