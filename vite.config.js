import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// L'application ne parle qu'a ses propres fonctions serverless : la CSP est
// donc entierement statique (connect-src 'self'), rien a injecter au build.
// En dev, seul le websocket de rechargement a chaud doit etre ouvert en plus.
export default defineConfig(({ command }) => ({
  server: { port: Number(process.env.PORT) || 5173 },
  build: { sourcemap: false },
  plugins: [
    {
      name: 'csp-dev-websocket',
      transformIndexHtml: (html) =>
        html.replace('%CONNECT_SRC%', command === 'serve' ? "'self' ws: wss:" : "'self'")
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'HomeSmash',
        short_name: 'HomeSmash',
        description: 'Creneaux de badminton du Bads Club : dispos, reservations, sondage',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B1014',
        theme_color: '#0B1014',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Les creneaux et les reservations ne sont jamais mis en cache : une
        // dispo perimee dans une PWA est pire qu'une page qui charge.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: []
      }
    })
  ]
}))
