import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En local, /api va al backend. En producción lo hace el rewrite de vercel.json.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
