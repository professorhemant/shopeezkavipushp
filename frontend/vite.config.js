import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// No service worker. A PWA service worker previously cached the app shell and
// kept pinning browsers to stale builds (and the self-destroying SW re-registered
// on every load, causing reload cycles). We now ship NO service worker: the
// static public/sw.js self-destructs to clean up any legacy registration, an
// inline script in index.html unregisters leftovers, and serve.json marks
// index.html/sw.js no-cache so a new deploy is always picked up on next load.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
