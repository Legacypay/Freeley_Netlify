# PLAN V2 — Feedback round (Antonio, Aug 6 2026)

Source: walkthrough call with Antonio. Track every task here: move items to **Done** as they ship.
Rule of thumb from the call: the message is fine — the **presentation** is the problem. Less plain text, more graphic/animated sections (Bre-style reference).

---

## Global / cross-page

- [ ] **Kill the white cards + blue highlight scheme.** Blue links read as old hyperlinks. Try the **gold** palette from the brand deck on highlighted cards/sections.
- [ ] **Redesign the "what's included / product info" sections** to be graphic and animated like the Bre reference — sell the whole package, not just the vial: doctor review, intake, supplies, delivery, dosage guide, and Freeley Health Hub (plan monitoring + direct doctor messaging).
  - Decision from the call: **NO separate product pages** — everything stays on the category pages, just presented better.
- [ ] **Replace pixelated image-based sections with real code.** Pricing blocks, "radical transparency", and similar sections are exported images and look blurry. Rebuild them as HTML/CSS. Antonio still has the original Figma if assets are missing. *(First win done: how-it-works' "Your Safety" 3-card carousel is now live HTML/CSS instead of baked-text image exports.)*
- [ ] **Get real screenshots from the Freeley Health Hub** (patient portal path) to use in the platform/monitoring sections instead of fake mockups.
- [ ] **Switch image generation to Antonio's GPT Image tool** (he's sending an invite). Use it for targeted edits: "keep the image, only change X".

## Weight loss / GLP-1 (`src/pages/weight-loss.astro`)

- [x] Replace the "complete the intake" image (step A-B-C-D) → someone going through the intake **on their phone**. **Not on this page** — it actually lives on `index.astro` and `how-it-works.astro` (`Complete_Your_Health_Intake.png`, same file, both pages). Regenerated via Gemini — a person filling out the intake on their phone, warm indoor light. Backup at `Complete_Your_Health_Intake.original.png`.
- [x] Tirzepatide section: **remove the second image** — it was an unboxing shot mislabeled "Semaglutide 2.4 mg". Removed from `public/assets/js/wl-script.js`.
- [x] Fix the **tilted/"melted" vial** image (`public/assets/wl/tirzz.png`) — generated via Gemini (`scripts/generate-images.js`), bottle now stands straight, label intact. Backup kept at `tirzz.original.png`. Bonus find still open: `semag.png`'s label may misread "2 L Vial" instead of "2 mL Vial" — check separately.

## Hair loss (`src/pages/hair-loss.astro`)

- [x] Hero image: now shows **a man and a woman** — swapped to `public/assets/home/hero-image.png` (the same transparent studio cutout the homepage hero uses).
- [x] Before/after gallery: cropped `before-2/3/4` and `after-2/3/4` to true squares (768–896px), enlarged the swiper slides (up to 560px desktop) — and fixed a real bug in the process: `global.css`'s `.swiper-slide { width: auto !important }` was silently overriding the page's own width rule; now beaten with a page-scoped `!important`.
- [ ] Generate **~10 more before/after images** (side profiles, variety) — target spec ready in IMAGE-PROMPTS.md (square, 768–896px, matching crop convention).
- [ ] Plain text sections → same graphic/animated treatment as the global task.

## Sexual wellness (`src/pages/sexual-wellness.astro`)

- [x] Hero image swapped — was black & white woman, now a color photo of a happy couple laughing on a rooftop (`/assets/promo/ed-hero.jpg`).
- [x] "What happens next" / trust imagery: kept the client-approved couple image (`Here_sWhatHappensNext.original.jpg`), swapped the "why trust Freeley" photo from a woman to a confident man (`lifestyle/sw-lifestyle-confidence.jpg`). **Caveat:** he reads as ~40s/composed, not distinctly "older" or "happy" per the brief — if that's not close enough, this slot needs regeneration (spec in IMAGE-PROMPTS.md).
- [x] Tadalafil section: price verified correct ($59/$99, Save 40%), matches the JS-driven panel — nothing else touched.

## Longevity (`src/pages/longevity.astro`)

