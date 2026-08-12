<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# supabase/migrations/

## Purpose
Three sequential, numbered SQL migrations that define Freeley's entire Supabase schema. No migration tooling config is checked into the repo (no `config.toml`); filenames follow a manual `NNNN_description.sql` convention applied in order. Each migration is self-contained (creates tables, enables RLS, defines any RPCs it needs) and later migrations explicitly comment on what they reuse from earlier ones.

## Key Files
| File | Chronological Order | Schema Changes |
|------|---------------------|-----------------|
| `0001_funnel_leads.sql` | 1st | Creates `public.funnel_leads` (one row per quiz/assessment session — contact info, consent timestamp, multi-select `goals`/`symptoms` text arrays, demographics, medical-history free text, funnel completion state) and `public.funnel_orders` (checkout orders referencing `funnel_leads`, gateway-agnostic payment references only, no card data — `plan_months`/`amount_cents`/`status` with a CHECK-constrained status enum). Adds indexes on `created_at` and `email`. Enables RLS on both tables with **no policies** (nothing reachable via Data API). Defines `public.set_updated_at()` (generic `updated_at` trigger function, reused by later migrations) and `public.save_funnel_lead(...)` — a `SECURITY DEFINER` upsert RPC (18 optional params, `COALESCE`-based partial-update semantics so partial payloads never erase earlier answers) granted `EXECUTE` to `anon`. This is the funnel's sole write path from the browser. |
| `0002_waitlist.sql` | 2nd | Creates `public.waitlist` (`id`, `created_at`, `email` — unique, regex-validated, `source` text) with an index on `created_at`. Mirrors 0001's security model: RLS enabled, zero policies. Defines `public.join_waitlist(p_email text)` — a `SECURITY DEFINER` insert RPC (lowercases/trims the email, `ON CONFLICT (email) DO NOTHING` for idempotency) granted `EXECUTE` to `anon`. This backs the "coming soon" gate's `/waitlist` signup form (see root `netlify.toml`, `WAITLIST.md`). |
| `0003_patient_profiles.sql` | 3rd | Creates `public.profiles` (`id` — FK to `auth.users(id)` with `ON DELETE CASCADE`, `created_at`, `updated_at`, `email`, `full_name`) for the `/hub` patient portal. Enables RLS with two owner-scoped policies (`auth.uid() = id`, select + update, `authenticated` role only — no anon access at all, unlike 0001/0002). Defines `public.handle_new_user()` — a `SECURITY DEFINER` trigger function that auto-inserts a `profiles` row (`ON CONFLICT (id) DO NOTHING`) whenever a row is inserted into `auth.users`, pulling `full_name` from `raw_user_meta_data` (works for both email sign-up and Google OAuth). Attaches this via an `AFTER INSERT ON auth.users` trigger, and reuses `set_updated_at()` from migration 0001 for a `profiles_updated_at` trigger rather than redefining it. Explicitly `REVOKE EXECUTE ... FROM PUBLIC` on `handle_new_user()` to close the PostgREST RPC endpoint that would otherwise be implicitly exposed (Postgres grants EXECUTE to PUBLIC by default at function creation). |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Apply migrations in filename order (`0001` → `0002` → `0003`); each assumes the objects created by earlier ones exist (e.g. `0003` reuses `set_updated_at()` from `0001` and does not redefine it — do not duplicate it in future migrations).
- When adding a new migration, follow the naming convention `NNNN_description.sql` (next number: `0004`), and follow the established security pattern for the table's intended access:
  - Anon-writable, funnel/lead-style data → RLS on, zero policies, one `SECURITY DEFINER` RPC granted to `anon` that inserts/upserts a whitelisted column set and returns minimal/no data (see `save_funnel_lead`, `join_waitlist`).
  - User-owned data → RLS on with `auth.uid() = id`-style policies scoped to `authenticated`, no anon policies.
  - Any new `SECURITY DEFINER` function must set `search_path = ''` (hardening against search-path hijacking) — every existing function does this.
  - Any trigger function on `auth.users` (like `handle_new_user`) must explicitly `REVOKE EXECUTE ... FROM PUBLIC` since Postgres exposes it via PostgREST RPC by default otherwise.
- No `down`/rollback migrations exist — schema changes are forward-only in this repo.

### Testing Requirements
- No automated migration tests. Verify by running the SQL against a Supabase project (SQL editor or `psql`) and confirming: RLS is enabled, the RPC/policies behave as intended (e.g. `anon` really cannot `SELECT` from `funnel_leads` directly), and any Data API/PostgREST endpoints implicitly created by new functions are revoked if they shouldn't exist.

### Common Patterns
- Card/payment data is never stored in any table — only gateway references (see `funnel_orders.gateway_transaction_id`).
- `text[]` (Postgres array) is preferred over join tables for small, fixed-cardinality multi-select answers (`goals`, `symptoms` in `funnel_leads`) since the catalog is defined client-side and fixed at 4 product lines.
- CHECK constraints are used liberally for cheap validation close to the data (email regex, US state 2-letter code, age/weight bounds, status enums) rather than relying solely on application-layer validation.

## Dependencies
### Internal
- `0003_patient_profiles.sql` depends on `0001_funnel_leads.sql` (reuses `set_updated_at()`).

### External
- Supabase's built-in `auth.users` table (Supabase Auth) — referenced by `0003_patient_profiles.sql`'s foreign key and trigger.
- `gen_random_uuid()` (pgcrypto/pgcore, enabled by default on Supabase) — used for default UUID generation in `funnel_orders.id` and `waitlist.id`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
