import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API base URL is only used by the dev server proxy; the browser always
// talks to the relative `/api` path so cookies stay first-party.
const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 0.0.0.0 makes the dev server reachable from the sandbox preview proxy.
    host: '0.0.0.0',
    strictPort: false,
    // Preview hosts (*.e2b.app) are proxied, so they must be allowed explicitly.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    // react-flow + dnd are already split into their own lazy chunks.
    chunkSizeWarningLimit: 900,
  },
});
