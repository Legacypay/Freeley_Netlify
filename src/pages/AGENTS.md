<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/pages/

## Purpose
File-based routes for the whole site. Astro maps every `.astro` file here 1:1 to a URL path (`weight-loss.astro` → `/weight-loss`, `index.astro` → `/`). Pages fall into five groups: the four treatment-vertical landing pages (hot paths), a handful of standalone/funnel pages (home, quiz, checkout, compare), informational marketing pages (about, pricing, how-it-works, FAQs, quality & trust, partner pharmacies, blogs), legal/compliance pages sharing `LegalArticle.astro` chrome, and the Health Hub patient portal. The entire site is currently gated behind `/waitlist` at the Netlify layer (`netlify.toml`), independent of these routes.

## Key Files
| File | Route | Description |
|------|-------|-------------|
| `index.astro` | `/` | Homepage. Full standalone HTML doc (no `Layout.astro`) with its own ~700-line inline stylesheet. Hero, trust bar, 4-step process, animated 3D "capsule" reveal of what's included, product cards for all 4 verticals, testimonials, press logos, and the shared closing CTA. Title: "Freeley — Physician-Prescribed Care, Delivered." |
| `about.astro` | `/about` | Company story page: philosophy/stats section, "What we stand for" value cards, "Built to be different" cards, closing CTA. Uses `Layout`, `Header`, `Footer`, `FinalCta`, `QuizModal`. |
| **`hair-loss.astro`** | `/hair-loss` | **Hot path.** Hair-loss treatment vertical landing page: hero with goal doors, pricing ladder, mechanism cards, before/after carousel, testimonials, product showcase (DOM hooks bound by `public/assets/js/hl-script.js`), journey timeline, FAQ. |
| **`longevity.astro`** | `/longevity` | **Hot path.** Longevity/peptide-therapy vertical landing page: hero, 3-tier plan strip, mechanism cards (NAD+/Sermorelin/Glutathione), care-team section, product showcase (bound by `public/assets/js/longevity.js`), timeline, FAQ. |
| **`sexual-wellness.astro`** | `/sexual-wellness` | **Hot path.** Sexual-wellness (Tadalafil/Olympus) vertical landing page: hero, duration doors, pricing ladder, patient-reported stats, mechanism cards, product showcase (bound by `public/assets/js/sw-script.js`), journey timeline, FAQ. |
| `weight-loss.astro` | `/weight-loss` | GLP-1 weight-loss vertical landing page — the template the other three verticals inherit their design/CSS-token structure from (`wl-` prefix). Hero with weight-goal doors, plan ladder, mechanism carousel, testimonials, product showcase (`public/assets/js/wl-script.js`), 4-stop journey timeline, FAQ. |
| `assessment-design-2.astro` | `/assessment-design-2` | Alternate/legacy 18-step quiz UI variant (raw HTML + `quiz2style.css`), not the live quiz. Title: "Freeley Assessment." |
| `assessment-quiz.astro` | `/assessment-quiz` | The live multi-step intake quiz (14 steps: goal, contact, demographics, symptoms, clinical snapshot, lifestyle, result, checkout). Wires Supabase client globals for `public/quiz-scripts/asw.js`. Title: "Compounded GLP-1 & Peptide Telehealth \| Freeley Wellness." Also served inline inside `QuizModal.astro`'s `<dialog>` on every other page. |
| `blogs.astro` | `/blogs` | Article-hub page with client-side category filter pills over a hardcoded 12-article dataset (placeholder content, links go nowhere yet). |
| `checkout.astro` | `/checkout` | Standalone checkout page: patient-info form, payment-details form, order summary sidebar, plan selector, savings/promo UI. Simulated payment flow (`processPayment()` sets a fake transaction and redirects to `/?payment=success`). |
| `compare.astro` | `/compare` | Full Freeley-vs-competitors comparison table. Reads shared data from `src/data/compare.ts` so it can never drift from the homepage capsule's subset. Standalone HTML doc, `noindex`. |
| `faqs.astro` | `/faqs` | FAQ page with 5 category tabs (General/Treatments/Pricing/Shipping/Account), each rendering an accordion from a hardcoded JS dataset. |
| `hipaa.astro` | `/hipaa` | HIPAA Notice of Privacy Practices. Renders through `LegalArticle.astro`; body is verbatim legal copy passed via slot. |
| `how-it-works.astro` | `/how-it-works` | 6-step scroll-storytelling timeline (intake → physician review → treatment plan → compounding → delivery → ongoing care), platform-features bento grid, pharmacy-standards spec sheet, safety-cards carousel. |
| `hub.astro` | `/hub` | **Health Hub patient portal.** Logged-in dashboard (Supabase Auth), composed from `src/components/hub/*` and orchestrated by an inline page script that wires sign-out, tab switching, and the auth→dashboard transition. See `src/components/hub/AGENTS.md`. |
| `partner-pharmacies.astro` | `/partner-pharmacies` | Lists Strive Pharmacy dispensing locations (known bug, out of scope: all 9 cards show the same Gilbert, AZ address — a pre-existing data issue, not a template bug). |
| `pricing.astro` | `/pricing` | Pricing page: 4 treatment-plan cards, Freeley-vs-alternatives comparison table, interactive savings calculator, "Freeley Promise" trust cards, FAQ. |
| `privacy.astro` | `/privacy` | Privacy Policy. Renders through `LegalArticle.astro`. |
| `quality-trust.astro` | `/quality-trust` | "Quality & Trust" page: medical director/clinical leadership profile, how-prescriptions-are-issued explainer (with a decorative blueprint-grid SVG background). |
| `telehealth-consent.astro` | `/telehealth-consent` | Telehealth Informed Consent. Renders through `LegalArticle.astro`. |
| `terms.astro` | `/terms` | Terms of Service, including the Refer-a-Friend program terms. Renders through `LegalArticle.astro`. |
| `waitlist.astro` | `/waitlist` | The site-wide "coming soon" gate page every other route is rewritten to in production (`netlify.toml`). Email capture via `callRpc('join_waitlist', ...)` (`src/lib/supabaseClient.ts`). To restore the live site, see `WAITLIST.md` at the repo root — do not just delete this file. |
| `weight-loss.astro` | *(listed above under hot paths)* | — |

