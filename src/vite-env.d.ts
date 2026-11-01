/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "on" serves resized Storage images (Supabase Pro plan only); see lib/imageVariants.ts. */
  readonly VITE_IMAGE_TRANSFORMS?: string;
  /** GA4 measurement id ("G-XXXXXXXXXX"). Set in Vercel, Production only; see lib/googleAnalytics.ts. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:landing-images" {
  /** File names found in public/landing/ at build time. */
  export const landingImages: string[];
}
