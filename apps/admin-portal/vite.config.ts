import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Smart City Admin Portal - Vite Configuration
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3011,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
