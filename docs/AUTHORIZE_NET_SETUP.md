# Authorize.Net migration — setup, testing & go-live

Replaces Stripe with **Authorize.Net (Accept.js)** for Freeley checkout. One-time charge, custom checkout UI kept. Built on branch **`authorize-net-migration`** — `main` (the live site) is untouched until you choose to go live.

---

## What changed

| | Before (Stripe) | After (Authorize.Net) |
|---|---|---|
| Card form | Stripe Elements | Accept.js card fields (your own UI) |
| Server charge | `create-payment-intent.js` → PaymentIntent | **`create-authnet-transaction.js`** → `createTransactionRequest` |
| Confirmation | async (webhook) | **synchronous** (result returns immediately) |
| Conversions (GA4/Meta) | fired from `stripeWebhook.js` | fired inside `create-authnet-transaction.js` on approval |
| Price | computed server-side from `pricing.json` | **same — unchanged** |
| MDI submit / attribution / redirect | unchanged | **unchanged** |

The card number/CVC are tokenized by Accept.js **in the browser** and never touch our server (keeps PCI scope low). The server only ever sees a one-time opaque token.

---

## Step 1 — Add the Netlify environment variables

Netlify → your Freeley site → **Site settings → Environment variables → Add a variable**. Add these three:

| Name | Value | Notes |
|---|---|---|
| `AUTHNET_API_LOGIN_ID` | `62wCZg38Qp8` | Your API Login ID (not secret) |
| `AUTHNET_TRANSACTION_KEY` | *(the Transaction Key from your dashboard)* | 🚨 **SECRET** — paste it here, nowhere else |
| `AUTHNET_ENV` | `production` | Your account is a production account |

