import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { findLaunchPlaceholders } from './scripts/launchPlaceholders'

// Lists the screen images in public/landing/ as a virtual module, so the
// landing page knows at build time which sections have their screenshot and
// hides the ones that don't. See public/landing/README.md.
function landingImages() {
  const id = 'virtual:landing-images'
  const resolved = '\0' + id
  const dir = path.resolve(__dirname, 'public/landing')
  return {
    name: 'landing-images',
    resolveId(source: string) {
      return source === id ? resolved : null
    },
    load(loadId: string) {
      if (loadId !== resolved) return null
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.webp$/.test(f)).sort() : []
      return `export const landingImages = ${JSON.stringify(files)}`
    },
    configureServer(server: { watcher: { add: (p: string) => void } }) {
      server.watcher.add(dir)
    },
  }
}

// The landing-page screenshot preview. Only exists in `--mode landing-preview`
// (npm run landing:screens). In that mode the app's database client is swapped
// for an in-memory one holding example people (src/landing-preview), so nothing
// can read or write a real database, and /landing-photos/ is served from
// landing-preview/photos/. In every other mode this returns a no-op plugin, and
// the routes that import the preview code are compiled out (see src/app/routes.ts).
function landingPreview(mode: string) {
  if (mode !== 'landing-preview') return { name: 'landing-preview-off' }
  const fake = path.resolve(__dirname, 'src/landing-preview/fakeSupabase.ts')
  const real = path.resolve(__dirname, 'src/lib/supabase.ts')
  const photos = path.resolve(__dirname, 'landing-preview/photos')
  return {
    name: 'landing-preview',
    enforce: 'pre' as const,
    async resolveId(this: { resolve: (s: string, i?: string, o?: object) => Promise<{ id: string } | null> }, source: string, importer?: string) {
      if (!importer || !/supabase$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      return resolved && resolved.id === real ? fake : null
    },
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: Buffer | string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/^\/landing-photos\/([A-Za-z0-9._-]+)$/)
        if (!m) return next()
        const file = path.join(photos, m[1])
        if (!file.startsWith(photos) || !fs.existsSync(file)) {
          res.statusCode = 404
          return res.end('Not found')
        }
        res.setHeader('Content-Type', /\.png$/.test(file) ? 'image/png' : 'image/jpeg')
        res.end(fs.readFileSync(file))
      })
    },
  }
}

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

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), launchPlaceholderCheck(), landingImages(), landingPreview(mode)],
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
}))
