<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/lib/

## Purpose
Client-side TypeScript modules — real ES modules, imported by `<script>` tags in `.astro` files (as opposed to `is:inline` scripts, which cannot use `import.meta.env` or ES imports). Contains one general-purpose Supabase helper used by the public waitlist form, plus the `hub/` subtree of business logic powering the `/hub` patient portal.

## Key Files
| File | Description |
|------|-------------|
| `supabaseClient.ts` | Minimal Supabase RPC helper for pages that don't need a full portal client. Exports `callRpc(fn: string, args?: Record<string, unknown>): Promise<Response>` — POSTs to `${PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}` with the anon key as both `apikey` and `Authorization: Bearer` headers, throws on non-2xx. Used by `src/pages/waitlist.astro` to call the `join_waitlist` RPC. Comment notes: these `PUBLIC_*` env vars are meant to ship in the browser bundle — data is protected by RLS + `SECURITY DEFINER` RPCs server-side, not by hiding the anon key. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| [hub/](hub/AGENTS.md) | Health Hub patient-portal business logic: Supabase client + auth-state event bridge, auth actions, API-fetch wrapper, dashboard data loading/rendering, secure-messaging chat, DOM helpers, and product-name/image lookup tables. Imported exclusively by `src/components/hub/*` and `src/pages/hub.astro`. |

## For AI Agents
### Working In This Directory
- `supabaseClient.ts` is deliberately lighter-weight than `hub/supabase.ts` — it doesn't create a persistent `createClient()` instance, it just does raw authenticated `fetch()` calls to PostgREST RPCs. Don't merge the two; they serve different pages with different auth requirements (anonymous waitlist signup vs. authenticated patient session).
- Any new client-side module that needs `import.meta.env.PUBLIC_*` must be imported via a real (non-`is:inline`) `<script>` tag — Vite only inlines `import.meta.env` into Vite-bundled scripts.

### Testing Requirements
No automated tests. Verify `callRpc` changes by submitting the waitlist form on `/waitlist` against a real or local Supabase project and checking the network request.

### Common Patterns
N/A at this level — see `hub/AGENTS.md` for patterns specific to the portal's logic modules.

## Dependencies
### Internal
None (this file has no dependency on other `src/` code).
### External
- Native `fetch` (no Supabase SDK — this file talks to PostgREST directly over HTTP, unlike `hub/supabase.ts` which uses `@supabase/supabase-js`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
