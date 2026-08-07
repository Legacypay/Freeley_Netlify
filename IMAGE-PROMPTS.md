# IMAGE-PROMPTS — GPT Image generation brief

Source: PLANV2.md (Antonio feedback, Aug 6 2026 call). This document is the ready-to-execute
generation list for Antonio's GPT Image tool. Every entry below was verified against the
**current** state of the repo (`git diff` on each page) at the time this was written —
several slots Antonio flagged were already resolved by other in-flight edits and are
called out as DONE rather than given a prompt. Re-check `git status`/`git diff` before
generating, since pages were being edited concurrently.

Legend: **P1** = explicitly flagged by Antonio on the call. **P2** = nice-to-have / batch.

---

## P1 — must generate

### 1. How-it-works step 1 — "Complete Your Health Intake"
- **Page/section:** `src/pages/how-it-works.astro` timeline step 1 (also reused as
  `src/pages/index.astro` "The Process" step 1 — same file, two rendered sizes).
- **Current asset:** `public/assets/howItsWork/Complete_Your_Health_Intake.png`
- **Intrinsic size:** 1314×972 PNG. Not pixelated as a file — the complaint is the
  *content*: it's an abstract quiz-answer-bars graphic (rows labeled A/B/C/D) with a
  woman holding an apple, not a person doing intake on a phone.
- **Rendered size:** ~530×398 CSS px on how-it-works.astro (`.wl-tl__img`, aspect-ratio
  4/3, 2-col layout ≥900px; full-width single column below); ~265×199 CSS px on
  index.astro (`.process__step img`, same 4:3 aspect, 4-col grid ≥700px).
- **Target path:** overwrite `public/assets/howItsWork/Complete_Your_Health_Intake.png`
  (same filename — no page edit needed since both pages just reference the path).
- **Prompt:**
  > Photorealistic lifestyle photo, warm natural indoor light. A person in their late
  > 20s–40s sits comfortably on a couch or at a kitchen table, looking at their
  > smartphone with a light, focused smile, filling out a simple digital health form.
  > Casual homewear, relaxed posture, shallow depth of field with a softly blurred living
  > room background (plant, window light). No visible on-screen UI text — the phone
  > screen should read as a generic soft-glow form, not legible copy. Landscape
  > orientation, 4:3 aspect ratio, at least 1400×1050px. Style: matches the existing
  > `public/assets/process-lifestyle.jpg` and `public/assets/howItsWork/Physician_Reviews_Your_Profile.png`
  > photographic treatment already on the site (clean, editorial, telehealth-brand
  > feel — not stock-photo stiff).

### 2. Weight-loss — tirzepatide vial, straighten (EDIT)
- **Page/section:** `src/pages/weight-loss.astro` tirzepatide product gallery (2nd image),
  wired via `public/assets/js/wl-script.js` `medicationData.tirzepatide.images[1]`.
- **Current asset:** `public/assets/wl/tirzz.png`
- **Intrinsic size:** 391×639 PNG — notably lower-res than its gallery sibling
  `public/assets/wl/tirzz-straight.png` (800×1307), confirming this is the older/worse
  export.
- **Rendered size:** `.wl-prod__frame img { max-height: 260px; width: auto; }` → renders
  at roughly 159×260 CSS px.
- **Target path:** overwrite `public/assets/wl/tirzz.png` (same filename, no code change).
- **Prompt (EDIT):**
  > Keep everything in this image identical — same vial, same label text and design,
  > same cap, same lighting, same background/composition — only straighten the bottle
  > so it stands perfectly upright and undistorted (the cap is already straight but the
  > glass body reads as warped/tilted). Do not change the label artwork, color, or any
  > text. Output at higher resolution than the source, at least 800×1300px, to match
  > the sharpness of the sibling asset `tirzz-straight.png`.
- **Note:** the "remove the second image" part of this same PLANV2 bullet is already
  DONE — `product2.png` was already removed from the tirzepatide gallery array (see
  comment at `public/assets/js/wl-script.js:41-43`). Only the straightening remains.

### 3. How-it-works step 3 — "You Receive Your Treatment Plan"
- **Page/section:** `src/pages/how-it-works.astro` timeline step 3 only (not reused on
  index.astro — its 4-step teaser stops at "Delivered to You").
