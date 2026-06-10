import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react', '@tabler/icons-react', '@heroicons/react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-utils': ['zustand', 'date-fns', 'i18next', 'react-i18next', 'react-hot-toast', 'clsx', 'class-variance-authority', 'tailwind-merge'],
        },
      },
    },
  },
  base: '/',
});
