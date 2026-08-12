<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/data/

## Purpose
Static, typed data modules imported at build time by `.astro` frontmatter. Currently holds a single file: the canonical Freeley-vs-competitors comparison dataset, kept here specifically so two different pages that both need it (the homepage's decorative "capsule" reveal and the standalone `/compare` page) read from one source instead of maintaining duplicate arrays that drift apart over time (the file's own comment notes they were literally duplicated for about ten minutes before this fix).

## Key Files
| File | Description |
|------|-------------|
| `compare.ts` | Exports `compareCols: string[]` (`['Freeley', 'Traditional Clinics', 'Retail Pharmacy', 'Other Telehealth']`), the `CompareRow` type (`{ label: string; cells: string[]; hero?: boolean }`), `compareRows: CompareRow[]` (8 rows covering physician oversight, in-person requirement, compounded meds, monthly price, shipping, FSA/HSA, fees, cancellation — `cells` is index-aligned with `compareCols`, Freeley always index 0; `'y'`/`'n'` cell values render as check/x icons, anything else renders as literal text), and `heroRows` (a `filter(r => r.hero)` derived export — the subset of rows flagged `hero: true`, used by the homepage capsule reveal, which shows only Freeley's own value with no competitor columns). |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- If comparison data ever needs to change, edit it **only** here — `src/pages/compare.astro` and `src/pages/index.astro` both import from this module, and editing either page's own copy would immediately reintroduce the drift this file exists to prevent.
- `hero: true` on a row means "show this on the homepage capsule too," not any other kind of emphasis — keep that flag intentional when adding new rows.

### Testing Requirements
No automated tests. After editing, visually check both `/compare` (full table) and `/` (capsule reveal, `hero` rows only) render correctly.

### Common Patterns
N/A — single small data file, no repeated structure across multiple files at this level.

## Dependencies
### Internal
- Imported by `../pages/compare.astro` and `../pages/index.astro`.
### External
None — plain TypeScript, no runtime dependencies.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
