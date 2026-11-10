import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: funciona no GitHub Pages (subpasta) e localmente.
export default defineConfig({
  plugins: [
    react(),
    // Uso sem internet: o app (HTML/JS/CSS/ícones) fica guardado no Mac; os dados, mapas e fotos
    // são guardados conforme são abertos, ou todos de uma vez pelo botão "Salvar para usar sem internet".
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // usamos public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        globIgnores: ['data/**', 'geo/**', 'fotos/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // meta.json define a versão dos dados: sempre da rede quando houver conexão
            urlPattern: /\/data\/[^/]+\/meta\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'base-de-votos-dados', networkTimeoutSeconds: 5 },
          },
          {
            // dados (com ?v=versão) e mapas: abre do que está guardado e atualiza em segundo plano
            urlPattern: /\/(data|geo)\/.+\.json(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'base-de-votos-dados', expiration: { maxEntries: 2000 } },
          },
          {
            urlPattern: /\/fotos\/.+\.webp$/,
            handler: 'CacheFirst',
            options: { cacheName: 'base-de-votos-fotos', expiration: { maxEntries: 1000 } },
          },
        ],
      },
    }),
  ],
  base: './',
})
