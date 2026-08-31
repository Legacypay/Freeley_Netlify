<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/components/hub/

## Purpose
Markup + scoped styles for the `/hub` Health Hub patient portal — a logged-in dashboard, not a marketing page. These 9 components compose into the single-page-app-like experience `src/pages/hub.astro` renders: sign-in/sign-up, a persistent app shell (topbar + sidebar nav + 4 tabbed panels), and a secure-messaging chat drawer. Business logic (auth, API calls, data rendering) lives in `src/lib/hub/*.ts` and is imported by these components' own `<script>` tags — components here own markup/CSS and thin event wiring only. This whole feature was migrated from a standalone static `public/hub.html` (Firebase Auth) to this Astro + Supabase Auth implementation (git history: "serve the Astro Health Hub at /hub instead of the legacy static page").

## Key Files
| File | Description |
|------|-------------|
| `HubAuthScreen.astro` | Sign-in/sign-up form (`#auth-screen`), Google OAuth button, forgot-password link. Toggles between sign-in/sign-up copy client-side. Calls `signUp`/`signIn`/`googleSignIn`/`resetPassword` from `src/lib/hub/auth.ts`. Hiding this screen and showing the dashboard on success is page-level orchestration in `hub.astro` (listens for the `hub:auth` event), not this component's job. |
| `HubTopbar.astro` | Slim sticky portal header: mobile nav-toggle button, logo, "Hello, {name}" greeting, profile chip (avatar initial + email + patient ID). Does **not** reuse the public `Header.astro` — the marketing nav made no sense inside a logged-in dashboard. Text is filled in by `hub.astro`'s script on the `hub:auth` event. Also owns the set/change-password `<dialog>` (key button on the profile chip → `updatePassword()` from `lib/hub/auth.ts`); on `hub:auth` it decodes the session JWT's `amr` claim and auto-opens the dialog once per tab when the session came from a magic link (`otp`/`magiclink`), since those accounts have no password yet. |
| `HubNav.astro` | Sidebar navigation. Desktop: a permanent icon+label rail. Mobile (`≤900px`): an off-canvas drawer opened by `HubTopbar.astro`'s toggle button, with its own backdrop-click/Escape/resize wiring in its `<script>`. Takes `navItems: HubNavItem[]` prop (`{id, icon, label}[]`, defined and passed by `hub.astro`). Tab-click → panel-switching itself is page-level orchestration in `hub.astro`, since it must reach into every panel component. |
| `HubOverviewPanel.astro` | Default/active tab (`#panel-overview`). Stat rail (case status / next refill / care team — mirrored via `MutationObserver` from text other components already write, not a separate fetch), hero "Current Treatment Plan" card, "Latest Provider Message" card, empty state ("No Active Treatment" → CTA to `/assessment-quiz`). Data loaded by `loadOverviewCases()`/`loadLatestProviderMessage()` from `src/lib/hub/dashboard.ts`, kicked off by `hub.astro` on `hub:auth`. Its own script wires "Message Care Team" buttons to `openMessaging()` from `src/lib/hub/chat.ts`. |
| `HubTreatmentsPanel.astro` | "Active Treatments & Refills" tab (`#panel-treatments`). The MDI (medical case) live case-status card: icon/title/product, refresh button, assigned-clinician block, case-id/last-updated pill row, or an empty state linking to `/assessment-quiz`. Data via `refreshCaseStatus()` (`src/lib/hub/dashboard.ts`), called both by `hub.astro` on tab-select and by this component's own refresh button. |
| `HubRecordsPanel.astro` | "Medical Records & Notes" tab (`#panel-records`). Pure markup shell (loading/content/empty states) — no script of its own; `hub.astro` lazily calls `loadMedicalRecords()` (`src/lib/hub/dashboard.ts`) the first time this tab opens. |
| `HubBillingPanel.astro` | "Billing & Receipts" tab (`#panel-billing`). Two cards: payment methods and invoice history, both rendered via `innerHTML` from `loadBillingHistory()` (`src/lib/hub/dashboard.ts`), lazily called by `hub.astro` on first tab-select. Uses `<style is:global>` since the injected rows (`.hub-pm`, `.hub-table`) never pass through Astro's scoped-style compiler. |
| `HubChatWidget.astro` | Secure-messaging slide-over drawer (`#chatOverlay`). 2FA verify → code-entry → chat flow, entirely driven by `src/lib/hub/chat.ts`'s `initChat()` (called once from this component's own `<script>`). Also uses `<style is:global>` for the same injected-markup reason as the billing panel. |
| `HubPostPaymentBanner.astro` | One-shot success banner shown only when the URL has `?payment=success` (checked client-side in an inline `<script>`, no server logic). 4-step order-progress indicator (Health Quiz → Checkout → Doctor Review → Shipped). Replaces an older auto-dismissing JS toast that could vanish before a slow page finished loading. |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- **Composition order matters**: `hub.astro` renders `HubPostPaymentBanner` → `HubAuthScreen` → (`HubTopbar` → `HubNav` → the 4 panels, inside `#dashboard-screen`) → `HubChatWidget` → `QuizModal`. `#dashboard-screen` starts `display: none` and is shown by `hub.astro`'s script on successful auth.
- Panels marked `.hub-panel` (not `.hub-panel.is-active`) start hidden via CSS in `src/styles/hub.css`; `hub.astro`'s `switchPanel()` toggles `.is-active` and, for records/billing, triggers a lazy first-load.
- Components whose bodies get replaced via `innerHTML` at runtime (`HubBillingPanel`, `HubChatWidget`) intentionally use `<style is:global>` — a scoped `<style>` here would silently fail to reach that injected markup since Astro's scoping attribute is only applied to elements present at build time.
- Cross-component calls (e.g. Overview panel's "Message Care Team" button opening the chat drawer) go through real ES module imports (`import { openMessaging } from '../../lib/hub/chat'`), not global `window.*` references — this was a deliberate fix for a real ordering bug documented in `src/lib/hub/supabase.ts`'s top comment.

### Testing Requirements
No automated tests. Verify by running the dev server, signing into `/hub` (Supabase Auth), and exercising each tab + the chat drawer manually. Watch the console for the `hub:auth` event firing exactly once.

### Common Patterns
- Every component here shares the class vocabulary defined in `src/styles/hub.css` (`.hub-card`, `.hub-btn`, `.hub-badge`, `.hub-empty`, `.hub-loading`, `.hub-eyebrow`/`.hub-serif` type language) — genuinely single-owner styles (auth screen, topbar, nav, chat drawer, per-panel-only classes like `.hub-med`/`.hub-status`) live scoped in their own component file instead.
- `data-*` attributes (`data-panel`, `data-pim-*`-equivalents) drive JS wiring rather than ids where an element can repeat (e.g. `HubNav`'s per-item nav-links).

## Dependencies
### Internal
- `../../lib/hub/auth.ts` (HubAuthScreen), `../../lib/hub/chat.ts` (HubChatWidget, HubOverviewPanel), `../../lib/hub/dashboard.ts` (HubTreatmentsPanel; loaded indirectly for Records/Billing/Overview via `hub.astro`), `../../styles/hub.css` (shared classes, imported once by `hub.astro`).
### External
- `@supabase/supabase-js` (via `lib/hub/supabase.ts`, transitively), RemixIcon (`ri-*` icon classes, loaded via CDN link in `hub.astro`'s head).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