> The **Public Client Key** is already in `checkout.html` (it's public by design — Accept.js needs it in the browser). The **Transaction Key** lives ONLY in this env var. Don't paste the Transaction Key into any file.

After we go live and confirm it works, **regenerate the Transaction Key** in the Authorize.Net dashboard (Account → Settings → API Credentials & Keys) since it was shared in chat — then update the env var with the new value.

---

## Step 2 — Get a test deploy preview

1. Push the `authorize-net-migration` branch (say the word and I'll push it, or you can).
2. Netlify builds a **deploy preview** at a temporary URL (e.g. `https://authorize-net-migration--freeley.netlify.app`). This does NOT touch freeley.com.
3. The functions only run on Netlify, so test on the preview URL — not by opening the HTML file locally.

---

## Step 3 — Test the payment

Your account's **Transaction Processing Mode is currently disabled**, so these tests will NOT move real money — the charge is validated but not settled. Good for testing the whole flow safely.

**Important:** checkout currently defaults to a *test-mode bypass* that skips payment entirely. To actually exercise the Authorize.Net card flow, add `?testmode=false` to the checkout URL:

```
https://<preview-url>/checkout?treatment=weight-loss&testmode=false
```

Use Authorize.Net's official **test cards** (real-looking but safe):

| Card | Number | Exp | CVC |
|---|---|---|---|
| Visa | `4111 1111 1111 1111` | any future date | `123` |
| Mastercard | `5424 0000 0000 0015` | any future | `123` |
| Amex | `3700 0000 0000 002` | any future | `1234` |
| Discover | `6011 0000 0000 0012` | any future | `123` |

**What to verify (see the full `ACCEPTANCE_CHECKLIST.md` too):**
- [ ] Card fields render; the pay button enables.
- [ ] A valid test card → redirects to `/hub.html?payment=success&pi=…` and (if quiz data present) submits to MDI.
- [ ] In the Authorize.Net dashboard → **Transactions**, the test transaction appears.
- [ ] A bad card number shows a clean decline message and re-enables the button (no charge, no redirect).
- [ ] DevTools → Network: the `create-authnet-transaction` call returns `{ approved: true, transactionId, amount }` and the `amount` matches the plan price.

> Optional, for fuller testing (real transaction IDs, refunds, webhooks): create a free **sandbox** account at developer.authorize.net, set `AUTHNET_ENV=sandbox`, and use its credentials. Not required.

---

## Step 4 — Go live (only when tests pass)

1. **Enable Transaction Processing Mode** in the Authorize.Net dashboard (so real cards actually charge).
2. In `checkout.html`, flip the test-mode default to **off** so customers hit real payment by default. Find:
   ```js
   const IS_TEST_MODE = testModeParam !== 'false';
   ```
   and change it to:
   ```js
   const IS_TEST_MODE = testModeParam === 'true';
   ```
   (Now payment is required by default; `?testmode=true` is the only way to bypass.) — I can make this change for you when you're ready.
3. Merge `authorize-net-migration` → `main`. Netlify auto-deploys freeley.com.
4. Bump the service-worker version in `sw.js` (e.g. `freeley-v3` → `v4`) so returning visitors get the new checkout, not a cached old one.
5. Do **one real low-value transaction** with a personal card, confirm it in the dashboard, then refund it.
6. Regenerate the Transaction Key (Step 1 note) and update the env var.

---

## Files in this change
- `netlify/functions/create-authnet-transaction.js` — **new** server charge function (+ fires conversions).
- `checkout.html` — Accept.js script, card fields, tokenize→charge logic (replaces Stripe).
- Stripe files (`create-payment-intent.js`, `stripeWebhook.js`) are **left in place, unused** — easy rollback. Remove them once Authorize.Net is proven in production.

## Rollback
If anything's wrong, just don't merge the branch — `main`/freeley.com stays on Stripe. After go-live, rolling back = `git revert` the merge commit and redeploy.

## Note for the frontend redesign dev
The handoff contract still describes the Stripe flow. Once this is merged, the payment section of that contract changes: the card form is Accept.js (ids `an-card-number`, `an-exp`, `an-cvc`, `an-zip`, `an-card-name`), and the server call is `create-authnet-transaction` returning `{ approved, transactionId, amount }`. Everything else (MDI submit, storage keys, success redirect, hub) is unchanged. I can update the contract doc when you're ready.

## Per-environment credentials (added 2026-09-01)

`netlify/functions/lib/authnet-config.js` (and the matching frontmatter block in
`src/pages/checkout.astro`) pick the credential set from `AUTHNET_ENV`:

| `AUTHNET_ENV` | Variables used | Host |
|---|---|---|
| `sandbox` | `AUTHNET_SANDBOX_API_LOGIN_ID`, `AUTHNET_SANDBOX_TRANSACTION_KEY`, `AUTHNET_SANDBOX_CLIENT_KEY`, `AUTHNET_SANDBOX_SIGNATURE_KEY` | `apitest.authorize.net`, Accept.js from `jstest.authorize.net` |
| `production` | `AUTHNET_LIVE_API_LOGIN_ID`, `AUTHNET_LIVE_TRANSACTION_KEY`, `AUTHNET_LIVE_CLIENT_KEY`, `AUTHNET_LIVE_SIGNATURE_KEY` | `api.authorize.net`, Accept.js from `js.authorize.net` |

Each prefixed variable falls back to the historical un-prefixed name
(`AUTHNET_API_LOGIN_ID`, …). Switching from sandbox testing to real charging is
therefore: set `AUTHNET_ENV=production`, make sure the four `AUTHNET_LIVE_*`
values exist, **delete `AUTHNET_SIMULATE`**, redeploy.

Sandbox and production credentials are separate accounts and are not
interchangeable — Authorize.Net returns `E00007 User authentication failed`
when a key is used against the wrong host. A Transaction Key is exactly 16
characters; anything longer is a copy/paste of the wrong field (the 20-char
values found in Netlify on 2026-09-01 were rejected with `E00003 … greater than
the MaxLength value`). Quick check without charging anything:

```bash
# from the repo root, with the pair you want to verify
AUTHNET_API_LOGIN_ID=<login> AUTHNET_TRANSACTION_KEY=<key> node -e '
fetch("https://apitest.authorize.net/xml/v1/request.api",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({authenticateTestRequest:{merchantAuthentication:{name:process.env.AUTHNET_API_LOGIN_ID,transactionKey:process.env.AUTHNET_TRANSACTION_KEY}}})})
 .then(r=>r.text()).then(t=>console.log(JSON.parse(t.replace(/^\uFEFF/,"")).messages))'
```
(`Ok / I00001 Successful` = valid for that host; swap the URL to `api.authorize.net` for production.)

## Recurring billing / subscriptions (added 2026-09-02)

Every checkout plan is a real Authorize.Net subscription (ARB — Automated
Recurring Billing), not a one-time charge for the full term: "Pay Monthly"
charges $89 every month until canceled; "Pay For 12 Months" charges $708
every 12 months until canceled — same cadence as the plan's own label,
forever. See `netlify/functions/lib/authnet-arb.js` for the implementation
and its header for exactly what was/wasn't verified before shipping.

- **Sandbox does not have Recurring Billing enabled** — confirmed 2026-09-02
  (`ARBGetSubscriptionListRequest`/`ARBCreateSubscriptionRequest` both return
  `E00007` against the sandbox credentials, while the same credentials work
  fine for ordinary charges). Enable it at sandbox.authorize.net if you want
  to exercise subscription creation/cancellation before trusting production.
- **Production DOES have it enabled** (verified read-only, no charge).
- The exact `ARBCreateSubscriptionFromCustomerProfileRequest` schema in
  `lib/authnet-arb.js` follows Authorize.Net's long-stable public shape but
  was not re-verified against a live sandbox response (blocked by the point
  above). Add to the go-live checklist below: **do one real low-value
  subscription** (any plan, your own card) and confirm in the Merchant
  Interface → Recurring Billing that a subscription was actually created
  with the right amount and interval — then cancel it from the Hub and
  confirm it shows canceled there too — before trusting this at real volume.
- Patients cancel from the Hub's Billing tab ("Active Plans" card) — see
  `netlify/functions/cancelSubscription.js` and
  `src/lib/hub/dashboard.ts`'s `loadBillingHistory()`.
- Checkout's copy (plan cards, the consent checkbox, and a line under the
  total) discloses the recurring nature and cancellation before the charge —
  required by auto-renewal disclosure laws in several US states and by the
  card networks' subscription-billing rules. If you change plan pricing or
  wording, keep that disclosure accurate.
