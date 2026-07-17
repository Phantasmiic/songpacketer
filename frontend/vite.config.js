import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  server: {
    proxy: {
      '/api/songbase': {
        target: 'https://songbase.life',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/songbase/, '/api/v2'),
      },
    },
  },
});
