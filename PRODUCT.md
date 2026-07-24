# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Freeley ships a Capacitor wrapper for Android and iOS (`capacitor.config.json`, `android/`, `ios/`), but it wraps this same website — the design language is web, not native.

## Users

Adults across the United States seeking physician-supervised treatment for a condition they would rather not take to a waiting room. **All four verticals carry equal weight** — GLP-1 weight loss, sexual wellness, hair loss, and longevity/peptides. Visitors arrive through whichever concern is theirs; none is a front door for the others, and none may be treated as an upsell attached to weight loss.

Confirmed by the owner, and it corrects the incumbent site: today's hero, imagery, and stats block are almost entirely weight-loss coded. That imbalance is an artifact of how the site grew, not a product decision.

## Product Purpose

A telehealth platform that connects patients to licensed U.S. physicians and licensed 503A compounding pharmacies, entirely online — intake, physician review, prescription, and discreet home delivery — without insurance, waiting rooms, or in-person visits.

Success is a patient completing intake and receiving prescribed medication at home.

## Positioning

**Price, without a membership.** $99/month for GLP-1 weight loss against $300–$500+ at traditional clinics and $188–$399 at other telehealth providers, with no membership fee, no hidden charges, no contract, and cancellation at any time.

This is the confirmed claim to lead with. Physician quality, end-to-end speed, and verifiable legitimacy are all real and all supporting evidence — they are not the position.

## Operating Context

- **The funnel is the product surface.** Online intake (~2 minutes) → physician review → compounding → shipping. The assessment quiz is the primary conversion path, and the site is built around it.
- Physician review is asynchronous; the patient never books a synchronous appointment.
- Fulfillment runs through partner 503A compounding pharmacies, with Strive Pharmacy named as a partner, serving all 50 states.
- **The public site is currently behind a "coming soon" waitlist gate** (a forced rewrite in `netlify.toml`). Every real route is unreachable until that block is removed; `/preview` is the one bypass, used to show the client a redesigned landing mockup.
- Patients are also served by a large legacy SEO content library (130+ blog posts in `public/`), much of it Florida-specific from an earlier phase, now sitting alongside nationwide coverage.

## Capabilities and Constraints

**Treatments and real pricing** — `pricing.json` at the repo root is the single source of truth; the checkout server function imports it directly and is authoritative over anything the UI displays. Monthly rates fall as plan length rises (1 / 3 / 6 / 12 months):

| Treatment | 1 mo | 3 mo | 6 mo | 12 mo |
|---|---|---|---|---|
| GLP-1 — Semaglutide | $194.29 | $149.29 | $124.29 | $99.29 |
| GLP-1 — Tirzepatide | $274.29 | $214.29 | $194.29 | $174.29 |
| Sexual Wellness | $89 | $79 | $69 | $59 |
| Longevity | $149 | $129 | $109 | $99 |
| Hair Loss | $49 | $39 | $34 | $29 |

⚠️ **Open decision, deliberately not settled here:** the headline `$99` is the 12-month rate. The owner did *not* mark the 12-month qualifier as a binding constraint when asked, but it is a factual condition of the price and the site's own footnote states it. Since price *is* the position, how prominently that condition travels with the number is a real product decision that needs an owner call — not something design should quietly resolve in either direction.

**Technical** — Astro static build deployed on Netlify (no adapter; no server runtime for pages). Netlify Functions handle checkout, MD Integrations case submission, webhooks, and a 15-minute retry queue. Supabase holds lead capture and the waitlist. Stripe handles payment. MD Integrations is the telemedicine/prescription partner.

**Terminology** — *compounded*, not generic; *503A pharmacy*; *intake* (not "consultation"); *physician review*, not "appointment."

## Brand Commitments

- **Freeley Health LLC**, freeley.com. Logo marks in `src/assets/brand/`.
- Voice from the live About page: healthcare without "rushed 15-minute appointments, waiting rooms, or fighting with insurance companies" — on the patient's terms. Direct, plain, non-clinical.
- The client has explicitly kept italic serif display headings and the gold price treatment on the redesigned landing, even after both were flagged as risky in a prior audit. Treat them as owner-chosen identity, not oversights.

## Evidence on Hand

**Real and verifiable:**
- LegitScript Certified; HIPAA compliance; licensed U.S. physicians; 503A licensed compounding facility; nationwide coverage across all 50 states; partner pharmacy network with distribution across AZ, CA, TX, FL, VA, UT, MO. Badge assets in `src/assets/badges/`.
- A complete Figma v5 export of the redesign in `public/assets/brand/_figma_v5/` and `src/assets/figma-v5/`; production imagery in `public/assets/home/`.
- Real pricing in `pricing.json`.

**Owner-approved 2026-07-23 — usable as proof, always with its disclaimer:**
- The four program figures: 15% average body weight lost, 24hr physician response, 96% patient satisfaction, 48hr delivery.
- The three landing testimonials (Jessica R., Mark T., Amanda L.) and their attached results. Note they are **all weight-loss patients** — the social-proof surface is single-vertical and does not yet represent the other three programs. Quotes for those are pending owner supply; do not author them.

**Not verified — must not be treated as established:**
- The "12,000+ patients" and "4.9/5 on Trustpilot" figures were *not* covered by the 2026-07-23 approval and remain unconfirmed. Avatars are placeholders.
- No patient photography of real patients exists; all people imagery is stock or Figma-export.

## Product Principles

1. **Four doors, one house.** Every vertical earns equal standing. Any surface that makes weight loss the site's identity is drifting from the product.
2. **The price is the promise — so the price must be honest.** Leading on $99 only works if the conditions attached to it are never hidden. A qualifier that has to be hunted for turns the position into a liability.
3. **The funnel is the product.** Intake completion is the success metric; every surface either moves a visitor toward it or justifies its existence some other way.
4. **Verifiable beats impressive.** In a category crowded with grey-market peptide sellers, a claim that can be checked is worth more than a claim that sounds bigger.
5. **Discretion is a feature.** People come here for things they don't want to discuss in a waiting room. Plain, unembarrassing, private — in copy and in imagery.

## Accessibility & Inclusion

- WCAG-level basics are treated as required, not optional: this is a health product, and the client has already had accessibility findings raised and fixed (dead `href="#"` links, missing image semantics).
- Motion must respect `prefers-reduced-motion` — established in the existing implementation and non-negotiable for a patient-facing health surface.
- Enterprise/LegitScript compliance drives the security header set in `netlify.toml` (CSP, HSTS, frame protections); design work must not require loosening it without saying so.

## Compliance Constraints (binding — confirmed by owner)

1. **Compounded ≠ FDA-approved.** Never imply FDA approval, nor equivalence to the brand-name drug. The sharpest regulatory line in compounded semaglutide.
2. **No guaranteed outcomes.** Every result figure ships with its source and disclaimer. Never promise a result.
3. **The trust marks stay.** LegitScript, HIPAA, 503A, and nationwide coverage remain visible and verifiable through any redesign.
