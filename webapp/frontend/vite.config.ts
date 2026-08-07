import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done manually in main.tsx (via virtual:pwa-register)
      // so we can force a reload the moment a new service worker takes
      // over - otherwise updates only apply on some later, unrelated visit
      // and the page looks stuck on the old build until a hard refresh.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Clocking Report Parser',
        short_name: 'Clocking Reports',
        description: 'Turn Individual Clocking History PDFs into ready-to-use timesheet workbooks.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f2f1ef',
        theme_color: '#f2f1ef',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Only the app shell (HTML/CSS/JS) is precached, not API responses -
      // parsing always needs the local server live, this just makes the UI
      // itself load instantly and feel like an installed app.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
})