## Subdirectories
None — `src/pages/` contains only `.astro` route files.

## For AI Agents
### Working In This Directory
- **Routing convention**: filename → URL, no config. Adding a new page is as simple as adding a new `.astro` file here.
- **Layout split**: most pages use `Layout` (`src/layouts/Layout.astro`) + `Header`/`Footer` components. A few (`index.astro`, `compare.astro`, `checkout.astro`, `assessment-quiz.astro`, `assessment-design-2.astro`, `waitlist.astro`) render a complete standalone `<html>` document instead — check for a `Layout` import before assuming one exists.
- **The three hot-path files** (`hair-loss.astro`, `longevity.astro`, `sexual-wellness.astro` — plus `weight-loss.astro`, their shared template origin) are edited most often per project memory. They share the `wl-` CSS namespace, the plan-ladder/goal-doors/journey-timeline/product-showcase pattern, and each has a paired legacy JS file under `public/assets/js/` (`hl-script.js`, `longevity.js`, `sw-script.js`, `wl-script.js`) that binds specific DOM ids/classes verbatim — **do not rename or remove those ids/classes without also updating the matching script**.
- Legal pages (`hipaa.astro`, `privacy.astro`, `telehealth-consent.astro`, `terms.astro`) are thin wrappers: only hero copy, CTA copy, and the verbatim legal body (default slot) live in the page; all shared chrome/typography lives in `src/components/LegalArticle.astro`.

### Testing Requirements
No automated tests. Verify visually with `npm run dev` against the specific route, and check that any DOM id/class referenced by a `public/**/*.js` script still exists after an edit.

### Common Patterns
- `const ASSESSMENT = '/assessment-quiz'` / `id="start-assessment*"` triggers are how pages open the quiz — either via `QuizModal.astro`'s delegated click-intercept on `<a href="/assessment-quiz">`, or (on `Header.astro`'s CTA) via a direct `id="start-assessment-header"` handler.
- Pricing/plan data is hardcoded per-page as frontmatter arrays (`plans`, `goals`, `mechanisms`, `testimonials`, `faqs`, `timeline`) rather than pulled from `src/data/`; only the comparison-table data is centralized.

## Dependencies
### Internal
- `../layouts/Layout.astro`, `../components/Header.astro`, `../components/Footer.astro`, `../components/FinalCta.astro`, `../components/QuizModal.astro`, `../components/LegalArticle.astro`, `../components/ProductInfoModal.astro`, `../components/hub/*` (hub.astro only), `../data/compare.ts` (compare.astro, index.astro), `../lib/supabaseClient.ts` (waitlist.astro), `../lib/hub/*` (hub.astro), `../styles/tailwind.css` / `../styles/hub.css`.
### External
- Swiper (carousels, CDN), Font Awesome / RemixIcon (icon fonts, CDN), `@supabase/supabase-js` (assessment-quiz.astro, waitlist.astro, hub.astro). Tawk.to (live-chat widget) was removed site-wide 2026-08-14.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
