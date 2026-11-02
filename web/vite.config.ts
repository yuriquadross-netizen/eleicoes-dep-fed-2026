import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona no GitHub Pages (subpasta) e localmente.
export default defineConfig({
  plugins: [react()],
  base: './',
})
