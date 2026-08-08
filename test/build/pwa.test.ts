import { describe, it, expect } from 'vitest'
// @ts-expect-error node:fs is untyped in this project: no @types/node is installed
import { existsSync, readFileSync } from 'node:fs'
import { PWA_OPTIONS, WEB_MANIFEST, BASE } from '../../src/pwa/manifest'

const read = (path: string): string => readFileSync(path, 'utf8')

const HEBREW = /[֐-׿]/

describe('the web manifest', () => {
  it('names the app in Hebrew', () => {
    expect(WEB_MANIFEST.name).toMatch(HEBREW)
    expect(WEB_MANIFEST.short_name).toMatch(HEBREW)
    expect(WEB_MANIFEST.description).toMatch(HEBREW)
  })

  it('declares the language and the writing direction', () => {
    expect(WEB_MANIFEST.lang).toBe('he')
    expect(WEB_MANIFEST.dir).toBe('rtl')
  })

  it('installs as an app rather than opening a browser tab', () => {
    expect(WEB_MANIFEST.display).toBe('standalone')
    expect(WEB_MANIFEST.start_url).toBe(BASE)
    expect(WEB_MANIFEST.scope).toBe(BASE)
  })

  it('takes its colours from the light palette in tokens.css', () => {
    const tokens = read('src/ui/tokens.css')
    expect(tokens).toContain(WEB_MANIFEST.background_color)
    expect(tokens).toContain(WEB_MANIFEST.theme_color)
  })

  it('ships an icon at both sizes a launcher asks for, plus a maskable one', () => {
    const sizes = WEB_MANIFEST.icons.map(i => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(WEB_MANIFEST.icons.some(i => i.purpose === 'maskable')).toBe(true)
  })

  it('points every icon at a file that exists', () => {
    for (const icon of WEB_MANIFEST.icons) {
      expect(existsSync(`public/${icon.src.slice(BASE.length)}`), icon.src).toBe(true)
    }
  })
})

describe('offline', () => {
  it('precaches the shell the app is built from', () => {
    const patterns = PWA_OPTIONS.workbox.globPatterns.join(' ')
    for (const ext of ['html', 'js', 'css', 'png', 'svg']) {
      expect(patterns, ext).toContain(ext)
    }
  })

  it('serves the app itself for any route it is opened at', () => {
    expect(PWA_OPTIONS.workbox.navigateFallback).toBe(`${BASE}index.html`)
  })

  it('caches the two font hosts the shell loads from, which precaching cannot reach', () => {
    const matches = (url: string) =>
      PWA_OPTIONS.workbox.runtimeCaching.some(r => r.urlPattern.test(url))
    // The exact URLs index.html asks for.
    expect(matches('https://fonts.googleapis.com/css2?family=Heebo:wght@300..900')).toBe(true)
    expect(matches('https://fonts.gstatic.com/s/heebo/v26/font.woff2')).toBe(true)
    expect(matches('https://example.com/tracker.js')).toBe(false)
  })

  it('replaces a stale service worker without asking', () => {
    expect(PWA_OPTIONS.registerType).toBe('autoUpdate')
    expect(PWA_OPTIONS.injectRegister).toBe('auto')
  })
})

describe('the build wires it in', () => {
  const config = read('vite.config.ts')

  it('registers the plugin with the options this module exports', () => {
    expect(config).toContain('VitePWA')
    expect(config).toContain('PWA_OPTIONS')
  })

  it('links the icon iOS uses, which ignores the manifest', () => {
    const html = read('index.html')
    expect(html).toMatch(/rel="apple-touch-icon"/)
    expect(html).toMatch(/name="theme-color"/)
  })
})
