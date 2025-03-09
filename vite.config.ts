import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000, // تأكد من تحديد منفذ
  },
  build: {
    outDir: 'dist', // Vercel يحتاج إلى هذا لإيجاد الملفات بعد البناء
  }
});
