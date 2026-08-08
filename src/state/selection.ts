import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * The chosen vehicles, held in the URL.
 *
 * The profile is private and stays in localStorage; the selection is the
 * opposite — its whole point is that a link to it can be sent to someone else.
 * Keeping it in the query string makes every selection a shareable address for
 * free, and makes the back button work without any code.
 *
 * Nothing personal goes here. Vehicle ids only.
 */
export const SELECTION_PARAM = 'v'

/** The comparison shows four side by side; a fifth would not fit its axis. */
export const MAX_SELECTION = 4

export function parseSelection(search: string): string[] {
  const raw = new URLSearchParams(search).get(SELECTION_PARAM)
  if (raw === null) return []
  const ids: string[] = []
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (id === '' || ids.includes(id)) continue
    ids.push(id)
    if (ids.length === MAX_SELECTION) break
  }
  return ids
}

/**
 * Writes the selection back into a query string, leaving every other parameter
 * where it was. The commas survive unescaped — `?v=a,b` is a link a person can
 * read, and a comma is legal in a query string.
 */
export function selectionToSearch(ids: string[], search = ''): string {
  const params = new URLSearchParams(search)
  if (ids.length === 0) params.delete(SELECTION_PARAM)
  else params.set(SELECTION_PARAM, ids.slice(0, MAX_SELECTION).join(','))
  const query = params.toString().replace(/%2C/g, ',')
  return query === '' ? '' : `?${query}`
}

export type SelectionStore = {
  selected: string[]
  isSelected: (id: string) => boolean
  /** True once the comparison is full; the control that adds should say so. */
  isFull: boolean
  toggle: (id: string) => void
  clear: () => void
}

/** Fired after we rewrite the URL — history.replaceState emits no event. */
const CHANGED = 'maslul:selection'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

const currentSearch = (): string => window.location.search
const noSearch = (): string => ''

export function useSelection(): SelectionStore {
  const search = useSyncExternalStore(subscribe, currentSearch, noSearch)
  const selected = useMemo(() => parseSelection(search), [search])

  const write = useCallback((ids: string[]) => {
    const { pathname, hash, search: live } = window.location
    window.history.replaceState(null, '', `${pathname}${selectionToSearch(ids, live)}${hash}`)
    window.dispatchEvent(new Event(CHANGED))
  }, [])

  const toggle = useCallback((id: string) => {
    // Read the live URL rather than the render's copy: two clicks inside one
    // frame would otherwise both start from the same stale list.
    const now = parseSelection(window.location.search)
    if (now.includes(id)) write(now.filter(other => other !== id))
    else if (now.length < MAX_SELECTION) write([...now, id])
  }, [write])

  const clear = useCallback(() => { write([]) }, [write])

  const isSelected = useCallback((id: string) => selected.includes(id), [selected])

  return {
    selected,
    isSelected,
    isFull: selected.length >= MAX_SELECTION,
    toggle,
    clear,
  }
}
