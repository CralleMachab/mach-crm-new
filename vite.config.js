import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,   // visa radnummer i loggen
    minify: false,     // stäng av minifiering => fulla felmeddelanden
  },
})
