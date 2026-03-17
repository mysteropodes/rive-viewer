import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pour GitHub Pages : définir VITE_BASE dans les secrets/variables du repo
// Ex: VITE_BASE = '/rive-viewer/' (nom du repo précédé de /)
// En local : aucune variable → base = '/'
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  server: {
    host: true,
    port: 5173,
  },
})
