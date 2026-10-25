
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // PENTING: base './' membuat path aset menjadi relatif (misal: "./assets/..." bukan "/assets/...")
  // Ini memperbaiki masalah layar putih (blank screen) saat deploy di subfolder cPanel
  base: './',
  build: {
    outDir: 'dist',
  }
});
