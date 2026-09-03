import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Emit a plain (non-ES-module) script. Vite's default output uses
    // `<script type="module">`, which browsers refuse to execute when the
    // HTML is opened straight from disk (file://) — it's blocked by CORS,
    // silently, with no error the user can see, so the whole app just
    // never renders and the page looks "empty." An IIFE bundle is a
    // classic script with no such restriction, so it works identically
    // whether the file is opened locally or served from a URL.
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
