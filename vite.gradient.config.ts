import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The live gradient on the signed-out landing page, built apart from the app.
// vite.config.ts builds the app as one classic script with every dynamic
// import inlined, so anything imported from there would land in the signed-in
// bundle. This is a separate ES-module build that the landing page loads at
// runtime from /gradient/gradient.js, only for visitors who see the landing page.
// Run after the app build (see the "build" script): it adds to dist/, never empties it.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist/gradient',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: 'src/landing-gradient/main.tsx',
      formats: ['es'],
      fileName: () => 'gradient.js',
    },
    rollupOptions: {
      output: { chunkFileNames: 'chunk-[hash].js' },
    },
  },
})
