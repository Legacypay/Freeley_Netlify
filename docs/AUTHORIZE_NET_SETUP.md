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
