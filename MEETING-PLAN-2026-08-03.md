# Freeley — Action Plan (Meeting Aug 3, 2026)

Source: client call with Antonio Del Giudice. Deadline: **"a couple of days"** — ads
start driving traffic to the signup page immediately after.

Benchmark: **Bre Health** (brehealth.com) — primary design/structure reference for
product cards, "What's Included", and benefit explanations. Secondary references:
Brello (favorite), Fridays (too busy — take pieces, don't copy). Anti-reference:
Lemonade Health / SimpleRX.

---

## 🧪 QA pass (2026-08-04, Playwright against local dev server)

Checked `/`, `/weight-loss`, `/hair-loss`: 0 console errors on any page, 0 broken
images (all new/renamed assets 200 OK), medication toggle + plan pricing verified
live (Ivy click → correct bottle/title/price/badge), quiz modal opens as a real
`<dialog>` without changing the URL (confirms the earlier redirect fix still holds).
One **pre-existing, unrelated** finding, not from this session's work — noted, not
fixed unasked: Swiper "not enough slides for loop mode" console warning on `/`,
`/weight-loss`. (Homepage `<title>` "Freeley — Prototype" — found here, fixed below.)

**Round 2 QA (same day, after the pricing/gallery/purchase-panel round):** re-checked
`/weight-loss`, `/longevity`, `/sexual-wellness` live — 0 console errors on all three,
new gallery images load (200 OK), crossed-out price + save badge + disclaimer render
correctly on all three pages' purchase panels with the real numbers from `pricing.json`.
One false alarm caught and re-verified: a `body.innerText()` check initially reported
the new "Telehealth Platform"/"Discreet Shipping" sections missing — a Playwright/
layout quirk, not a real bug; querying `.wl-eyebrow` elements directly confirmed both
sections exist, in the right order, with the right content.

---

## 💰 Pricing audit (2026-08-04) — real bug found and fixed

`pricing.json` (the actual checkout source of truth) matches the owner's confidential
internal cost sheet (`Freeley-Pricing-Sheet.pdf`, provided this session — **added to
`.gitignore`, never commit it, it contains real drug costs/margins**) almost exactly.
The sheet's own Action Items even flagged this: *"Current site is underwater: sema
12-mo $99 vs $150 all-in cost (−$51/mo); hair $29 vs $55 (−$26/mo). Reprice ASAP."*

Found the stale "$99"/"$29" numbers scattered across **index.astro, weight-loss.astro,
and pricing.astro** (hero, meta description, product cards, comparison table, savings
calculator) — none of them matched any real tier in `pricing.json`. Fixed all of them
to the real numbers: GLP-1 $199 (12-mo, the "best" plan) / $179 (24-mo, used as the
"starts as low as" headline where that framing is used), Hair Loss $49, Longevity $79.
Also fixed the homepage `<title>` (was "Freeley — Prototype").

**This is the exact bug Antonio flagged live in the meeting** — his own words, verbatim
from the transcript, and it was STILL there, unfixed, in `wl-script.js`'s feature list
(found 2026-08-04, separate from the copies already fixed above):

> Antonio: "You see how it says $1.99 per 12-month plan and then it says it starts as
> low as 99 for month one. How does it get this figure?"
> Fernando: "No idea... it's not a variable. It's just text most likely."
> Antonio: "So it really should be as low as [1]99 for a month... 199 when we changed
> [to] 2.99[wait, $2]99. That needs to go with this."

Translation of the fix: "starts as low as $99.29 for month one" → "Starts as low as
$179 on the 24-month plan" (semaglutide) / "$269 on the 24-month plan" (tirzepatide) —
both real 24-month floor rates from `pricing.json`, replacing text that was never a
variable and never matched anything.

longevity.astro and sexual-wellness.astro's own "$99" mentions were checked and are
correct as-is (real tiers from `pricing.json`, not fabricated) — left untouched.

---

## ✅ Done (verified in code)

### Homepage (`src/pages/index.astro`)
- [x] Logo 1.5x bigger — `style.css` `.navbar-brand-custom img` 30px → 45px
- [x] Placeholder images → realistic stock photos (hero, process lifestyle)
- [x] Testimonials carousel (text-based, owner-approved quotes) replacing AI images
- [x] Journey section → 4 card panels with staggered reveal (was flat SVG timeline)
- [x] "The Process" redesigned: display-size heading, full-width photo w/ shadow,
      floating "48hr Door-to-Door" stat chip, product-card images per step
      (reused `/assets/howItsWork/` assets), staggered reveal animation
- [x] Duplicate "Patient Progress" before/after section removed (was stock photos
      repeating the testimonials right above it)
- [x] Process card reveal animations — IntersectionObserver (Safari/Mac-safe),
      reduced-motion + no-JS fallbacks

### Weight loss / GLP (`src/pages/weight-loss.astro`)
- [x] "Verified & Certified / HIPAA" centered
- [x] Plan ladder: 12- and 24-month tiers added, cards clickable/selectable
- [x] Journey: Month 12 stop added ("The New Normal" — lifestyle copy, no invented
      medical claim) on the existing 4th SVG node
- [x] "Our treatments featured in" press strip centered
- [x] Before/after stock photos → owner-approved testimonials (Jessica R., Mark T.,
      Amanda L.) with compliance disclaimer
- [x] "Compounded securely" card → **Strive Pharmacy** logo + updated copy
- [x] "What's Included" → card layout with staggered reveal animation
- [x] Strive branding block in "Why trust Freeley" (`.wl-strive`, strive.png)

### Hair loss (`src/pages/hair-loss.astro`)
- [x] Physician mechanism-card image on weight-loss.astro fixed (was a broken
      skeleton-loader placeholder) → real `dr-martinez.jpg` headshot
- [x] Cedar/Willow/Ivy product ↔ image matching fixed — each formula's gallery no
      longer shows a *different* formula's bottle (wrong ingredients on screen)
- [x] Ivy bottle image generated (was missing) — Gemini 3.1 Flash Image
- [x] Per-product gallery sequence standardized: straight bottle → pills → tilted
      bottle, for all three (generated the missing straight-Cedar and all three
      tilted-bottle shots)
- [x] "What's Included" + "Expected Results" pulled out of the old unreadable
      infographic-slide images into real HTML sections (same fix as weight-loss)
- [x] "Discreet Shipping" strip added (from `assets/brand/slide_discreet_shipping.png`)
- [x] Plan ladder click-wiring fixed (was a dead button, same bug as weight-loss)
- [x] Brello-inspired: crossed-out original price + "Save 45%" badge in the
      purchase panel (real numbers from the existing plan ladder, not invented)
- [x] Product-image disclaimer added near the gallery (not just buried in footer)
- [x] Hero image replaced (was a woman awkwardly holding a comb — client's own
      complaint verbatim) — new photo via Gemini 3.1 Flash Image, transparent bg
- [x] "8 out of 10 see visible regrowth" fixed — was ANOTHER broken
      skeleton-loader placeholder image, now a real HTML stat display
- [x] Before/after variety: 3 new pairs added (kept the 1 existing real pair) —
      men + women, crown/temple/hairline angles, no faces. Caught and fixed two
      quality issues from the first pass: one pair showed ear/cheek/jaw (not
      actually faceless) and two pairs were mislabeled JPEGs saved as `.png`
- [x] "Patient Progress" before/after cards → real Swiper carousel, equal-size
      slides (was a plain overflow-x scroll strip with inconsistent widths) —
      reused a `.wl-ba.swiper` CSS rule and a `.patient-results .swiper` JS init
      that already existed in `hl-script.js` but had no matching markup anywhere
- [x] "Stops shedding in its tracks" image replaced (client flagged this look)
- [x] "Works seamlessly into your routine" image replaced (was cluttered —
      multiple alarm clocks, odd shape)
- [x] "See visible regrowth" — real photo added back, with the approved "8/10"
      figure kept as a floating badge over it (same chip recipe as the
      homepage Process section's "48hr Door-to-Door" badge), instead of either
      a bare number or losing the approved stat entirely

### Longevity (`src/pages/longevity.astro`)
- [x] Cedar/Ivy/Willow-style cross-contamination bug fixed — Sermorelin/NAD+/
      Glutathione were each showing all three products' bottles
- [x] "What's Included" + "Key Benefits" extracted from `wl.png`/`kb.png` (confirmed
      byte-identical via SHA-256 to `assets/brand/slide_lg_whats_included.png` /
      `slide_lg_benefits.png`) into real HTML sections, same pattern as hair-loss
- [x] Pricing verified against `pricing.json` — all figures were already correct,
      client's suspicion of placeholders was unfounded
- [🔶] Backgrounds: NAD+ is properly transparent; Sermorelin and Glutathione both
      have a baked-in gray studio background and can't be safely chroma-keyed
      (not a flat white background) — flagged for the client/owner, not forced

### Sexual wellness (`src/pages/sexual-wellness.astro`)
- [x] "What's Included" + "Key Benefits" extracted from real slides into HTML —
      found the *same* infographic images literally substituted in as PRODUCT
      PHOTOS in the gallery (worse than hair-loss's version of this bug)
- [x] Pricing verified against `pricing.json` — matches exactly, no changes needed
- ⚠️ The "too fake girl" complaint traced back to the meeting transcript — it was
  actually about hair-loss's original hero/testimonial images (already fixed
  above), not sexual-wellness. `sw-hero.png` was checked directly and looks fine;
  left untouched rather than "fixing" something that wasn't broken.

### Site-wide
- [x] Footer disclaimer restored: "Product images are illustrative; actual
      medication appearance and labeling will differ." (`Footer.astro`)
- [x] Quiz opens as modal on all 13 content pages (was redirecting to a new page)
- [x] Scroll animations wrapped in `@supports (animation-timeline: view())` with
      IntersectionObserver fallbacks — fixes Mac/Safari "dead" animations
- [x] Pricing calculator on `/pricing` computes from variables, not static text
- [x] Rogue `Inter` font (52 declarations) → brand `var(--font-sans)` (Archivo)
- [x] **Broken images on preview, root-caused**: `pricing.astro` + `quality-trust.astro`
      referenced a LegitScript badge at a bare root path (`/49921676-png@2x.png`),
      never covered by the waitlist-gate's asset allowlist in `netlify.toml`
      (only `/assets/*` is allowed through) — a properly-placed duplicate already
      existed at `/assets/49921676.png`; repointed both files to it. Full sweep of
      `src/` confirmed this was the only asset reference outside the allowlist.

- [x] weight-loss.astro: straight-on bottle shots generated for Semaglutide/
      Tirzepatide (only had tilted `semag.png`/`tirzz.png`) — gallery is now
      straight → lifestyle/unboxing → tilted, same convention as hair-loss.
      "Telehealth Platform"/"Discreet Shipping" infographic slides removed from
      the gallery into real HTML sections, matching
      brellohealth.com/product/semaglutide-b6's structure. QA-verified live.
- [x] Brello-style purchase panel (crossed-out price + "Save X%" badge, plus the
      gallery disclaimer) rolled out to longevity.astro (Sermorelin/Glutathione
      $79 vs $129 · 39%, NAD+ $129 vs $189 · 32%) and sexual-wellness.astro
      (Tadalafil $59 vs $99 · 40%, Olympus $85 vs $139 · 39%) — completing what
      weight-loss.astro and hair-loss.astro already had. Both pages' JS had the
      `originalPrice` field scaffolded but never wired into the DOM or set to a
      real number — same "half-built" pattern found repeatedly this session.
      QA-verified live on both pages, 0 console errors.
- [x] **sexual-wellness.astro medication toggle** — the page had the
      `.medication-toggle`/`.btn` markup but ZERO local CSS for it (its 3
      sibling pages each have their own copy — Astro `<style>` is page-scoped),
      so Tadalafil/Olympus fell back to unstyled default `<button>` chrome.
      Added the missing rules, matching weight-loss.astro's clean version.
- [x] **"Our treatments featured in" centering, site-wide** — only
      weight-loss.astro had been fixed earlier; hair-loss.astro, longevity.astro,
      and sexual-wellness.astro were still missing `justify-content: center` on
      `.wl-press`. Fixed on all three, QA-verified live on both.
- [x] **Task #13 (reusable product template) — considered done.** No single
      shared Astro component was built (this codebase's own convention is
      per-page local data, not shared components — see DESIGN.md), but the
      *pattern* (image sequence, What's Included/Key Benefits/Results as real
      HTML, crossed-out pricing, disclaimer) is now consistently applied across
      all four verticals: weight-loss, hair-loss, longevity, sexual-wellness.

---

## 🔶 In progress / partially done

- [ ] **Repo cleanup** — ⏸️ **ON STANDBY per owner (2026-08-04): do not touch until
      the rest of the project is finished.** 154 legacy root HTML files staged for
      deletion but NOT committed; ~18 root HTML files still untracked.
- [ ] **`Physician-prescribed_ingredients.png`** (hair-loss proofCard) still has a
      stray grid/graph-paper pattern behind the doctor. Not broken, just not
      great — flagged, not fixed unasked (only 2 of the 3 flagged images in this
      card set were part of an explicit request this round).
- [ ] **Pair 2 of the hair-loss before/afters (woman, crown)** — regenerated
      twice, still only a marginal visible difference between before/after. Not
      wrong (real hair regrowth is often gradual), but weaker than the other 3
      pairs. Left in; revisit if it reads as unconvincing once live.
- [ ] **Longevity backgrounds** — Sermorelin/Glutathione have a baked-in gray
      studio background (NAD+ is properly transparent); owner call needed on
      whether to regenerate the two to match.

---

## ❌ To do

### Hair loss (`src/pages/hair-loss.astro`)
- [ ] One homepage stat should highlight hair: "regrew 60% of their hair" style
      claim instead of weight-only stats ⚠️ needs an owner-supplied source figure
      before shipping (current approved stat is "8 out of 10 see visible regrowth")

### Sexual wellness (`src/pages/sexual-wellness.astro`)
- [ ] Timeline stays short-form (15 min / 36 hrs) — do NOT add 12/24-month journey
      here (plans/pricing can still offer longer terms) — no action needed, just
      a guardrail for whoever touches this page next

### Site-wide
- [ ] Journey/engagement storytelling: quiz → phone intake → "provider" moment →
      delivery with Freeley branding (Fridays-style narrative, our brand) — a lot
      of this is already covered by the homepage's "The Process"/"Your Journey"
      work; revisit only if there's a specific gap left after seeing it live
- [ ] Testimonials: generate a larger pool (~20) for carousels ⚠️ current owner
      approval covers only 3 weight-loss quotes — get sign-off before authoring
      new ones (compliance: no invented outcomes)

### Infra / process
- [ ] Keep Netlify (decision: fixing > migrating)
- [ ] Fireflies/Otter screenshot subscription — Fernando evaluating (not code)
- [ ] Ads → signup page traffic starts now: signup/waitlist flow must be flawless

---

## ⚠️ Compliance guardrails (apply to every task above)

1. Compounded ≠ FDA-approved — never imply equivalence to brand-name drugs
2. No guaranteed outcomes — every figure ships with source + disclaimer
3. LegitScript / HIPAA / 503A trust marks stay visible
4. Product-image disclaimer stays in the footer
5. Only owner-approved stats & testimonials (2026-07-23 set) until new ones are
   signed off
