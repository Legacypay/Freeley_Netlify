<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# archive/

## Purpose
Deprecated, reference-only code kept for historical context — **not live, not built, not deployed**. Currently holds a single subtree, `legacy-hub/`, containing an earlier static HTML/JS implementation of the patient dashboard ("Health Hub") that predates the current Astro implementation at `src/pages/hub.astro`.

## Key Files
| File | Description |
|------|-------------|
| `legacy-hub/hub.html` | ~2,270-line standalone static HTML patient-hub page — an earlier, pre-Astro/pre-Supabase implementation of the patient dashboard (this repo's README still describes this era: "hub.html → Patient dashboard (Firebase Auth)"). Superseded by `src/pages/hub.astro` + `src/lib/hub/` + `src/components/hub/`. |
| `legacy-hub/hub-tabs.js` | ~198-line JS companion to `hub.html`, handling tab navigation in the legacy dashboard UI. |

## For AI Agents
### Working In This Directory
- **Treat everything here as dead code.** Confirmed: `archive/legacy-hub/` is not referenced anywhere in `netlify.toml`'s `[[redirects]]` table, `_redirects`, or any build script — nothing serves or links to it.
- The live patient hub is `src/pages/hub.astro` (routed at `/hub`, or `/preview/hub` while the waitlist gate is active) — see `src/AGENTS.md` and `netlify/AGENTS.md` for its current auth/data flow (Supabase Auth + `netlify/functions` endpoints like `patientCases.js`, `getMessages.js`, `sendMessage.js`), which is architecturally different from this legacy Firebase-Auth-era implementation.
- Do not resurrect or link to files here without first confirming with the product owner — this exists purely as a reference for "how did the old hub work" during the migration, per recent commit history (`fix(hub): serve the Astro Health Hub at /hub instead of the legacy static page`).
- Safe to delete entirely if/when historical reference is no longer needed; not required for any build.

### Testing Requirements
None — no build step or test references this directory.

### Common Patterns
N/A — single deprecated feature snapshot, not a pattern to extend.

## Dependencies
### Internal
None — this directory is not imported, built, or linked to by any other part of the repo.

### External
None (the legacy code itself referenced Firebase Auth, per `README.md`, but that dependency is not active/installed for this archived copy).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
