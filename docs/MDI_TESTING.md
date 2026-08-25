# MDI test mode & "test case" tagging

MD Integrations bills every live encounter that is not tagged as a test case
(go-live email, 2026-08-21: *"If you submit any test orders, please be sure to tag
them as 'test case'. Otherwise, they will be treated as real encounters and you
will be charged accordingly."*).

This document describes how Freeley guarantees that, based on the official MDI
partner API docs (Postman collection `14212272/2s8Yt1r9B8`).

## TL;DR — current state (2026-08-25, verified end-to-end against the real MDI API)

| Where | Value | Meaning |
|---|---|---|
| Netlify `freeley-health` → `MDI_LIVE_MODE` | `true` | Partner is Active; live environment id is sent |
| Netlify `freeley-health` → `MDI_ALLOW_LIVE_ORDERS` | **unset** | → **every voucher is a TEST voucher** (`demo: true`) |
| Netlify `freeley-health` → `MDI_CLIENT_ID`/`MDI_CLIENT_SECRET` | **Sandbox** OAuth app | See "MDI's own Sandbox/Production/Live apps" below |

Nothing is created in MDI and nothing is billed until `MDI_ALLOW_LIVE_ORDERS=true`
is deliberately added. Going live is a two-flag decision, never an accident.

### MDI's own Sandbox / Production / Live OAuth apps

Beyond the `demo`/`environment_id` mechanism below, the MDI partner portal
(Integration → Credentials) issues **three separate OAuth client id/secret pairs**
for this partner: "Freeley Sandbox API", "Freeley Production API", and "Freeley
Live API" (Production and Live appear to be duplicates of the same thing —
unconfirmed with MDI). These are genuinely different MDI-side environments, not
just a flag on the voucher. Netlify's `MDI_CLIENT_ID`/`MDI_CLIENT_SECRET` were
found to be stale/wrong credentials (matching none of the three) during this
session's verification — fixed by setting the **Sandbox** pair in Netlify's
`dev`, `branch-deploy`, `deploy-preview`, and `production` contexts. Verified via
`GET /v1/partner` → `{"name":"Freeley","active":true}` and by creating vouchers
that show up in the MDI portal's Vouchers list tagged **Sandbox**. A copy of all
three credential pairs (Sandbox active, Production/Live commented out) lives in
the local `.env` (gitignored) for reference — see that file before ever touching
these values.

## What the MDI docs say

`POST /v1/partner/vouchers` (Partners › Vouchers › Create voucher) accepts:

| field | type | notes |
|---|---|---|
| `questionnaire_id` | uuid, **required** | intake form |
| `demo` | boolean | *"Demo vouchers will not create any patient or cases and will not expire. Default false"* |
| `metadata` | string(255) | free text, echoed back and visible on the voucher |
| `offerings[]` | `{ id, product? }` | the product(s) — **not** a top-level `offering_id` |
| `hold_status`, `patient_id`, `expires_at`, `diseases[]`, `pharmacy_id` | | optional |

Response: `{ partner_voucher_id, onboarding_url, demo, case_id, environment_id, metadata, … }`
(**not** `id`).

Tags (Partners › Tags, Partners › Cases › Tags):

- `GET /v1/partner/tags?type=global` / `POST /v1/partner/tags { name, key, type, color, description }`
- `POST /v1/partner/cases/:case_id/tags/:tag_id { notes }` — a tag can only be attached
  once a **case** exists (the voucher has been redeemed by the patient).

Simulation endpoints (`/v1/partner/tests/*`) let you push an encounter through
status / prescription / reassignment without a real clinician.

There is a single base URL (`https://api.mdintegrations.com`); sandbox vs live is
a property of the voucher/patient (`environment_id`), not a different host.

## How Freeley applies it

All logic lives in `netlify/functions/lib/mdi-voucher.js` and is shared by
`submitQuiz.js` and `retryPendingCases.js`.

### Decision matrix

| `MDI_LIVE_MODE` | `MDI_ALLOW_LIVE_ORDERS` | `MDI_FORCE_TEST` | email matches `MDI_TEST_EMAIL_PATTERNS` | Result |
|---|---|---|---|---|
| anything | anything | `true` | – | **TEST** |
| anything | anything | – | yes | **TEST** |
| ≠ `true` | – | – | – | **TEST** |
| `true` | ≠ `true` | – | – | **TEST** (current production) |
| `true` | `true` | – | no | **LIVE** |

### Two levels of test

