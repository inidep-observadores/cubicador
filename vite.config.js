import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Ruta donde se publica la app. Por defecto en la raíz del dominio; para un
// subdirectorio: BASE_PATH=/cubicador/ npm run build
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/')

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Cubicación 3D de Pozos de Pesca',
        short_name: 'Cubicación 3D',
        description: 'Herramienta de modelado y cálculo de volumen 3D para pozos de buques pesqueros',
        lang: 'es',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // three.js casi nunca cambia: en un archivo aparte, una actualización
        // de la app no obliga a volver a descargarlo
        manualChunks: { three: ['three'] }
      }
    }
  }
})
