import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BACKEND_PORT = process.env['DEMO_SERVER_PORT'] ?? '8787';
const THEME_COLOR = '#0b1026';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Enabled in dev too, since this project is normally run via
      // `yarn demo:dev` rather than a production build.
      devOptions: { enabled: true },
      manifest: {
        name: 'Midnight Bouncer',
        short_name: 'Bouncer',
        description: 'Checks your age. Keeps your secrets.',
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: "I'm a guest",
            url: '/?role=guest',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: "I'm the bouncer",
            url: '/?role=bouncer',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${BACKEND_PORT}`,
    },
  },
});
