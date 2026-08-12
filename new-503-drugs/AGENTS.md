<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# new-503-drugs/

## Purpose
Eight PDF reference documents — patient/product information sheets for compounded medications sourced from **503A compounding pharmacies** (the "503" in the directory name refers to Section 503A of the FDCA, which governs traditional pharmacy compounding; this matches the site's positioning around 503A-licensed pharmacy partners described in `PRODUCT.md`/`README.md`). These are **reference documents, not code** — likely staged here for review ahead of adding new products/treatments to the site (pricing, copy, dosing info), or for compliance/legal reference.

## Key Files
| File | Description |
|------|-------------|
| `Cedar+Tablet-Info-Sheet.pdf` | Info sheet for a "Cedar" tablet compound. |
| `Glutathione-Info-Sheet.pdf` | Info sheet for compounded glutathione — matches the "Glutathione" product referenced in `PLANV2.md`'s longevity-page notes and `brello-style/products/glutathione/`. |
| `Ivy-Willow-Info-Sheet+Tablet.pdf` | Info sheet for an "Ivy Willow" tablet compound. |
| `NAD+-Info-Sheet+(4).pdf` | Info sheet for compounded NAD+ — matches the "Sermorelin & Glutathione" / NAD-related longevity work in `PLANV2.md` and `brello-style/products/compounded-nad/`. |
| `Olympus-Info-Sheet+(6).pdf` | Info sheet for an "Olympus" compound (likely a TRT/peptide blend, name not otherwise referenced in the codebase). |
| `Sermorelin-Info-Sheet+(3).pdf` | Info sheet for compounded Sermorelin — matches `brello-style/products/compounded-sermorelin/` and the longevity-page Sermorelin proof-card work in `PLANV2.md`. |
| `Vast+Info+Sheet+(Approved+1222026)+(1).pdf` | Info sheet for a "Vast" compound, marked approved as of the filename's embedded date. |
| `VitalPeptide+Hair+Therapy+Info+Sheet.pdf` | Info sheet for a compounded hair-loss peptide therapy product — relates to the hair-loss vertical (`src/pages/hair-loss.astro`). |

## For AI Agents
### Working In This Directory
- Treat these as **source-of-truth reference material for product/medical copy**, not files to serve directly from the site or link to from a live page unless explicitly asked — none are currently referenced by `src/`, `public/`, or `netlify/functions/`.
- Several filenames align with real products discussed in `PLANV2.md` (Glutathione, Sermorelin, NAD+) and mirrored in `brello-style/products/` — when writing or updating longevity/hair-loss product copy, cross-check against the relevant PDF here for dosing/ingredient accuracy rather than inventing details.
- These are regulatory/patient-facing compounding pharmacy documents — do not alter their content (they aren't editable source anyway, being PDFs) and do not represent claims on the site beyond what these sheets support without medical/legal review.

### Testing Requirements
None — static reference documents, no build step touches this directory.

### Common Patterns
Filenames follow the pharmacy partner's own export naming (spaces encoded as `+`, occasional parenthetical version/date suffixes like `(4)`, `(Approved+1222026)`) — treat as opaque, do not rename to "clean up" without checking whether anything external (e.g. the partner pharmacy's own systems) expects the original name.

## Dependencies
### Internal
None — not referenced by any code in this repo.

### External
None (standalone PDFs).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
