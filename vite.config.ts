import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { findLaunchPlaceholders } from './scripts/launchPlaceholders'

// Fails the production build while placeholder text (the example.com contact
// address, "[PLACEHOLDER" legal lines) is still in the source. Preview builds
// (and local builds) only warn. LAUNCH_CHECK=strict forces a failure anywhere.
function launchPlaceholderCheck() {
  return {
    name: 'launch-placeholder-check',
    buildStart() {
      const hits = findLaunchPlaceholders(__dirname)
      if (hits.length === 0) return
      const list = hits.map((h) => `  ${h.file}:${h.line}  ${h.text.slice(0, 100)}`).join('\n')
      const message = `Placeholder text is still in the source:\n${list}`
      const strict = process.env.VERCEL_ENV === 'production' || process.env.LAUNCH_CHECK === 'strict'
      if (strict) this.error(message)
      else this.warn(message)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), launchPlaceholderCheck()],
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