| `MDI_TEST_FULL_FLOW` | Voucher | Creates patient/case? | How MDI sees it |
|---|---|---|---|
| unset / `false` (default) | `demo: true`, `metadata: "TEST CASE \| freeley:<product>"` | **No** | Demo voucher — nothing to bill |
| `true` | `demo` omitted, `metadata: "TEST CASE \| …"` | Yes (real onboarding, real clinician) | Voucher `metadata` carries `TEST CASE` from second zero. The global **`test-case`** tag is attached to the encounter by two independent paths (`lib/mdi-tags.js`, idempotent via `test_tagged_at` on the `mdi-orders` blob): (1) `mdiWebhook.js` on the first event carrying a `case_id`; (2) a sweep inside the 15-minute `retryPendingCases` cron that asks `GET /v1/partner/vouchers/:id` for `case_id` and tags it. |

⚠️ Full-flow creates a **real encounter**. Until the tag lands (≤15 min after the
patient redeems the voucher, via the sweep), the only marker MDI sees is the
voucher `metadata`. We have not confirmed with MDI that voucher `metadata`
is surfaced on the case to their billing team — treat full-flow as "tagged
within 15 minutes", not "tagged instantly". Use it only when you actually
need to exercise onboarding / clinician review, and only with an email that
matches `MDI_TEST_EMAIL_PATTERNS`.

### Runtime guards (both `submitQuiz.js` and `retryPendingCases.js`)

- **Demo echo check** — if we asked for `demo: true` and MDI did not echo
  `demo: true`, the order is stored with `demo_mismatch: true`, a `🚨 DEMO MISMATCH`
  line is logged and an `mdi_demo_mismatch` alert is sent to n8n. Treat it as a
  possibly billable encounter and tag it in the portal.
- **Orphan guard** — a 2xx response without a recognisable voucher id is **not**
  retried (that would create duplicate vouchers). `submitQuiz` records it in the
  `mdi-orphaned-vouchers` blob store and alerts (`mdi_voucher_orphaned`);
  `retryPendingCases` marks the record `orphaned`.

### Env vars

