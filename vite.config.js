import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The proxy is only used by the Vite development server. It is not bundled
// into production assets. Override it with VITE_DEV_API_PROXY_TARGET when the
// local Express backend uses a non-default port.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = (env.VITE_DEV_API_PROXY_TARGET
    || `http://127.0.0.1:${env.BACKEND_PORT || env.DEV_BACKEND_PORT || 5001}`).replace(/\/+$/, '')

  return {
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
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
