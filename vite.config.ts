import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backend = process.env.VITE_BACKEND ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router') || id.includes('node_modules/scheduler')) return 'react';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/media': backend,
      '/rss.xml': backend,
      '/sitemap.xml': backend,
      '/robots.txt': backend,
    },
  },
});
