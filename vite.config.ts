/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Librerías de la interfaz en paquetes aparte: cambian poco y el navegador las guarda.
        // Supabase no depende de React, así que puede ir sola sin crear ciclos.
        // Todo lo demás (planillas, .zip, .docx) se baja solo cuando se importa o exporta.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'supabase';
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack|@radix-ui|@floating-ui|lucide-react|aria-hidden|react-remove-scroll[^\\/]*|use-callback-ref|use-sidecar|tslib|get-nonce|detect-node-es|cookie|set-cookie-parser)[\\/]/.test(id)) {
            return 'librerias';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
