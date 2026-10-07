import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    // The Express backend persists ATS state under server/data. Vite should
    // not treat those backend writes as frontend file changes, otherwise a
    // PATCH such as /notifications/:id/read causes a full browser reload.
    watch: {
      ignored: ['**/server/data/**']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})