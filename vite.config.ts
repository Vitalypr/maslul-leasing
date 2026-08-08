import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { BASE, PWA_OPTIONS } from './src/pwa/manifest'

export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/.
  // BASE_PATH is set by the deploy script; empty locally.
  base: BASE,
  plugins: [react(), tailwindcss(), VitePWA(PWA_OPTIONS)],
})