| Var | Default | Purpose |
|---|---|---|
| `MDI_LIVE_MODE` | unset (→ sandbox env id) | Existing flag: partner is Active, send live `environment_id` |
| `MDI_ALLOW_LIVE_ORDERS` | unset | **Must be `true` to create un-tagged live vouchers** |
| `MDI_FORCE_TEST` | unset | Kill switch: force TEST regardless of the two above |
| `MDI_TEST_EMAIL_PATTERNS` | unset | Comma-separated, case-insensitive substrings (`@freeley.com,+test@`); matching emails are always TEST |
| `MDI_TEST_FULL_FLOW` | unset | TEST vouchers create a real patient/case (tagged) instead of `demo: true` |
| `MDI_SEND_ENVIRONMENT_ID` | unset (→ send) | Set `false` to drop the undocumented `environment_id` field if MDI ever rejects it |
| `MDI_DEBUG_LOG_RESPONSES` | unset | `true` logs full MDI voucher responses (may contain PHI — keep off in production) |
| `MDI_PARTNER_ID` | fallback: `f81508d1-…` | Partner ID (logging only in `submitQuiz.js` — not sent to MDI's API) |
| `MDI_SANDBOX_ENV_ID` | fallback: `6ab0181e-…` | `environment_id` sent for sandbox/test vouchers |
| `MDI_LIVE_ENV_ID` | fallback: `b374c499-…` | `environment_id` sent for live vouchers |
| `MDI_TEST_TAG_KEY`/`MDI_TEST_TAG_NAME`/`MDI_TEST_TAG_COLOR` | `test-case` / `Test Case` / `#f59e0b` | The MDI tag `lib/mdi-tags.js` creates/attaches for full-flow test cases |
| `MDI_APPROVAL_CHECK_STATUSES` | `Assigned,Waiting` | Case statuses `checkAdditionalApprovals.js` scans (see below) |

All of the above are set as real values in Netlify (not just code fallbacks) —
see `netlify.toml`'s env var comment block for the authoritative list. Fallback
literals only exist so the code degrades gracefully, never so a value is
implicitly hardcoded.

Every voucher creation logs `mode: TEST|LIVE (<reason>) | demo: <bool>` under
`[SUBMIT QUIZ]` / `[RETRY MDI]`, and the `mdi-orders` blob stores
`is_test`, `test_reason`, `demo`, `mdi_metadata`, `environment_id`.

## "Approved (Action Required)" ≠ the `case_approved` webhook

MDI's go-live guidance (2026-08-21) says: *"Please regularly review encounters in
Approved status. These indicate cases where a doctor is requesting a change in
treatment or titration... someone on your team will need to review and move the
encounter back to Assigned to proceed."*

**"Approved" is not one of the documented case statuses** (Created, Assigned,
Waiting, Cancelled, Support, Processing, Completed — Postman docs, "Partners ›
Cases › Get cases by status"). It's almost certainly the documented
**`is_additional_approval_needed`** case flag, queryable via
`POST /v1/partner/cases/status/:status { is_additional_approval_needed: true }`
(confirmed working against the real API this session — 200 OK, `{data, links, meta}`).

`mdiWebhook.js`'s existing `case_approved` webhook handler (which emails the
patient "Great news! Your prescription has been approved") is a **separately
documented concept** — we could not confirm from the public docs whether it's the
same event as this portal status, so it was deliberately left untouched rather
than guessed at and possibly broken.

Instead, `checkAdditionalApprovals.js` (new, scheduled hourly) polls the
confirmed `is_additional_approval_needed` mechanism directly and alerts the team
via n8n the first time each case is seen (dedup in the `mdi-approval-alerts`
Blobs store) — Encounter ID only, no PHI. If MDI later confirms `case_approved`
*is* the same thing, the two mechanisms can be merged; until then this is the
one confirmed-correct signal.

## PHI in internal (Slack-bound) alerts

Per the same go-live guidance: *"Do not share any patient-identifiable
information. The encounter ID is what comes in the URL after cases/..."* — i.e.
case_id is explicitly the safe identifier. `mdiWebhook.js`'s internal alerts
(→ n8n → Slack, per the partner's `slack_channel_id`) previously included
`patient_email` on every event; this was removed (all 7 call sites) so internal
alerts now carry only `case_id`/`patient_id`/`voucher_id` — never email or
message content. `checkAdditionalApprovals.js` follows the same rule from day one.

## Verifying the environment (no Slack needed)

```bash
npm run mdi:verify          # = npx -y netlify-cli dev:exec node scripts/mdi-verify-env.js
                            # (requires `netlify login` + `netlify link` once, so the site's env vars are injected)
```

The script authenticates, calls `GET /v1/partner`, creates a `demo: true` voucher
with `metadata: "TEST CASE | env-check …"`, prints `partner_voucher_id`,
`environment_id`, `onboarding_url` and the echoed `demo` flag, then deletes the
voucher. Exit `0` only if MDI echoed `demo: true`. It never creates a patient, a
case, or a billable encounter. Options: `--product <key>`, `--email <addr>`, `--keep`.

Unit tests for the decision logic and tagging: `npm run test:unit`.
`tests/integration-check.js` is a manual, older harness for the `submitQuiz` handler
and is not wired into any script.

For a real end-to-end check of the actual `submitQuiz.js` function (not just
`lib/mdi-voucher.js`'s logic), run `npm run test:mdi` — a separate Playwright
suite (`playwright.functions.config.ts` + `tests/functions/`) that starts
`astro dev` + `netlify dev` and makes real HTTP calls to the deployed-shaped
function, hitting the real MDI API through the Sandbox credentials. See that
config file's comments for the exact `netlify dev` invocation this needs on
Windows (Astro 7's dev server daemonizes, which trips up netlify-cli's process
supervision unless started this specific way).

## Known gap: the live checkout flow does not call any of this

As of 2026-08-25, no page under `src/` or `public/` actually calls
`submitQuiz.js`. `QuizModal.astro`'s funnel (`public/quiz-scripts/asw.js`) ends
by redirecting to `/checkout`, and `checkout.astro`'s `processPayment()` is a
fully fake, client-only flow (`setTimeout`, no network call — see
`tests/e2e/checkout-and-waitlist.spec.ts`'s scope comment). The MDI backend
described in this document is fully built and verified against the real API,
but is currently unreachable from a real patient journey. Wiring checkout to a
real payment processor and then to `submitQuiz.js` is a separate, larger
initiative (real money movement, PCI/compliance surface) — deliberately not
attempted as part of the test-mode work this document describes.

## Deploy note

With the current production env (`MDI_LIVE_MODE=true`, no `MDI_ALLOW_LIVE_ORDERS`),
deploying this makes **every** submission a demo voucher: MDI creates no patient
and no case, and the onboarding URL will not lead to a real encounter. That is
intended while the site sits behind the waitlist gate. Do not remove the gate
without either flipping `MDI_ALLOW_LIVE_ORDERS=true` or accepting that real
customers would get demo vouchers.

## Going live (when the time comes)

1. Run `npm run mdi:verify` and confirm `demo: true` is echoed and `environment_id`
   is the live one.
2. Set `MDI_TEST_EMAIL_PATTERNS` so internal QA emails stay test orders.
3. Add `MDI_ALLOW_LIVE_ORDERS=true` in Netlify (production context) and redeploy.
4. Watch the first `[SUBMIT QUIZ] … mode: LIVE (live)` log line.
5. Emergency stop: set `MDI_FORCE_TEST=true` (no code change needed).
