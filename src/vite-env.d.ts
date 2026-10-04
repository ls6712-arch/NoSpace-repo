/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "on" serves resized Storage images (Supabase Pro plan only); see lib/imageVariants.ts. */
  readonly VITE_IMAGE_TRANSFORMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
