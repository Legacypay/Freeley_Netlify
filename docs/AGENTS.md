<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# docs/

## Purpose
Operator-facing setup/migration documentation. Currently holds a single runbook for the Stripe → Authorize.Net checkout migration: environment variable setup, a deploy-preview test procedure with test card numbers, and the go-live checklist.

## Key Files
| File | Description |
|------|-------------|
| `AUTHORIZE_NET_SETUP.md` | Runbook for migrating checkout from Stripe to Authorize.Net (Accept.js). Covers: what changed (card tokenization now happens client-side via Accept.js instead of Stripe Elements; server charge function is `netlify/functions/create-authnet-transaction.js` instead of `create-payment-intent.js`; confirmation is synchronous instead of webhook-driven); the three Netlify env vars to set (`AUTHNET_API_LOGIN_ID`, `AUTHNET_TRANSACTION_KEY`, `AUTHNET_ENV`); how to test on a Netlify deploy preview using Authorize.Net's official test card numbers and the `?testmode=false` query param (checkout defaults to a payment-bypass test mode otherwise); the go-live steps (enable Transaction Processing Mode, flip `IS_TEST_MODE` default in `checkout.html`, merge the `authorize-net-migration` branch to `main`, bump the service-worker cache version in `sw.js`, do one real low-value test transaction, then rotate the Transaction Key since it was shared in chat); and a rollback note (don't merge the branch; `main` stays on Stripe until then). It also flags that the legacy Stripe files (`create-payment-intent.js`, `stripeWebhook.js`) are left in place unused for easy rollback, and that the frontend-redesign handoff contract still describes the old Stripe flow and needs updating once this merges. |

## For AI Agents
### Working In This Directory
- This is documentation, not code — treat it as the source of truth for the Authorize.Net payment integration's operational details (env var names, test cards, go-live sequence) rather than re-deriving them from `netlify/functions/` alone.
- As of this writing the doc describes a migration still on the `authorize-net-migration` branch, not yet merged to `main`. Check `git log`/current branch and the actual state of `netlify/functions/` before assuming either payment provider is live — the doc itself may be ahead or behind of what's deployed.
- If you complete steps described in this doc (e.g. flipping `IS_TEST_MODE`, merging the branch, rotating the Transaction Key), consider updating this file so it reflects the new current state rather than a pending plan.

### Testing Requirements
- No tests live here. The doc itself specifies the test procedure for the payment flow it documents (Authorize.Net test cards, `?testmode=false`, checking the Authorize.Net dashboard's Transactions view).

### Common Patterns
- N/A — single document, no repeated structural pattern to generalize yet.

## Dependencies
### Internal
- Describes `netlify/functions/create-authnet-transaction.js`, `checkout.html`, `sw.js`, and the (unused-but-retained) `netlify/functions/create-payment-intent.js` / `stripeWebhook.js`.

### External
- Authorize.Net (Accept.js, Transaction API) — the payment processor this doc onboards.
- Netlify (environment variables, deploy previews) — the hosting/deploy target the doc's instructions are written against.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
