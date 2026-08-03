// Full page inventory for cross-page e2e sweeps (console errors, link/404 checks).
// 22 Astro routes (src/pages/*.astro) — the 4 legal pages (privacy, terms,
// hipaa, telehealth-consent) were converted from static public/*.html to real
// Astro routes on 2026-08-03, so they no longer need .html-suffix handling.
export const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'assessment-design-2', path: '/assessment-design-2' },
  { name: 'assessment-quiz', path: '/assessment-quiz' },
  { name: 'blogs', path: '/blogs' },
  { name: 'checkout', path: '/checkout' },
  { name: 'compare', path: '/compare' },
  { name: 'faqs', path: '/faqs' },
  { name: 'hair-loss', path: '/hair-loss' },
  { name: 'how-it-works', path: '/how-it-works' },
  { name: 'index-backup', path: '/index-backup' },
  { name: 'longevity', path: '/longevity' },
  { name: 'partner-pharmacies', path: '/partner-pharmacies' },
  { name: 'pricing', path: '/pricing' },
  { name: 'quality-trust', path: '/quality-trust' },
  { name: 'sexual-wellness', path: '/sexual-wellness' },
  { name: 'waitlist', path: '/waitlist' },
  { name: 'weight-loss', path: '/weight-loss' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: 'hipaa', path: '/hipaa' },
  { name: 'telehealth-consent', path: '/telehealth-consent' },
] as const;
