import { defineConfig } from 'vite';

const BACKEND_PORT = process.env['DEMO_SERVER_PORT'] ?? '8787';

export default defineConfig({
  root: import.meta.dirname,
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${BACKEND_PORT}`,
    },
  },
});
