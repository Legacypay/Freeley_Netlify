<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# models/

## Purpose
Four large 3D-body-model data files: a pair of generic human body meshes (`.obj`, Wavefront 3D geometry format) and a pair of matching anthropometric measurement datasets (`.json`). Filenames indicate a male/female generic ("mean") body model plus per-model measurement data — the kind of asset used for a 3D body-visualization or body-composition/fit-estimation feature (e.g. showing a patient a rough body shape based on height/weight inputs). **Confirmed unreferenced**: a repo-wide search (`src/`, `public/`, `netlify/`, `scripts/`) for `measurement_data`, `mean_male`, `mean_female`, and `.obj` file references found nothing. This directory is not wired into any current page, script, or function — it is either an orphaned asset from an abandoned feature or was staged ahead of a feature that was never built.

## Key Files
| File | Description |
|------|-------------|
| `mean_male.obj` | ~722 KB Wavefront `.obj` 3D mesh — a generic/average male body model. |
| `mean_female.obj` | ~722 KB Wavefront `.obj` 3D mesh — a generic/average female body model. |
| `male_measurement_data.json` | ~5.2 MB JSON — anthropometric measurement data paired with `mean_male.obj` (large enough to plausibly be a full measurement/deformation dataset rather than a handful of summary stats, e.g. per-vertex or per-pose measurement tables used to reshape the base mesh). |
| `female_measurement_data.json` | ~5.2 MB JSON — anthropometric measurement data paired with `mean_female.obj`, same role as above for the female mesh. |

## For AI Agents
### Working In This Directory
- These are binary/data assets, not code — there is nothing to lint, build, or import from here as things stand.
- **Before building any new feature on top of these files**, confirm with the product owner what they were originally intended for; do not assume a "body model visualizer" feature without confirmation, since there is no code anywhere in the repo that consumes them.
- Given the file sizes (~11.7 MB combined) and lack of any reference, consider flagging for removal or moving out of the main repo (e.g. Git LFS, external storage) if a use case doesn't materialize — they add meaningful repo weight for zero current functionality.
- If you do wire these into a feature, this is very likely 3D content best loaded client-side via a WebGL/Three.js-style loader — check bundle-size implications before importing the multi-megabyte `.json` files directly into an Astro page bundle.

### Testing Requirements
None currently — no code path touches these files.

### Common Patterns
N/A — no existing usage pattern to follow.

## Dependencies
### Internal
None found — not imported or referenced by `src/`, `public/`, `netlify/functions/`, or `scripts/`.

### External
None currently wired up. If used, a 3D rendering library (e.g. Three.js) would typically be the consumer of `.obj` mesh data.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
