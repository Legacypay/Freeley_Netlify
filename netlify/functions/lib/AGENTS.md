<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# netlify/functions/lib/

## Purpose
Shared utility modules (CommonJS, `module.exports = {...}`) imported by the 21 handlers in `netlify/functions/`. Covers the MDI (MD Integrations telehealth partner) API client, authentication token verification (Supabase and legacy Firebase), PHI-at-rest encryption, per-IP rate limiting, the product/pricing catalog, quiz payload validation, server-side ad-conversion tracking, and structured logging.

## Key Files
| File | Exports | Purpose |
|------|---------|---------|
| `mdi-client.js` | `getAccessToken`, `mdiRequest`, `verifyWebhookSignature`, `getCorsHeaders`, `CORS_HEADERS`, `BASE_URL` | Core MDI API client. Handles OAuth2 client-credentials token fetch/caching (`POST /v1/partner/auth/token`), a generic authenticated `mdiRequest(method, path, body)` helper that throws with `.statusCode` set on non-2xx, HMAC-SHA256 webhook signature verification (fails closed if `MDI_WEBHOOK_SECRET` is unset), and the two CORS-header conventions used across `functions/` (dynamic `getCorsHeaders(event)` vs. static `CORS_HEADERS`, both allowlisting only `https://freeley.com`/`https://www.freeley.com`). Also logs a redacted (`preview()`) summary of injected MDI env vars once per cold start for debugging. |
| `verify-supabase-token.js` | `verifySupabaseToken(accessToken)` | Verifies a Supabase Auth access token by calling `GET {SUPABASE_URL}/auth/v1/user` with the anon key — no local JWT signature check, delegates trust to Supabase's own API. Returns `{ uid, email, email_verified, auth_time }` or `null` (never throws). This is the auth check used by every patient-facing function in `functions/`. Reads `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` (falls back to `SUPABASE_URL`/`SUPABASE_ANON_KEY`). |
| `verify-firebase-token.js` | `verifyFirebaseToken(idToken)` | Legacy Firebase ID token verifier — validates the JWT signature locally against Google's rotating public keys (RS256, checks `iss`/`aud`/`exp`/`iat`/`sub`), with an in-memory cert cache respecting `Cache-Control: max-age`. Superseded by `verify-supabase-token.js` for the current auth flow; kept in the codebase but not currently imported by any function in `functions/`. Requires `FIREBASE_PROJECT_ID`. |
| `phi-crypto.js` | `encryptRecord(record)`, `decryptRecord(stored)`, `PHI_FIELDS` | AES-256-GCM encryption at rest for PHI persisted to Netlify Blobs. `encryptRecord` splits a record into PHI fields (`patient`, `quiz_answers`, `allergies`, `current_medications`, `medical_conditions` — the `PHI_FIELDS` list) vs. plaintext metadata (status, timestamps, retry_count, etc.), encrypting only the PHI subset; `decryptRecord` reverses this and is backward-compatible with pre-encryption plaintext blobs (checks `_v === 1` schema marker). Requires `PHI_ENCRYPTION_KEY` (32 bytes, hex or base64). Used by `savePendingCase.js` and `retryPendingCases.js`. |
| `rate-limit.js` | `allow(event, { key, limit, windowSec })`, `clientIp(event)` | Sliding-window per-IP rate limiter backed by the `rate-limits` Netlify Blobs store. Fails **open** (allows the request) if Blobs is unavailable, so infra hiccups never block checkout. Used by `create-payment-intent.js` and `create-authnet-transaction.js` (10 requests/min/IP). |
| `products.js` | `PRODUCTS`, `PHARMACIES`, `QUESTIONNAIRE_IDS`, `getPharmacyId`, `resolveProductKey`, `SEMAGLUTIDE_TIERS`, `TIRZEPATIDE_TIERS` | The full product catalog mapping Freeley product keys (e.g. `semaglutide-s3`, `olympus-peak`) to MDI `offering_id`/`questionnaire_id`, dosing directions, pharmacy (Strive Pharmacy, direct-to-pharmacy/DTP model), category, and ICD-10 code. `resolveProductKey(productKey, dose)` handles legacy un-tiered keys (`'semaglutide'`, `'tirzepatide'`) by resolving to a specific dose tier via `SEMAGLUTIDE_TIERS`/`TIRZEPATIDE_TIERS` lookup tables, defaulting to the lowest tier. One product (`hair-topical`, GHK-Cu) carries an `_hold: true` flag that `submitQuiz.js` checks to block submission pending FDA/LegitScript clearance. All offering IDs are overridable via env vars with hardcoded fallback defaults. |
| `validate-quiz.js` | `validateQuizSubmission(data)` | Lightweight schema validation for `submitQuiz.js`/`savePendingCase.js` payloads before they touch MDI or get persisted. Validates required patient fields (name, email format via regex, bounded lengths), bounds free-text medical narrative fields (allergies, medications, conditions) to 4000 chars, and validates `quiz_answers` in either array-of-`{question,answer}` or flat-object shape (max 200 items/fields). Returns `{ ok: true, value }` or `{ ok: false, error }`; never throws. |
| `conversion-tracker.js` | `fireConversion(args)`, `hashPII(str)` | HIPAA-safe server-side ad-conversion firing to Meta Conversions API and GA4 Measurement Protocol, run in parallel via `Promise.all`. PII (email/phone/name) is SHA-256 hashed before transmission (`hashPII`); IP/UA/fbp/fbc/UTM params are passed through for attribution. Medical content is **never** sent — both destinations receive a generic `"Telehealth Medical Consultation"` / `"Health & Wellness"` classification instead of drug/condition names. Each destination is skipped silently if its credentials (`META_PIXEL_ID`+`META_ACCESS_TOKEN` / `GA4_MEASUREMENT_ID`+`GA4_API_SECRET`) aren't configured, and network failures are caught and logged rather than thrown. Called from `stripeWebhook.js`, `create-authnet-transaction.js`, and `track-conversion.js`. |
| `logger.js` | `debug`, `info`, `warn`, `error`, `critical` (each `(fn, message, data) => void`) | Structured JSON console logger (`{level, function, message, ...data, ts}`). `error`/`critical` levels also fire a non-blocking Slack alert via `SLACK_WEBHOOK_URL` (colored attachment, best-effort — failures are swallowed). **Not currently imported by any of the 21 functions** — those use raw `console.log`/`console.error` with inline `[TAG]` prefixes instead; this module appears to be an intended-but-unadopted standardization, or reserved for future use. |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Every module here is defensive: helpers that support "critical path" flows (rate limiting, CORS) fail open or degrade gracefully; helpers that guard secrets/PHI (webhook signature check, PHI encryption, auth verification) fail closed (reject/throw) when misconfigured.
- `mdi-client.js`'s token cache and `products.js`'s catalog are module-level singletons — they persist only for the lifetime of one Lambda cold-start instance, not across invocations reliably.
- When adding a new product, extend `PRODUCTS` in `products.js` (with its MDI `offering_id`/`questionnaire_id`) rather than hardcoding IDs in a function file.
- `logger.js` exists but is unused — if asked to add logging to a new function, prefer matching the existing inline `console.log('[TAG] ...')` convention used throughout `functions/` unless explicitly asked to adopt `logger.js`.

