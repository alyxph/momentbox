import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  server: {
    proxy: {
      '/api/upload': {
        target: 'https://litterbox.catbox.moe/resources/internals/api.php',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/upload/, '')
      },
      '/api/qr': {
        target: 'https://api.qrserver.com/v1/create-qr-code/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qr/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
