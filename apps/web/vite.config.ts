import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, the API runs separately; proxying /api keeps the browser on one
// origin, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
