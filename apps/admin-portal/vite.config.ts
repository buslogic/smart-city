import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Smart City Admin Portal - Vite Configuration
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3011,
    host: true,
  }
})