### Testing Requirements
- No unit tests exist for this directory. Validate changes by invoking the consuming function through `netlify dev` and inspecting console output.

### Common Patterns
- All auth verifiers (`verify-supabase-token.js`, `verify-firebase-token.js`) return `null` on any failure rather than throwing, so callers can do a simple `if (!user) return 401`.
- Modules requiring a secret env var (`phi-crypto.js` → `PHI_ENCRYPTION_KEY`, `mdi-client.js` → `MDI_CLIENT_ID`/`MDI_CLIENT_SECRET`) throw synchronously with a descriptive message rather than silently no-op'ing, since these represent unrecoverable misconfiguration.

## Dependencies
### Internal
None — these are the leaf/shared modules; nothing here imports from `functions/*.js`.

### External
- Node built-in `crypto` — used by `phi-crypto.js` (AES-256-GCM), `verify-firebase-token.js` (RSA-SHA256 JWT verification), `conversion-tracker.js` (SHA-256 hashing), `mdi-client.js` (HMAC-SHA256 webhook signatures).
- `@netlify/blobs` — used by `rate-limit.js`.
- MDI API (`api.mdintegrations.com`), Supabase Auth API, Google's public-key endpoint (Firebase verifier), Meta Graph API (Conversions API), Google Analytics Measurement Protocol, Slack incoming webhook — all called via native `fetch`, no SDK dependency.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
