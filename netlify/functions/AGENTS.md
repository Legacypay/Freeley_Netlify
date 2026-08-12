<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# netlify/functions/

## Purpose
21 Netlify serverless functions (`exports.handler = async (event) => {...}`) forming the entire backend API for Freeley, a telehealth marketing site selling compounded GLP-1/weight-loss, longevity/peptide, hair-loss, and sexual-wellness prescriptions via telehealth. Responsibilities split into five groups: (1) checkout/payment via Stripe or Authorize.Net, (2) submitting patient intake to MD Integrations (MDI, the telehealth/EHR partner) and tracking case status, (3) Supabase-authenticated "patient hub" endpoints (messaging, billing, case details), (4) inbound webhooks from Stripe and MDI, and (5) two scheduled/cron jobs. All functions are called from the frontend at `/.netlify/functions/<name>`.

## Key Files
| File | Method(s) | Purpose | Supabase / External |
|------|-----------|---------|----------------------|
| `captureLead.js` | POST | Fire-and-forget lead capture (email/phone) forwarded to an n8n/Make/Zapier webhook for abandoned-cart follow-up. No DB write. | External webhook (`N8N_WEBHOOK_URL`) |
| `caseStatus.js` | POST, OPTIONS | Auth'd: look up a patient's MDI case status (resolves `case_id` from Netlify Blobs via `voucher_id`/`patient_id` if needed) and return a patient-friendly status object. | Supabase (auth) + MDI API + Blobs |
| `create-authnet-transaction.js` | POST, OPTIONS | Charges a card via Authorize.Net using an Accept.js opaque token; server computes price from `pricing.json`; fires post-charge conversion tracking. Rate-limited (10/min/IP). | Authorize.Net API |
| `create-payment-intent.js` | POST, OPTIONS | Creates a Stripe PaymentIntent; server computes price from `pricing.json`; stashes attribution data in PaymentIntent metadata for later conversion firing. Rate-limited (10/min/IP). | Stripe |
| `getBillingHistory.js` | POST, OPTIONS | Auth'd: fetches a patient's Stripe payment methods + charge history by email lookup. | Supabase (auth) + Stripe |
| `getEncounterDetails.js` | POST, OPTIONS | Auth'd: fetches detailed MDI case/encounter records (clinician assignment, offerings, status timeline, clinical notes) for the patient hub timeline UI. | Supabase (auth) + MDI API |
| `getMessages.js` | POST, OPTIONS | Auth'd: fetches a patient's messages from MDI's Partner Messaging API using the server-side Partner token (no patient 2FA required). | Supabase (auth) + MDI API |
| `getMessagingAuth.js` | POST, OPTIONS | Auth'd: generates a one-time-use MDI messaging auth link + verification code for a patient. | Supabase (auth) + MDI API |
| `getPatientToken.js` | POST, OPTIONS | Auth'd: obtains a patient-scoped MDI bearer token (auth link → 2FA validate flow), with a per-cold-start in-memory cache. | Supabase (auth) + MDI API |
| `health.js` | GET | Static 200 OK health/deploy-verification probe. No auth, no dependencies. | none |
| `keepSupabaseAlive.js` | (scheduled: `@daily`) | Pings `waitlist` table via PostgREST so the free-tier Supabase project doesn't auto-pause after 7 days idle. | Supabase (REST ping) |
| `mdiWebhook.js` | POST | Inbound webhook from MDI (HMAC-SHA256 signature verified). Handles case status transitions (`case_approved`, `case_waiting`, `case_processing`, `case_completed`, `offering_submitted`, `case_created`/`case_assigned_to_clinician`, `message_created`, voucher/patient events); updates order status in Blobs and dispatches patient emails + internal alerts via n8n. | MDI webhook + Blobs + n8n |
| `patientCases.js` | POST, OPTIONS | Auth'd: looks up a patient's case(s) by `voucher_id`/`patient_id` (Blobs fast path) or `email` (MDI API search over vouchers/encounters); maps MDI questionnaire IDs to product names/categories. | Supabase (auth) + MDI API + Blobs |
| `requestMessagingCode.js` | POST, OPTIONS | Auth'd: triggers MDI's Partner 2FA flow to email a one-time verification code to the patient (first step of messaging auth). | Supabase (auth) + MDI API |
| `retryPendingCases.js` | GET (also scheduled every 15 min via `netlify.toml`) | Reads PHI-encrypted pending MDI case submissions from Blobs (`pending-mdi-cases` store) and retries voucher creation up to `MAX_RETRIES=10`; alerts team via n8n on permanent failure or recovery. | MDI API + Blobs + n8n |
| `savePendingCase.js` | POST, OPTIONS | Called when payment succeeds but MDI case creation fails; validates and PHI-encrypts the submission, persists it to Blobs for `retryPendingCases.js` to pick up, and fires an urgent n8n alert. | Blobs + n8n |
| `sendMessage.js` | POST, OPTIONS | Auth'd: sends a patient→clinician message via MDI's Partner Messaging API using the server-side Partner token. | Supabase (auth) + MDI API |
| `stripeWebhook.js` | POST | Inbound Stripe webhook (signature verified via `STRIPE_WEBHOOK_SECRET`). Handles `payment_intent.succeeded` (fires Meta CAPI/GA4 conversion + internal notify), `payment_intent.payment_failed`, `charge.dispute.created`, `charge.refunded`, `payment_intent.requires_action`. | Stripe + n8n |
| `submitQuiz.js` | POST, OPTIONS | Core intake submission: validates the quiz payload, resolves the product key/dose to an MDI offering, creates an MDI voucher (`POST /v1/partner/vouchers`), persists an order↔voucher record to Blobs, notifies n8n. On 5xx/network failure, queues the (PHI-encrypted) submission into `pending-mdi-cases` for `retryPendingCases.js`. | MDI API + Blobs + n8n |
| `track-conversion.js` | POST | HTTP-callable wrapper around `lib/conversion-tracker.js` for manual/external/redundant conversion firing (most conversions now fire from inside `stripeWebhook.js` instead). Always returns 200, even on internal error. | Meta CAPI + GA4 |
| `validateMessagingCode.js` | POST, OPTIONS | Auth'd: validates the patient's 2FA code against MDI (Partner API, then Patient API for a bearer token) and caches the resulting patient token in memory. | Supabase (auth) + MDI API |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `lib/` | 9 shared utility modules (MDI client, Supabase/Firebase auth verification, PHI encryption, rate limiting, product catalog, quiz validation, conversion tracking, structured logging) imported by the handlers above. See `lib/AGENTS.md`. |

