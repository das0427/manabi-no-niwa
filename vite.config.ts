import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { precachePlugin } from './scripts/vite-plugin-precache.ts';

export default defineConfig({
  plugins: [react(), precachePlugin()],
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: { input: 'index.html' },
  },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
