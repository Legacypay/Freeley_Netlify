<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/lib/hub/

## Purpose
All business logic for the `/hub` Health Hub patient portal, factored out of what used to be one large inline `<script>` in `hub.astro` (plus the old static `public/hub-tabs.js`). Every module here is a real ES module imported directly by `src/components/hub/*.astro` component scripts or by `src/pages/hub.astro`'s own page-level script. Talks to a live Netlify Functions backend (`/.netlify/functions/*`, under `netlify/functions/`) for patient data, and to Supabase directly for authentication. This is real functionality against a real backend, not a mock.

## Key Files
| File | Description |
|------|-------------|
| `supabase.ts` | Creates the **single** Supabase client for the whole Hub page (`createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)`), exported as `supabase`. Every other module here transitively imports it, guaranteeing (via ES module evaluation order) that its top-level `supabase.auth.onAuthStateChange(...)` listener registers before any importer's own script body runs. That listener dispatches a `window` `CustomEvent('hub:auth', { detail: { email, displayName } })` whenever a session exists (initial restore, sign-in, token refresh) — the deliberate decoupling point between "auth state" and "which screen is showing." The file's top comment documents a specific ordering bug this structure was written to make structurally unreachable. |
| `auth.ts` | Auth actions, re-exported as named functions (was `window.hubAuth`). `signUp(email, password, name?)` — handles Supabase's no-error-on-duplicate-email behavior by inferring `status: 'new' | 'existing_confirmed' | 'existing_unconfirmed'` client-side from `user.identities`/`user.created_at`. `signIn(email, password)`, `googleSignIn()` (OAuth redirect flow, not popup), `signOut()`, `resetPassword(email)`, `accessToken(): Promise<string>` (reads the current session's access token, used by `api.ts`). All auth redirects (`emailRedirectTo`/`redirectTo`) use `returnUrl()` — the *current* URL, read at call time, rather than a hardcoded `/hub`, because the site's waitlist-gate rewrite serves this page at `/preview/hub` pre-launch. |
| `api.ts` | One shared `authFetch(fn, body)` helper that POSTs JSON to `/.netlify/functions/${fn}` with an `Authorization: Bearer ${accessToken}` header (from `auth.ts`), replacing ~8 duplicated fetch-with-auth-header call sites. Exports typed wrappers: `getCases`, `getCaseStatus`, `getMessages`, `sendMessage`, `getBillingHistory`, `getEncounterDetails`, `requestMessagingCode`, `validateMessagingCode`. |
| `dashboard.ts` | Overview/Treatments/Records/Billing panel data loading and rendering (was inline in `hub.astro` plus the old `public/hub-tabs.js`). Exports `refreshCaseStatus()` (drives the Treatments-tab MDI status card and mirrors a summary into the Overview panel via `updateOverviewFromCaseStatus`), `loadLatestProviderMessage()`, `loadOverviewCases()` (the Overview tab's main fetch — pulls the patient's latest case, persists ids into `sessionStorage`, and kicks off both of the above), `loadMedicalRecords()`, `loadBillingHistory()`. All render via string-built `innerHTML` (not Astro templating) into ids owned by the matching `Hub*Panel.astro` component. |
| `chat.ts` | Secure-messaging chat widget logic (was the "in-app chat" section of `hub.astro`'s big script). Exports `openMessaging()` (called from `HubOverviewPanel.astro`'s buttons — checks for a `freeley_patient_id` in `sessionStorage` first) and `initChat()` (wires the drawer's static controls: close, backdrop-click, send button, textarea auto-resize — called once by `HubChatWidget.astro`). Internally implements a full 2FA flow: request-code → (email-mismatch fallback: manual email entry) → code-entry → verify → live chat with 15s polling while the drawer is open. |
| `dom.ts` | Two tiny shared helpers: `setText(id, value)` (null-safe `textContent` setter by id) and `escapeHtml(str)` (manual `&`/`<`/`>`/`"` escaping for all the `innerHTML`-built markup in `dashboard.ts`/`chat.ts`). |
| `products.ts` | Two lookup tables shared by the Overview and Treatments panels: `PRODUCT_NAMES: Record<string, string>` (internal product keys like `tirzepatide`, `hair-women-45plus`, `olympus-peak` → human-readable display names with their vertical) and `PRODUCT_IMG: Record<string, string>` (product key → thumbnail path; only `tirzepatide`/`semaglutide` have entries, others fall back to a default image in `dashboard.ts`). |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- **Do call Supabase directly** for auth (`auth.ts`/`supabase.ts`) but **route all patient data through `api.ts`'s `authFetch`** to the Netlify Functions backend — the two data paths are intentionally separate (auth via Supabase Auth, patient records via Netlify Functions + `netlify/functions/`, which may talk to a different system entirely).
- Never reference another module's DOM-scoped state via `window.*` globals — always use real `import`/`export`. This was a deliberate refactor away from a bug class (see `supabase.ts`'s top comment: a same-page global referenced before assignment silently killed a `hub:auth` listener).
- Functions in `dashboard.ts` and `chat.ts` build HTML via string concatenation + `escapeHtml()`, not Astro components — this is why the components that host their output (`HubBillingPanel.astro`, `HubChatWidget.astro`, records rendering) use `<style is:global>` rather than Astro's scoped styles.
- `sessionStorage` (not `localStorage`) is the persistence layer for in-flight patient/case identifiers (`freeley_patient_id`, `freeley_case_id`, `freeley_patient_email`, `freeley_voucher_id`, `freeley_product`, `freeley_patient_token`) — read/write consistently across `dashboard.ts` and `chat.ts` rather than introducing a new storage key.

### Testing Requirements
No automated tests. Verify by running the dev server against a real Supabase project + the Netlify Functions backend (or `netlify dev`), signing into `/hub`, and exercising each panel and the chat 2FA flow end-to-end.

### Common Patterns
- Every exported async loader follows the same shape: locate its DOM containers by id, show a loading state, `try/catch` around the fetch, render on success (`innerHTML` + `escapeHtml`), fall back to an `*-empty` element on failure or empty data.
- Status/badge coloring is driven by comparing a raw status string (`approved`/`completed`/`cancelled`/other) to pick a CSS modifier class (`hub-badge--ok`/`hub-badge--bad`/none) — see `loadOverviewCases()` for the reference implementation if adding a new status-driven badge.

## Dependencies
### Internal
- Intra-directory: `dashboard.ts` → `dom.ts`, `products.ts`, `api.ts`; `chat.ts` → `dom.ts`, `api.ts`; `api.ts` → `auth.ts`; `auth.ts` → `supabase.ts`.
- Consumed by `../../components/hub/*.astro` and `../../pages/hub.astro`.
### External
- `@supabase/supabase-js` (`supabase.ts` only). All other modules use native `fetch`/DOM APIs with no additional dependencies. Backend counterpart lives outside `src/`, in `netlify/functions/*`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