## For AI Agents
### Working In This Directory
- All files use CommonJS (`require`/`exports.handler`), not ESM — consistent with `"type": "commonjs"` in the repo's `package.json`.
- **Auth pattern**: any function touching patient data (case status, messages, billing, encounter details, patient token) requires a Supabase access token in `Authorization: Bearer <token>`, verified via `lib/verify-supabase-token.js`. Unauthenticated requests get `401`. Note `lib/verify-firebase-token.js` also exists (legacy Firebase Auth verifier) but none of the current 21 functions call it — Supabase Auth has fully replaced Firebase for this flow.
- **Two identities are distinguished per call**: the Supabase-authenticated site user (proves *who is asking*) vs. the MDI `patient_id`/patient email (the actual telehealth record, which may differ from the Supabase login email — see `getPatientToken.js`'s email-resolution fallback chain).
- **CORS pattern**: two conventions coexist. Newer/most functions call `getCorsHeaders(event)` from `lib/mdi-client.js` (echoes back `https://freeley.com` or `https://www.freeley.com`, else defaults to the first). A few older ones (`caseStatus.js`, `getBillingHistory.js`, `getEncounterDetails.js`, `patientCases.js`, `submitQuiz.js`) use the static `CORS_HEADERS` export from the same module instead — functionally similar but doesn't vary by request origin. `create-payment-intent.js`/`create-authnet-transaction.js` build their own origin-allowlist headers inline rather than importing from `lib/mdi-client.js`.
- **OPTIONS preflight**: every function that's called from the browser (not webhooks, not scheduled jobs) handles `OPTIONS` explicitly, returning `204` with CORS headers before the method check.
- **Error handling**: outer `try/catch` per handler; errors are logged with a `[BRACKETED TAG]` prefix (e.g. `[SUBMIT QUIZ]`, `[STRIPE WEBHOOK]`) via `console.log`/`console.error`/`console.warn`, and the client gets a generic message — internal error detail is never leaked in the response body. Webhook handlers (`stripeWebhook.js`, `mdiWebhook.js`) deliberately return `500` on failure (not `200`) so the sender retries delivery; all other handlers return `200`/`4xx` even for internal failures where retry isn't wanted (e.g. `track-conversion.js` always 200s to never block the patient flow).
- **PHI handling**: any payload containing patient medical data (`submitQuiz.js`, `savePendingCase.js`, `retryPendingCases.js`) is validated with `lib/validate-quiz.js` and encrypted at rest with `lib/phi-crypto.js` (AES-256-GCM) before being written to Netlify Blobs.
- **Netlify Blobs stores in use**: `mdi-orders` (voucher/order ↔ patient tracking, keyed by voucher_id), `pending-mdi-cases` (failed-submission retry queue, PHI-encrypted), `rate-limits` (sliding-window IP rate limiting).
- **The waitlist gate** (see `../AGENTS.md`) is implemented entirely in `netlify.toml`, not in this directory — no function here contains gating logic. All functions remain reachable via the `/.netlify/functions/*` allow-rule regardless of gate state.

### Testing Requirements
- No automated tests target these functions directly. `npm test` is an unconfigured stub.
- `health.js` is the standard smoke-test endpoint.
- When changing a function, manually exercise it with `netlify dev` (`npm run dev:netlify`) and check the structured console logs for its `[TAG]` prefix.

### Common Patterns
- Price is always computed server-side from `../../pricing.json` (repo root) in both payment-creation functions — the client never sends a dollar amount, preventing price tampering.
- MDI product/questionnaire/offering IDs are centralized in `lib/products.js`; functions never hardcode them.
- Sandbox vs. live MDI environment is controlled by `MDI_LIVE_MODE` env var (`submitQuiz.js`, `retryPendingCases.js`), defaulting to sandbox.
- Conversion tracking (Meta CAPI + GA4) is fired server-side post-payment (primarily from `stripeWebhook.js` and `create-authnet-transaction.js`), never trusting client-only pixels, and strips medical content down to a generic "Telehealth Medical Consultation" label for HIPAA safety.

## Dependencies
### Internal
- `lib/*` — see `lib/AGENTS.md`.
- `../../pricing.json` — pricing source of truth.

### External
See `../AGENTS.md` for the full list (Stripe, Authorize.Net, MDI API, Supabase Auth API, Meta CAPI, GA4 MP, n8n, `@netlify/blobs`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
