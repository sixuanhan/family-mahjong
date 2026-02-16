import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy WebSocket connections to the game server during development
      '/': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
