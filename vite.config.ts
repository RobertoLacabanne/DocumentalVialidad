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
        // Librerías en paquetes aparte: cambian poco y el navegador las guarda.
        // Supabase no depende de React, así que puede ir sola sin crear ciclos.
        // Los lectores y escritores de planillas y el .zip se bajan solo al importar o exportar.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/read-excel-file|write-excel-file|papaparse|fflate|unzipper|jszip|xmldom|fast-xml/.test(id)) return undefined;
          return id.includes('@supabase') ? 'supabase' : 'librerias';
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
