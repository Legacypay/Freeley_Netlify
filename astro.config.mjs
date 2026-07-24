// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Fonts are self-hosted at build time instead of linked from Google. Two
  // reasons, both visible: the stylesheet was a render-blocking request to a
  // third-party origin, and the fallback that painted while it travelled had
  // different metrics from the real face — that is the "bold flash then swap"
  // on a hard refresh. Astro emits metric-matched fallbacks (size-adjust,
  // ascent-override) so the placeholder occupies the same space, and preloads
  // the files from our own origin. Build-time note: this fetches from Google
  // during `astro build`, so the Netlify builder needs network (it has it).
  // Only pages that render <Font /> are affected; the other 16 are untouched.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Source Serif 4',
      cssVariable: '--font-display',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      fallbacks: ['Charter', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Archivo',
      cssVariable: '--font-text',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    // The compliance register. Astro's font API does not expose a width axis,
    // so a self-hosted Archivo carries no font-stretch range and `font-stretch:
    // 79%` would clamp to 100% and silently do nothing. Archivo Narrow is the
    // real narrow cut rather than an interpolation — better drawn, and it works.
    {
      provider: fontProviders.google(),
      name: 'Archivo Narrow',
      cssVariable: '--font-condensed',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