- **Current asset:** `public/assets/howItsWork/You_Receive_Your_Treatment_Plan.png`
- **Intrinsic size:** 1314×972 PNG. Content: concentric green rings around a circular
  badge with a serif "F" — reads like a target/bullseye ("gun-range target practice"
  per Antonio), and is stylistically a mismatch with the three abstract-icon steps
  that follow it in the same timeline.
- **Rendered size:** same slot as entry #1 — ~530×398 CSS px desktop / full-width mobile,
  aspect-ratio 4/3.
- **Target path:** overwrite `public/assets/howItsWork/You_Receive_Your_Treatment_Plan.png`.
- **Prompt:**
  > Generate a clean abstract icon graphic matching the exact visual system already used
  > in `public/assets/howItsWork/Pharmacy Compounds Your Medication.png`,
  > `public/assets/howItsWork/Delivered_to_Your_Door.png`, and
  > `public/assets/howItsWork/Ongoing_Care_&_Automatic_Refills.png`: a soft light-gray
  > radial gradient background with a faint square grid pattern, two small rounded-square
  > corner badge icons in the top-left and bottom-right, and a central circular motif
  > with soft glow/ring rays. The center icon should read clearly as a treatment
  > plan/prescription document — a clipboard or document icon with a checkmark, in the
  > brand's deep green (#0f6b45-ish) and white — not a bullseye/target pattern. Same
  > soft-UI, telehealth-dashboard aesthetic as the three reference images, 4:3 aspect
  > ratio, at least 1400×1050px.

### 4. Longevity — "Cellular Energy & Repair" mechanism card (man+man → man+woman)
- **Page/section:** `src/pages/longevity.astro`, `mechanisms[0]` card, "What's inside" grid.
- **Current asset:** `public/assets/l/Cellular_Energy.png`
- **Intrinsic size:** 1372×2274 PNG. Shows an older male physician and an older male
  patient looking at pills together — the "man + man" pairing Antonio flagged.
- **Rendered size:** `.wl-mech__img { aspect-ratio: 4/3; }` in a 3-col grid (≥780px) —
  roughly 371×278 CSS px desktop, full-width single column below 780px.
- **Target path:** overwrite `public/assets/l/Cellular_Energy.png`.
- **Prompt (EDIT-style):**
  > Keep the same composition, lighting, and the physician figure (older man, white coat,
  > gray beard) identical. Replace the second figure (currently a man) with a woman of
  > similar age (55–65), warmly dressed, in the same consulting pose — physician showing
  > her something in his hand (pills/supplement), both smiling, same soft studio lighting
  > and framing as the original. Photorealistic, telehealth-brand clean aesthetic. Match
  > the style of `public/assets/l/why-trust-freeley-lifestyle.jpg` (warm, natural,
  > editorial — not stock-photo stiff) if generating fresh rather than editing. At least
  > 1400×2300px portrait.

