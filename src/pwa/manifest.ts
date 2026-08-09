/**
 * What the app declares about itself when it is installed, and what the
 * service worker keeps so it opens without a network.
 *
 * It lives here rather than inline in vite.config.ts for one reason: the
 * manifest is Hebrew interface copy, and copy belongs where the rest of the
 * copy is reviewed. test/build/pwa.test.ts reads this module, not the build
 * output, so a change to the wording is caught at the same moment as a change
 * to a label on a screen.
 *
 * The colours are the light palette from src/ui/tokens.css, written out because
 * a manifest cannot read a custom property. The test holds them to it.
 */

export type ManifestIcon = {
  src: string
  sizes: string
  type: string
  purpose?: 'any' | 'maskable'
}

export type WebManifest = {
  name: string
  short_name: string
  description: string
  lang: string
  dir: 'rtl' | 'ltr'
  display: 'standalone' | 'browser' | 'minimal-ui' | 'fullscreen'
  orientation: 'portrait' | 'any'
  start_url: string
  scope: string
  background_color: string
  theme_color: string
  icons: ManifestIcon[]
}

/**
 * Where the app is served from.
 *
 * At the root in development, but GitHub Pages serves a project site under
 * /<repo>/. Every path in the manifest and the service worker has to agree
 * with that or the installed app resolves its icons and its start URL against
 * the wrong prefix and fails to install. Set BASE_PATH at build time.
 *
 * Always has a trailing slash, so `${BASE}icon-192.png` is right either way.
 */
/* Read off globalThis rather than `process` directly: this module is imported
   by vite.config.ts, by the tests and by nothing in the browser bundle, and
   the project deliberately carries no @types/node. */
const ENV = (globalThis as {
  process?: { env?: Record<string, string | undefined> }
}).process?.env

export const BASE: string = normaliseBase(ENV?.['BASE_PATH'])

function normaliseBase(raw: string | undefined): string {
  if (raw === undefined || raw === '' || raw === '/') return '/'
  const withLead = raw.startsWith('/') ? raw : `/${raw}`
  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

export const WEB_MANIFEST: WebManifest = {
  name: 'מסלול · מחשבון ליסינג',
  short_name: 'מסלול',
  description: 'העלות נטו של כל רכב בצי, לחודש לשנה ולשלוש שנים',
  lang: 'he',
  dir: 'rtl',
  display: 'standalone',
  orientation: 'portrait',
  start_url: BASE,
  scope: BASE,
  /* --paper and --petrol, light theme. */
  background_color: '#F4F6F4',
  theme_color: '#0D5C55',
  icons: [
    { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: `${BASE}icon-maskable-512.png`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

type RuntimeCaching = {
  urlPattern: RegExp
  handler: 'CacheFirst' | 'StaleWhileRevalidate'
  options: {
    cacheName: string
    expiration: { maxEntries: number; maxAgeSeconds: number }
    cacheableResponse: { statuses: number[] }
  }
}

export type PwaOptions = {
  registerType: 'autoUpdate'
  injectRegister: 'auto'
  includeAssets: string[]
  manifest: WebManifest
  workbox: {
    globPatterns: string[]
    navigateFallback: string
    cleanupOutdatedCaches: boolean
    runtimeCaching: RuntimeCaching[]
  }
}

const YEAR = 60 * 60 * 24 * 365

export const PWA_OPTIONS: PwaOptions = {
  registerType: 'autoUpdate',
  /* 'auto' injects the registration script into index.html, so no source file
     has to import a virtual module the type-checker cannot see. */
  injectRegister: 'auto',
  includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
  manifest: WEB_MANIFEST,
  workbox: {
    globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}'],
    /* One page, so every address resolves to it. */
    navigateFallback: `${BASE}index.html`,
    cleanupOutdatedCaches: true,
    /*
     * Heebo and IBM Plex Mono come from Google, which precaching cannot reach:
     * the build has no way to know the URLs the stylesheet will name. Without
     * these two entries the app opens offline in a fallback font, which on an
     * RTL interface is a visible break rather than a cosmetic one.
     */
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 8, maxAgeSeconds: YEAR },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          expiration: { maxEntries: 24, maxAgeSeconds: YEAR },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      /*
       * The 37 vehicle photographs are 6.6 MB, so precaching them would make
       * installation a long download over mobile data for pictures the reader
       * may never scroll to. They are cached as they are first seen instead,
       * which keeps the install small and still leaves the catalogue intact
       * offline once it has been browsed once.
       */
      {
        urlPattern: /\/assets\/.*\.jpg$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'vehicle-photos',
          expiration: { maxEntries: 60, maxAgeSeconds: YEAR },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
}
