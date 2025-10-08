import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/flask': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/flask/, '')
      }
    }
  }
});
