<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# supabase/

## Purpose
Database layer for Freeley, hosted on Supabase (managed Postgres + Auth + PostgREST Data API). This directory holds only SQL migrations (`migrations/`) — there is no Supabase CLI config (`config.toml`), Edge Functions, or seed data in this repo; the project is assumed to be linked/managed externally and migrations are applied manually or via a separate deploy step, not `supabase db push` tooling checked in here.

Supabase plays three distinct roles in this codebase:
1. **Marketing funnel lead capture** (`funnel_leads`/`funnel_orders`, migration 0001) — written directly from the browser via a Supabase RPC call in the Astro/legacy frontend quiz JS (`public/quiz-scripts/asw.js`), independent of the Netlify Functions layer.
2. **"Coming soon" waitlist capture** (`waitlist`, migration 0002) — the email list collected by `/waitlist`, the page every URL is currently force-rewritten to (see the gate in root `netlify.toml`). Referenced defensively there as data that must never be dropped when the gate is removed.
3. **Patient hub authentication & profile** (`profiles`, migration 0003) — backs Supabase Auth (`auth.users`) sign-up/sign-in for the `/hub` patient portal; `netlify/functions/lib/verify-supabase-token.js` validates the access tokens these users present, gating nearly every patient-facing function in `netlify/functions/`.
4. Additionally, `netlify/functions/keepSupabaseAlive.js` pings the `waitlist` table via PostgREST daily purely to prevent the free-tier project from auto-pausing after 7 days of inactivity — it has no functional purpose beyond keeping the project warm.

Notably, none of the three tables that back Freeley's actual telehealth/order data (case status, order tracking) live in Supabase — that data lives in **Netlify Blobs** (`mdi-orders`, `pending-mdi-cases` stores) and in **MD Integrations (MDI)**, the telehealth partner's own system. Supabase is the identity/lead-capture layer, not the clinical/order system of record.

## Key Files
None directly in this directory — see Subdirectories.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | 3 SQL migrations defining `funnel_leads`/`funnel_orders`, `waitlist`, and `profiles` (+ their RLS policies and SECURITY DEFINER RPCs). See `migrations/AGENTS.md`. |

## For AI Agents
### Working In This Directory
- Every table uses Row Level Security (RLS) turned on. Two access patterns are used consistently:
  - **Anon-writable via RPC only** (`funnel_leads`, `funnel_orders`, `waitlist`): RLS is enabled with **zero** policies, meaning the PostgREST Data API exposes nothing directly to any role. The only way in is a `SECURITY DEFINER` SQL function (`save_funnel_lead`, `join_waitlist`) granted `EXECUTE` to `anon`, each scoped to insert/upsert exactly one row with a whitelisted set of columns and no read path back out. This is a deliberate write-only funnel pattern — do not add direct table policies to these tables; add/extend the RPC instead.
  - **Owner-scoped via policies** (`profiles`): RLS policies directly compare `auth.uid() = id`, giving each signed-in user read/update access to only their own row. No anon access at all — this table only exists for authenticated users. Row creation is automatic via a trigger (`handle_new_user`, also `SECURITY DEFINER`) on `auth.users` insert, not client-initiated.
- `search_path = ''` is set on every `SECURITY DEFINER` function — this is a deliberate hardening measure against search-path-hijacking attacks and should be preserved in any new SECURITY DEFINER function.
- Client access originates from `src/lib/supabaseClient.ts` (a generic Supabase client helper referenced in `WAITLIST.md`/`netlify.toml`) for browser-side RPC calls, and from `netlify/functions/lib/verify-supabase-token.js` server-side for token verification only (no service-role key is used anywhere in this repo — verification goes through Supabase's own public Auth API, not a local JWT check).

### Testing Requirements
- No automated tests. Changes should be verified by applying the migration to a Supabase project (dashboard SQL editor or CLI) and exercising the relevant RPC/auth flow manually.

### Common Patterns
- `created_at`/`updated_at` timestamptz columns with a shared `set_updated_at()` trigger function (defined once in migration 0001, reused by later migrations — do not redefine it).
- Card/payment data is never stored — `funnel_orders` deliberately stores only `gateway`/`gateway_transaction_id` references, per an explicit design comment in 0001.

## Dependencies
### Internal
None — this is a leaf directory relative to the rest of the repo.

### External
- Supabase (Postgres + Auth + PostgREST) — the hosting platform itself.
- Consumed by `netlify/functions/lib/verify-supabase-token.js` and `netlify/functions/keepSupabaseAlive.js` on the backend, and by the frontend's Supabase client for funnel/waitlist RPC calls and Auth sign-up/sign-in.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