### 5. Longevity — "Deep, Restorative Sleep" mechanism card ("shampoo ad")
- **Page/section:** `src/pages/longevity.astro`, `mechanisms[1]` card.
- **Current asset:** `public/assets/l/Deep,Restorative Sleep.png`
- **Intrinsic size:** 1950×2478 PNG. Shows a man in his 40s hugging a pillow to his chest,
  cropped into an odd rosette/lollipop-shaped white cutout — reads like a personal-care
  product ad, not a wellness lifestyle photo (Antonio's "shampoo ad" complaint).
- **Rendered size:** same as entry #4 — ~371×278 CSS px desktop, `object-fit: cover`
  into a 4:3 box with a solid tint background behind it, so a full-bleed rectangular
  photo works fine (no need to keep the badge-shaped cutout).
- **Target path:** overwrite `public/assets/l/Deep,Restorative Sleep.png`.
- **Prompt:**
  > Photorealistic lifestyle photo of a person aged 55–65 (target demographic: adults
  > who want to feel younger) waking up rested in a softly lit bedroom, natural morning
  > light, genuine relaxed smile, sitting up in bed or by the bedside. No product held to
  > camera, no exaggerated "commercial" pose — candid, editorial wellness photography.
  > Full-bleed rectangular composition (not a cutout/badge shape), 4:3 aspect ratio, at
  > least 1600×1200px. Match the warm, natural-light style of
  > `public/assets/l/why-trust-freeley-lifestyle.jpg`.

### 6. Longevity — "Detox & Immunity" mechanism card ("Korean popsicle")
- **Page/section:** `src/pages/longevity.astro`, `mechanisms[2]` card.
- **Current asset:** `public/assets/l/Detox_&_Immunity.png`
- **Intrinsic size:** 1950×2478 PNG. Shows an Asian man in his 50s in a fitness pose,
  also cropped into the same odd rosette-shaped white cutout as entry #5 — off-brand,
  and the badge silhouette itself reads like a popsicle/lollipop shape (Antonio's
  "Korean popsicle" complaint targets both the demographic mismatch and the odd crop).
- **Rendered size:** same as entries #4/#5.
- **Target path:** overwrite `public/assets/l/Detox_&_Immunity.png`.
- **Prompt:**
  > Photorealistic lifestyle photo of a person aged 55–65 engaged in a light, energizing
  > wellness activity that reads as "detox & immunity" — e.g. drinking a glass of water
  > or green juice outdoors, or a brisk morning walk — genuine relaxed vitality, not a
  > gym-flex pose. Full-bleed rectangular composition (not a cutout/badge shape), natural
  > light, 4:3 aspect ratio, at least 1600×1200px. Match the warm, natural-light style of
  > `public/assets/l/why-trust-freeley-lifestyle.jpg`. Demographic and wardrobe should be
  > gender/ethnicity-varied from entry #5 above so the three mechanism cards don't repeat
  > the same person.

### 7. ~~Longevity — Glutathione proof card~~ — RESOLVED while writing this doc
`proofCards[2]` (`src/pages/longevity.astro`) was swapped mid-session to an existing
asset, `public/assets/about/value-integrity.jpg`, replacing
`Glutathione_(Immunity_&_Detox).png`. No generation needed — see "Already resolved"
section below.

---

## P2 — nice-to-have / batch

### 8. Hair-loss — ~10 more before/after variations
- **Page/section:** `src/pages/hair-loss.astro`, `beforeAfterPairs` swiper gallery.
- **Current state:** 4 pairs exist and are already wired to square crops:
  `before.png`/`after.png` (293×295, the one real patient pair, kept as-is), and
  `before-2-sq.jpg`/`after-2-sq.jpg` (768×768), `before-3-sq.jpg`/`after-3-sq.jpg`
  (768×768), `before-4-sq.jpg`/`after-4-sq.jpg` (896×896) — these three were already
  cropped square by another in-flight edit from originally-landscape 1408×768/1200×896
  sources. **No prompt needed for pairs 1–4 — already resolved.**
- **Rendered size:** `.wl-ba__box img { aspect-ratio: 1/1; object-fit: cover; }` inside a
  swiper slide 360px (mobile) → 460px (≥700px) → 560px (≥1024px) wide, holding a 2-up
  `before`/`after` grid with 12px gap and 18px card padding — each individual photo
  renders at roughly 156×156 CSS px (mobile) up to 256×256 CSS px (desktop).
- **Target paths:** follow the existing naming convention, next available indices:
  `public/assets/hl/before-5.jpg` through `before-14.jpg` and matching `after-5.jpg`
  through `after-14.jpg` (10 new pairs), generated as square (or center-croppable to
  square) at **900×900px minimum** to match the resolution of the existing `-sq` crops.
  Include side-profile angles for variety, not just front-facing.
- **Prompt (batch — generate 10 pairs, vary angle/framing/subject per pair):**
  > Photorealistic hair-loss before/after comparison photo pair for a telehealth hair
  > treatment brand. [Pair N]: a [gender]-presenting adult in their 30s–50s, [front-facing
  > OR three-quarter OR side-profile] view of the scalp/hairline, neutral studio lighting,
  > plain light-gray or white background, consistent framing between the "before" and
  > "after" shot of the same pair (same person, same angle, same lighting — only hair
  > density/hairline differs). "Before": visibly thinning hair or receding hairline.
  > "After": fuller, denser hair, same styling. Square aspect ratio, 1:1, at least
  > 900×900px. No visible text, watermark, or logo. Vary gender, ethnicity, and angle
  > (include at least 3 side-profile pairs) across the 10 pairs so the gallery doesn't
  > repeat the same look.

### 9. ~~Longevity — Sermorelin proof card~~ — RESOLVED while writing this doc
`proofCards[0]` (`src/pages/longevity.astro`) was swapped mid-session to an existing
asset, `public/assets/lifestyle/lg-lifestyle-vitality.jpg`, replacing
`Sermorelin_(Youthful_markers).png`. No generation needed — see "Already resolved"
section below.

Not flagged: `public/assets/l/NAD+_(Cellular_engine_repair).png` — this one is an
abstract DNA/cell-strand graphic with no person in frame, so the demographic complaint
never applied; left as-is by the other agent too.

---

## Already resolved — do NOT regenerate

Verified via `git diff` at write time; re-check before starting a generation batch since
other agents are actively editing these pages.

- **Hair-loss hero (man + woman):** `src/pages/hair-loss.astro` now points both
  `.wl-hero__img` and `.wl-hero__img-mob` at `public/assets/home/hero-image.png` (an
  existing man+woman studio-cutout pair, 1536×1024). Resolved by reusing an existing
  asset, no new generation.
  - Stray file: `public/assets/hl/hero-couple.png` (1221×1472, untracked) was generated
    by an earlier attempt at this same fix but is **not referenced anywhere** in the
    current hair-loss.astro. Safe to delete or ignore — do not wire it in or regenerate
    against it.
- **Sexual-wellness hero (not the black & white lady):** now
  `public/assets/promo/ed-hero.jpg` (happy couple, rooftop sunset, 1536×1024).
- **Sexual-wellness "what happens next" journey background:** restored to
  `public/assets/sw/Here_sWhatHappensNext.original.jpg` (couple, client-approved per
  code comment).
- **Sexual-wellness "why trust" section:** now
  `public/assets/lifestyle/sw-lifestyle-confidence.jpg` (confident man on a balcony at
  dusk — reasonable read on Antonio's "older man, happy" ED-demographic ask, though the
  expression is more composed/confident than broadly smiling; flag to Antonio on next
  walkthrough if he wants a more overtly "happy" alternative).
- **Longevity Sermorelin/Glutathione proof cards:** swapped to existing lifestyle assets
  `public/assets/lifestyle/lg-lifestyle-vitality.jpg` and `public/assets/about/value-integrity.jpg`
  respectively (were both young-woman-in-her-20s stock cutouts, off-brand for the 50–60
  demographic). Confirm on the next walkthrough that these two photos read as the
  correct demographic — if not, the prompt pattern from entries #4–#6 above applies to
  regenerate them properly instead of reusing a stock lifestyle shot.
- **How-it-works doctor-review facepile:** `public/assets/howItsWork/facepile/doc-1.png`,
  `doc-2.png`, `doc-3.png` (96×96 each) already generated and wired into
  `src/pages/how-it-works.astro` (step 2, rendered as 44px overlapping circles).
- **"yourSafety1/2/3.png" full-card image exports** (the literal pixelated
  image-based cards Antonio meant by "radical transparency"-style sections): already
  rebuilt as real HTML/CSS cards in `how-it-works.astro` — heading/copy are live text,
  only a smaller standalone image sits on top of each card now.
- **Weight-loss tirzepatide gallery "second image":** `product2.png` already removed
  from `medicationData.tirzepatide.images` in `public/assets/js/wl-script.js`.
- **`product3/4/5.png`, `wl.png`/`kb.png`, `slide_*.png` "infographic slide baked into
  an image" pattern:** confirmed gone from all four category pages
  (weight-loss/hair-loss/longevity/sexual-wellness) — all converted to real HTML
  checklist sections already, per `rg` search for any remaining `src=` reference (none
  found).

---

## Sections that should become code, not images

Per the global PLANV2 instruction ("replace pixelated image-based sections with real
code") — confirmed during this pass that this work is **already done** across all four
category pages:

- The "What's Included" / "Telehealth Platform" / "Discreet Shipping" product-carousel
  info slides (weight-loss, hair-loss, longevity, sexual-wellness) are real HTML
  checklists now, not image exports.
- The "Your Safety" cards on `how-it-works.astro` are real HTML/CSS cards with live
  heading/copy text now, not full-card image exports.
- The "Transparent Pricing" heading/section on all four category pages is already plain
  HTML (confirmed via `rg` — no image-based pricing table found on any page).

No further code-conversion candidates were found in this pass. If Antonio flags a new
image-as-text section on the next walkthrough, add it here rather than writing a
generation prompt for it.
