# Security audit — 2026-09-01 (pre-launch)

Full read of `netlify/functions/`, `supabase/migrations/`, the Hub client
(`src/lib/hub/`), checkout and the quiz scripts. Every finding below was
confirmed in source before being fixed. Status column = state after the
fixes shipped the same day.

| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| C1 | Critical | `get_funnel_orders_for_email(text)` was SECURITY DEFINER, took the email as a parameter and was granted to `anon` → anyone with the public anon key could dump any patient's orders (treatment, amounts, card brand/last4, CIM ids, subscription id) straight through PostgREST. | Migration `0009`: replaced by `get_my_funnel_orders()` which reads the email from `auth.jwt()`; `authenticated` only; old function dropped. `lib/funnel-orders.js` forwards the patient's own access token. | Fixed |
| C2 | Critical | `cancel_subscription_for_email` granted to `anon`; with C1 an attacker had both inputs and could flip another patient's subscription to `canceled` locally (Authorize.Net keeps billing, Hub hides the cancel button). | Same migration: `cancel_my_subscription(text)`, JWT-bound, `authenticated` only; old function dropped. | Fixed |
| C3 | Critical | `getPatientToken.js` minted a live MDI patient bearer token for ANY `patient_id` — no `verifyPatientOwnership`, and it preferred the email inside MDI's `auth_link` over the session email. | Ownership gate added (404, non-distinguishing); `auth_link` email only honored when it equals the verified user's. | Fixed |
| C4 | Critical | `getMessagingAuth.js` returned MDI's one-time login link + verification code for ANY `patient_id`. | Same ownership gate. | Fixed |
| H1 | High | `submitQuiz.js` created real, billable MDI encounters with no rate limit and no proof of payment (`payment.transaction_id` was only copied into metadata). | 5/min/IP rate limit + `lib/authnet-verify.js`: read-only `getTransactionDetailsRequest` against OUR merchant account; missing/declined/voided/refunded/not-found → 402. Fails open only on gateway outage (loud warning). `SIM-` ids only while simulate mode is genuinely active. Confirmed production has the Transaction Details API enabled (`E00040` for an unknown id = API answering). | Fixed |
| H2 | High | `savePendingCase.js`: unauthenticated, unrate-limited, blob key = client-supplied id → forge queue entries that `retryPendingCases` turns into vouchers, or overwrite a paying patient's queued case. | Rate limit, same payment verification, never overwrites an existing key. | Fixed |
| H3 | High | `save_funnel_order` and `save_funnel_lead` executable by `anon`. Fake `paid` rows for a known `lead_id`; overwrite of a lead's clinical answers if its uuid leaks (it sits in `sessionStorage`). | **Open.** Needs a `SUPABASE_SERVICE_ROLE_KEY` in Netlify so the server can call them as `service_role`; then revoke `anon`. `save_funnel_lead` is also called directly by the quiz browser code (`asw.js`) and would need routing through a function first. | Open — needs service-role key |
| M1 | Medium | `captureLead.js` logged raw email + phone, echoed them back, no rate limit. | Hashed tag in logs, no echo, 20/min/IP. | Fixed |
| M2 | Medium | `submitQuiz.js` sends the patient email to the n8n webhook (`Freeley_Quiz_MDI_Submission`). | **Left as is** — that webhook feeds the client's CRM and removing the email would break it; decide with the client whether n8n should receive a hashed id instead. | Open — client decision |
| M3 | Medium | `checkAdditionalApprovals.js` "publicly callable". | Netlify scheduled functions are not invocable over HTTP in production (only under `netlify dev`), so not reachable. | Not applicable |
| M4 | Medium | `AUTHNET_SIMULATE=true` in production would make checkout free and create Hub accounts for any email. | `lib/authnet-config.js`: simulate is ignored whenever `AUTHNET_ENV=production` **and** Netlify `CONTEXT=production`. Deploy previews keep working (the var itself is kept on purpose for dev testing). | Fixed |
| M5 | Medium | CSP allows `unsafe-inline`/`unsafe-eval` and broad wildcards. | **Left as is** — checkout/quiz rely on inline scripts; tightening is a separate project (nonces or hashes). | Open |
| L1 | Low | Hub rendered `receipt_url` / `tracking.link` into `href` without an `https:` check. | `safeHref()` in `src/lib/hub/dom.ts`; both sites use it. | Fixed |
| L2 | Low | Quiz answers in `sessionStorage`. | Inherent to the current flow; mitigated by L1/M5 work. | Open |
| L3 | Low | `escapeHtml` didn't escape `'`. | Added `&#39;`. | Fixed |

## Verified as fine

Every Hub endpoint verifies the Supabase token first; `caseStatus`, `getOrders`,
`getEncounterDetails`, `patientCases` route ids through `resolveOwnedOrder`;
`getMessages`, `sendMessage`, `requestMessagingCode`, `validateMessagingCode`
call `verifyPatientOwnership`. Pricing/promos are server-side only. All three
webhooks verify signatures and fail closed. Every SECURITY DEFINER function pins
`search_path = ''`. RLS is on with no permissive policies on `funnel_leads`,
`funnel_orders`, `waitlist`. No secrets committed; `.env*` ignored. HSTS,
X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy set.

## Not covered by this pass

`mdiWebhook.js` handler bodies beyond signature verification (spot-checked
only), `lib/phi-crypto.js` key management, `lib/conversion-tracker.js` hashing,
`authnetWebhook.js` post-verification logic.

## Environment notes found on the way

- The sandbox Authorize.Net credentials shared in chat (`4cmHq2ubX8Qs`) now
  fail `authenticateTestRequest` (E00007) — the sandbox transaction key has
  been regenerated or was never that value. Whatever key Netlify holds in
  `AUTHNET_TRANSACTION_KEY` is what sandbox checkout actually runs with. This
  also means yesterday's "ARB not enabled in sandbox" conclusion may simply
  have been a bad key.
- Production env (`netlify env:list --context production`) shows
  `AUTHNET_LIVE_API_LOGIN_ID` / `AUTHNET_LIVE_CLIENT_KEY` but **no**
  `AUTHNET_LIVE_TRANSACTION_KEY` / `AUTHNET_LIVE_SIGNATURE_KEY` and no
  `SUPABASE_SERVICE_ROLE_KEY`. Flipping `AUTHNET_ENV=production` today would
  fall back to the un-prefixed (sandbox) transaction key and fail with E00007.
