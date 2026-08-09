import { describe, it, expect } from 'vitest'
// @ts-expect-error node:fs is untyped in this project: no @types/node is installed
import { readFileSync, readdirSync } from 'node:fs'
import fleet from '../../src/data/catalog/fleet-2026.json'

/**
 * The vehicle photographs, checked as geometry rather than as art.
 *
 * This exists because a normalisation script shipped forty-three images in
 * forty-three different sizes, from 1000x625 down to 67x44, and nothing caught
 * it. The cause was a PowerShell variable collision — $h and $H are the same
 * variable, so the canvas height was overwritten by the scaled image height on
 * every pass and the frame shrank by about 6% each time, compounding. On screen
 * that reads as "some of the photos are terrible quality": a 67-pixel image
 * stretched across a card.
 *
 * A human reviewing a contact sheet is exactly the wrong instrument for this —
 * the images all looked like cars. These assertions are the right instrument.
 * They are deliberately about the frame and the car's place in it, not about
 * whether the picture is a good one, which no test can decide.
 */

const DIR = 'src/data/assets/vehicles'
const FRAME = { w: 1000, h: 625 }

const files: string[] = (readdirSync(DIR) as string[]).filter(f => f.endsWith('.jpg'))

/**
 * Width and height from the JPEG's own SOF marker.
 *
 * Parsed here rather than pulled from a dependency: this is twenty lines, it
 * runs at test time only, and a decoder is a large surface to add for two
 * numbers. Segments are `FF <marker> <2-byte length>`; the frame headers
 * (SOF0..SOF15, excluding the four that are not frames) carry height then
 * width as big-endian 16-bit values three bytes into the payload.
 */
function jpegSize(path: string): { w: number; h: number } {
  const b = readFileSync(path) as Uint8Array
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error(`${path}: not a JPEG`)
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const marker = b[i + 1]!
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; continue
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!
    const isFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      return { h: (b[i + 5]! << 8) | b[i + 6]!, w: (b[i + 7]! << 8) | b[i + 8]! }
    }
    i += 2 + len
  }
  throw new Error(`${path}: no frame header`)
}

describe('the vehicle photographs', () => {
  it('covers every car in the catalogue, and nothing else', () => {
    const ids = fleet.vehicles.map(v => v.id).sort()
    expect(files.map(f => f.slice(0, -4)).sort()).toEqual(ids)
  })

  it('is one frame, at one size, for all of them', () => {
    for (const f of files) {
      expect(jpegSize(`${DIR}/${f}`), f).toEqual(FRAME)
    }
  })

  /*
   * The size check alone would have passed a set of 1000x625 files each
   * holding a differently-sized car, which is the same defect one layer up:
   * the reader sees cars that do not match. Weight is the cheap proxy — an
   * image whose car has been scaled down to a corner compresses to almost
   * nothing, because most of the frame is flat white.
   */
  it('is not a large frame around a small car', () => {
    for (const f of files) {
      const bytes = (readFileSync(`${DIR}/${f}`) as Uint8Array).length
      expect(bytes, `${f} is ${Math.round(bytes / 1024)} KB — car scaled too small?`)
        .toBeGreaterThan(25_000)
      expect(bytes, `${f} is ${Math.round(bytes / 1024)} KB — not optimised?`)
        .toBeLessThan(200_000)
    }
  })

  it('stays small enough to install over mobile data', () => {
    const total = files.reduce(
      (n, f) => n + (readFileSync(`${DIR}/${f}`) as Uint8Array).length, 0)
    expect(total, `${Math.round(total / 1024)} KB of photographs`)
      .toBeLessThan(6 * 1024 * 1024)
  })

  it('links every car to its page on icar', () => {
    for (const v of fleet.vehicles) {
      expect(v.icarUrl, v.id).toMatch(/^https:\/\/www\.icar\.co\.il\//)
    }
  })
})