- [x] **Plan ladder cut to exactly 1/6/12-month** (was 5 tiers: 1/3/6/12/24) — first pass only removed the savings label but kept all 5 boxes; caught and fixed directly against the client's explicit instruction. "Best" now sits on 12-month ($89, the cheapest of the 3 shown).
- [x] **Trust badges moved** from right after the Hero to a mid-page break, between the Product Showcase (purchase decision) and the Journey timeline.
- [x] Sermorelin & Glutathione proof-card images swapped from young-woman beauty-ad photos to existing on-brand photos of men in their 50s–60s.
- [x] "Cellular Energy & Repair" mechanism card — generated via Gemini, second man swapped for a woman in her 60s, same physician/pose/lighting/black-badge frame preserved exactly (verified visually against the backup). Backup at `Cellular_Energy.original.png`.
- [x] The two off-brand "mechanism" cards ("shampoo ad" / "Korean popsicle") — `Deep,Restorative Sleep.png` and `Detox_&_Immunity.png` — regenerated via Gemini as full-bleed 55–65-year-old lifestyle photos, replacing the odd rosette-cutout crops of a younger man hugging a pillow and a younger man in a gym-flex pose. Backups kept alongside each.
- **⚠️ Open question, needs your call:** the Product Showcase panel further down the page (medication toggle: Sermorelin/NAD+/Glutathione) has its own separate, hardcoded pricing block that always displays each product's **24-month** rate by design (`public/assets/js/longevity.js`, e.g. "$79 ~~$129~~ Save 39%, billed for the 24-month plan"), completely decoupled from the Hero plan ladder above. Now that 24-month isn't a selectable term anywhere on the page, that panel is referencing a vanished option. Left untouched pending your decision — see question below.

## How it works (`src/pages/how-it-works.astro`)

- [x] Doctor review step: added a real facepile (3 circular headshots, 96×96, cropped from existing site photos) — not placeholder initials.
- [x] Rebuilt the "Your Safety" 3-card carousel from baked-text image exports into real HTML/CSS (live headings/copy); only the top icon art stays as an image.
- [x] Confirmed no other image on the page is actually pixelated — all are native-resolution-down, never upscaled.
- [x] "You receive your treatment plan" image (looked like target practice) — regenerated via Gemini, now a clipboard/prescription icon matching the other timeline steps' soft-UI style. Backup at `You_Receive_Your_Treatment_Plan.original.png`.
- [ ] **New finding, not in original list:** "Ongoing Care & Automatic Refills" image actually shows a Doctor Review card UI — wrong content for that step, needs its own regeneration too.
- [ ] Optional/cosmetic: "HIPAA-Compliant Infrastructure" image is a phone-mockup with unrelated baked-in marketing copy that doesn't match the card's real text — flagged, not fixed (out of the pixelation/text-export criteria).

## Image generation batch

All slots that need new art (P1 = explicitly flagged, P2 = nice-to-have batch) are written up as prompts in **`IMAGE-PROMPTS.md`** at the repo root. Turns out we didn't need to wait on Antonio's GPT Image invite — the repo already had a Gemini-based generator (`scripts/generate-images.js`, uses `GEMINI_API_KEY`); fixed a real bug in it (it wasn't actually sending the source image for "edit" prompts, just reimagining from text) and extended it to create brand-new files and chain edits (`editFrom`, needed for before/after pairs to stay the same person).

- **P1 (6/6 generated):** ran via `scripts/image-manifest-p1.json`. All succeeded (the vial needed one retry after a transient `fetch failed`). Every overwritten file has a `.original.<ext>` backup sitting next to it — easy revert if any needs a redo.
- **P2 (10 before/after pairs, not run yet):** manifest ready at `scripts/image-manifest.json` (entries 7–26) — each "after" is chained off its "before" via `editFrom` so they read as the same person. Ask when you want this batch run; it's 20 images, more API time/cost than P1.

## Known repo housekeeping (not caused by this round)

Confirmed pre-existing, not touched by any agent this session: `public/assets/hl/Physician-prescribed_ingredients.png`, `public/assets/l/glutathione.jpeg`, `public/assets/l/sermorelin.jpeg`, and `src/pages/index-backup.astro` are all already deleted in the working tree from before. Also sitting around: `public/assets/hl/hero-couple.png` — a corrupt file from an abandoned background-removal attempt, unreferenced by any page, safe to delete whenever. Same for the root-level junk from an earlier session (`1.jpeg`, `2.jpeg`, `3.jpeg`, `hero.png`, `featured.png`, `cambiarcolores2.png`, `claude.txt`, `public/49921676.png.png`, stray `generate-ivy-image.js`/`generate-tilted-bottles.js`/`generate-cedar-straight.js`/`generate-ba-fixes.js`) — still there, still harmless, still your call whether to clean it up.

---

## Done

- [x] Prices updated across pages and verified live on the call (GLP-1, tadalafil, packs).
- [x] Pricing / packs page — approved as-is ("very clean").
- [x] GLP-1 landing overall look — approved.
- [x] Hero/product rotation on cards now switching correctly.

---

## Next milestone

Once the tasks above are done → **walkthrough with Antonio again** (same format: screen share, page by page), then move on to the **assessment**.
