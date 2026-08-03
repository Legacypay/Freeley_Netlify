# Design — Freeley (the "Impeccable direction" / `.wl-` system)

A locked design system for this app, extracted from the already-shipped
verticals (`weight-loss.astro`, `hair-loss.astro`, `longevity.astro`,
`sexual-wellness.astro`, `pricing.astro`, `how-it-works.astro`, `about.astro`
— 564 uses of the `.wl-` prefix across those 7 files). This is not a fresh
Hallmark theme pick — it's the system already in production. Every page
redesign reads this file before touching CSS; it does not invent variety.

## Genre
editorial (clinical/trustworthy healthcare-brand register — serif display,
generous whitespace, no playful or brutalist notes)

## Macrostructure family
- Marketing pages (verticals, pricing, how-it-works): established per-page,
  not touched by this file.
- **Content pages (privacy, terms, hipaa, telehealth-consent): Long Document**
  — slim typographic hero band, centered ~760px reading column, `.wl-eyebrow`
  + `.wl-serif` section heads, `--line` rule dividers between sections, no
  enrichment imagery. Legal text is authoritative — copy is preserved
  verbatim, only presentation changes.
- **partner-pharmacies: reskin in place** — same section order it already
  has (hero → transparency/contact → pharmacy locations → CTA → footer),
  migrated from its bespoke `partnerstyle.css` onto `.wl-` tokens/classes.

## Theme
Real hex values (site doesn't use OKLCH; do not convert — match existing
declarations exactly), from `public/style/style.css` `:root`:
- `--green`       #123c2c   (ink-on-cream headings alt / dark accent)
- `--green-deep`  #0d3122   (Footer + FinalCta background)
- `--brand`       #0f6b45   (eyebrow text, links, badges)
- `--cream`       #f6f2e9   (page background — `.wl-page`)
- `--ink`         #1a1c1a   (body text)
- `--muted`       #63665f   (secondary text)
- `--gold`        #c39a4e   (price/accent highlights)
- `--line`        #e5ded0   (hairline dividers/borders)
- `--card`        #efe9dd   (card surfaces)

## Typography
- Display/serif: `'Source Serif 4'` (`--font-serif`) — headings, prices,
  pull-quotes. Weight 600, `letter-spacing: -0.02em`, `text-wrap: balance`.
  Loaded site-wide via Google Fonts `<link>` in `Layout.astro` (~L37) —
  every page gets it automatically, no per-page font setup needed.
- Body: `'Archivo'` (`--font-sans`) — `.wl-page` base font, buttons.
- Eyebrow/condensed: `'Archivo Narrow'` (`--font-condensed`) — all-caps
  kickers (`.wl-eyebrow`), fine print, footer disclaimer text.
- Note: `FinalCta.astro`'s heading uses `var(--font-display)`/`var(--emph)`,
  which the existing wl- pages (weight-loss.astro etc.) do NOT define locally
  — this is a pre-existing minor gap upstream of this redesign, not something
  to silently fix here. New pages should follow the same existing usage
  (import + use `<FinalCta>` as-is) for consistency with shipped pages,
  not invent a fix that shipped pages don't have.

## Spacing
No formal 4pt token scale exists yet — the wl- pages use ad-hoc px values
consistently (28px page gutter via `.wrap { padding: 0 28px }`, 56–64px
section vertical rhythm). New pages should match these values, not introduce
a new scale.

## Motion
- CSS-only, no JS animation library.
- Standard reveal: `@keyframes` fade/slide-up on scroll entry (see
  weight-loss.astro ~L469-489), OR scroll-driven `animation-timeline: view()`
  under `@supports (animation-timeline: view())`, with an `IntersectionObserver`
  fallback for unsupported browsers (weight-loss.astro ~L535-538, ~L978).
- Known trap: `overflow: hidden` on any ancestor of a `view()`-timed element
  silently freezes the animation — use `overflow: clip` instead (see
  memory: freeley-scroll-timeline-overflow-trap).
- `prefers-reduced-motion: reduce` must collapse reveals to a simple
  opacity fade, matching `FinalCta.astro`'s existing pattern.

## CTA voice
- Primary CTA: `.wl-btn` — pill shape (`border-radius: 999px`), solid
  `--green` fill, white text, `Archivo` 600 weight, 14px/24px padding.
- The shared closing-CTA band is `<FinalCta features={[...]}>` (slots:
  default = heading, `subheading`, `cta`) — dark `--green-deep` band with
  animated floating pill decorations. This is what "fix the footer with a
  CTA" means concretely: every page gets a `<FinalCta>` band immediately
  above `<Footer />`, not a hand-rolled CTA block.
- Footer: `<Footer />` (`src/components/Footer.astro`) — already links to
  `/privacy`, `/terms`, `/hipaa`, `/telehealth-consent`, `/partner-pharmacies`
  verbatim. No changes needed to Footer itself.

## Microinteractions stance
- Silent success, no celebratory toasts.
- Standard link/button hover: color or background shift only, no scale/bounce.

## Per-page allowances
- Content pages (legal): typography only. No hero photography — a slim
  typographic band (eyebrow + `.wl-serif` H1) matches the Long Document
  macrostructure and the register these documents need. Do not generate new
  imagery for these four pages.
- partner-pharmacies: may keep its existing photographic asset
  (`assets/strive.png` contact panel) — reuse, don't regenerate. A dedicated
  hero image was never part of this page and isn't required to hit parity
  with the verticals (several of which are typographic-hero too).

## What pages MUST share
- `<Layout>` + `<Header>` + `<Footer>` (no bespoke chrome).
- The `.wl-page` background/ink/font base rule.
- `.wl-eyebrow` for kickers, `.wl-serif` for headings, `--line` for dividers.
- `<FinalCta>` immediately before `<Footer>` on every one of these 5 pages.
- The established scroll-reveal pattern (`view()` + IO fallback), not a new
  animation approach.

## What pages MAY differ on
- Long Document's internal rhythm per page (heading count varies: terms ~13
  h3 sections, hipaa ~9 h2, telehealth-consent ~5 h2, privacy similar).
- partner-pharmacies keeps its own section set (contact panel, locations
  grid) — only the visual system changes, not the information architecture.

## Known adjacent issues (out of scope, noted not fixed)
- partner-pharmacies' pharmacy-locations grid renders the same "Gilbert, AZ"
  card 9× — a data bug, not a design issue. Left alone unless asked.
- partner-pharmacies has a legacy duplicate `#quiz--modal` div binding,
  separate from the shared `<QuizModal />` every other page uses — removed
  as part of this redesign (dead code, same migration hair-loss.astro already
  did), not a new decision.

## Exports
Single design-system doc for an existing hex-based project — no OKLCH/DTCG/
Tailwind export needed; the tokens above ARE `public/style/style.css`'s
`:root` block verbatim. No separate `tokens.css` required.
