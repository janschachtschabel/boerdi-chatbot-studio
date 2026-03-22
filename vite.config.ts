import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    headers: {
      'X-Frame-Options': '',
      'Content-Security-Policy': "frame-ancestors *",
    },
  },
});
