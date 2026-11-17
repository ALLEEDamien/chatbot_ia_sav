import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration de Vite (serveur de dev + build) : seul le plugin React est nécessaire.
// Doc : https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
