import { describe, it, expect } from 'vitest'
import {
  MAX_SELECTION, parseSelection, selectionToSearch,
} from '../../src/state/selection'

describe('parseSelection', () => {
  it('is empty when the link carries no selection', () => {
    expect(parseSelection('')).toEqual([])
    expect(parseSelection('?tab=compare')).toEqual([])
  })

  it('reads the ids in the order they were written', () => {
    expect(parseSelection('?v=kia-niro-hybrid-lx,skoda-octavia-selection'))
      .toEqual(['kia-niro-hybrid-lx', 'skoda-octavia-selection'])
  })

  it('drops duplicates and blanks', () => {
    expect(parseSelection('?v=a,,b,a,')).toEqual(['a', 'b'])
  })

  it('never returns more than the comparison can show', () => {
    expect(parseSelection('?v=a,b,c,d,e,f')).toHaveLength(MAX_SELECTION)
  })
})

describe('selectionToSearch', () => {
  it('writes the ids as one readable, unescaped list', () => {
    expect(selectionToSearch(['a', 'b'])).toBe('?v=a,b')
  })

  it('keeps every other parameter in the link', () => {
    expect(selectionToSearch(['a'], '?tab=compare')).toBe('?tab=compare&v=a')
  })

  it('removes the parameter entirely when nothing is selected', () => {
    expect(selectionToSearch([], '?tab=compare&v=a,b')).toBe('?tab=compare')
    expect(selectionToSearch([])).toBe('')
  })

  it('round-trips', () => {
    const ids = ['a', 'b', 'c']
    expect(parseSelection(selectionToSearch(ids))).toEqual(ids)
  })
})
