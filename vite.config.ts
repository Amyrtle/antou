import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          state: ['zustand', 'idb'],
          search: ['minisearch'],
          pdf: ['pdfjs-dist'],
          xlsx: ['xlsx'],
          charts: ['echarts'],
        },
      },
    },
  },
})
