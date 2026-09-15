# Email flow (added 2026-09-10)

Anthony's ask: "the email campaign flow — we have none." This is mostly
literally true. Before this build-out:

- `mdiWebhook.js`'s `sendPatientEmail()` forwarded to `N8N_WEBHOOK_URL`,
  which **was never set in production** — every "action needed", "your
  prescription is ready", "your order has shipped" email was silently
  dropped after a console log. No patient ever received one.
- `RESEND_API_KEY` **was not set in production either** — even the one email
  that already existed (the Hub welcome/temp-password email, sent from
  `lib/hub-account.js`) was silently failing with `RESEND_API_KEY not set`.
- Nothing existed for: order confirmation, "complete your intake", payment
  failure, refund, renewal receipt/failure, subscription cancellation, quiz
  abandonment, checkout abandonment, browse abandonment, post-purchase
  onboarding, refill reminders, or win-back.

This is now a complete system: 55 emails (11 transactional + a
one-time-per-flow Hub welcome + 43 drip-journey steps, 29 of which are the
campaign flow added 2026-09-14), all branded, all routed through Resend, with
suppression/unsubscribe handling and PHI guardrails. See
`netlify/functions/lib/AGENTS.md`'s own "Email flow" note for the engine's
internal design; this doc is the catalog + the manual setup checklist.

## Architecture

```
Trigger (existing webhook/function)
        │
        ▼
lib/email/engine.js  sendTransactional() / enrollJourney() / cancelJourney()
        │                         │
        ▼                         ▼
  Resend (immediate)      Blobs "email-engine" store: queue/<dueISO>__<id>
                                  │
                                  ▼
                    processEmailQueue.js (cron, every 10 min) → Resend
```

Every send is dedupe-keyed (idempotent against webhook redelivery) and
checked against a suppression list (`resendWebhook.js` populates it from
bounces/complaints; `emailPreferences.js` from unsubscribe clicks).

## Transactional emails (immediate, no unsubscribe link)

| Template | Sent from | When | Dedupe key |
|---|---|---|---|
| `order-confirmed` | `create-authnet-transaction.js` | Payment approved (both the real-charge and `AUTHNET_SIMULATE` branches) | `order:<transactionId>` |
| `complete-intake` | `submitQuiz.js`, `retryPendingCases.js` | MDI voucher created with an `onboarding_url` | `intake:<voucherId>` |
| `case-waiting` | `mdiWebhook.js` (`case_waiting`) | Clinician needs more info | `waiting:<case_id>` |
| `case-completed` | `mdiWebhook.js` (`case_completed`) | Pharmacy confirms the prescription | `completed:<case_id>` |
| `order-shipped` | `mdiWebhook.js` (`order_tracking_number_changed`) | Tracking number set | `shipped:<case_id>` |
| `clinician-message` | `mdiWebhook.js` (`message_created`, human sender) | New message from care team; throttled to 1/30min/patient | `msg:<patient_id>:<30min bucket>` |
| `payment-failed` | `stripeWebhook.js`, `authnetWebhook.js` (`fraud.declined`) | Card declined | `payfail:<id>` |
| `refund-issued` | `stripeWebhook.js`, `authnetWebhook.js` (`refund.created`/`void.created`) | Refund/void issued | `refund:<id>` |
| `renewal-charged` | `authnetWebhook.js` (`authcapture.created` with a known `subscription.id`) | A recurring (ARB) cycle billed successfully | `renewal:<transId>` |
| `renewal-failed` | `authnetWebhook.js` (`subscription.suspended`) | Recurring payment failed, plan paused | `suspended:<subscriptionId>:<date>` |
| `subscription-cancelled` | `cancelSubscription.js`, `authnetWebhook.js` (`subscription.terminated`/`.cancelled`) | Subscription ends (self-service or gateway-side) | `cancel:<subscriptionId>` |
| `hub-welcome` | `lib/hub-account.js` | Every purchase — Hub login + temp password | `hubwelcome:<transactionId>` |

Every one of these is written to say "your treatment"/"your order" — never
a medication name or dose. `lib/email/phi-guard.js` refuses to send anything
that slips a specific compound/dose into a rendered email (checked in
`tests/unit/email-templates.test.js`).

## Drip journeys (marketing — carry an unsubscribe link)

All times are wall-clock delays that get clamped into a 9am–8pm
America/New_York send window (`lib/email/engine.js`'s `withinSendWindow`).

| Journey | Enrolled by | Steps | Cancelled by |
|---|---|---|---|
| `lead-nurture` | `captureLead.js` (`source:'quiz'` from `public/quiz-scripts/asw.js` step 2, and `source:'exit-intent'` from `public/exit-intent.js`); `importLeadNurture.js` for waitlist imports | 20 steps: Track A D+0…D+30 (`-a1`…`-a16`), Track C D+45…D+90 (`-c1`…`-c4`) | `submitQuiz.js`/`retryPendingCases.js` success, or a purchase via either gateway — which also kills the not-yet-due Track C steps |
| `checkout-abandoned` | `captureLead.js` (`source:'checkout'`, fired on blur of the checkout email field) | +1h, +24h, +72h | A purchase |
| `intake-reminder` | `submitQuiz.js`/`retryPendingCases.js`, alongside `complete-intake` | +24h, +72h | `mdiWebhook.js`'s `case_created`/`case_assigned_to_clinician`/`voucher_used` |
| `patient-newsletter` | `create-authnet-transaction.js` and `stripeWebhook.js` (`payment_intent.succeeded`), after a successful purchase | 9 steps: D+1, 4, 10, 14, 21, 30, 45, 60, 90 (`-b1`…`-b9`) | `cancelSubscription.js`, `authnetWebhook.js` (`subscription.terminated`/`.cancelled`) |
| `refill-reminder` | `create-authnet-transaction.js` | One reminder, timed off `lib/authnet-arb.js`'s own `nextCycleStartDate()` (3 days before a subscription renewal, 7 days before a one-time order's term ends) | Cancellation |
| `winback` | `authnetWebhook.js` (`subscription.suspended`), `cancelSubscription.js` | +7d, +30d | A new purchase |

`quiz-abandoned`, `browse-abandoned` and `onboarding` are **legacy**: still
defined in `lib/email/journeys.js` and still registered in `TEMPLATES`, but as
of 2026-09-14 nothing enrolls into them — `lead-nurture` and
`patient-newsletter` replaced them. They are kept so contacts who were already
mid-journey when the switch landed keep receiving what they were promised, and
so the cancel calls that reference them stay valid. Delete them once the queue
has drained past D+30.

**Waitlist** (`waitlist` Supabase table) can't be read from a function —
Supabase RLS has no anon-readable policy on it and this codebase has no
service-role key (deliberate, see `supabase/AGENTS.md`). To put the waitlist on
the campaign: export the table from the Supabase dashboard, then POST the
addresses in batches of ≤300 to `importLeadNurture.js`, which enrolls each one
in `lead-nurture`:

```bash
curl -X POST https://freeley.com/.netlify/functions/importLeadNurture \
  -H 'content-type: application/json' \
  -H "x-admin-secret: $ADMIN_IMPORT_SECRET" \
  -d '{"emails":["a@example.com","b@example.com"]}'
```

It returns `{requested, enrolled, alreadyActive, skippedInvalid, suppressed,
failed}`. Re-running with the same addresses is safe — an already-active
journey is never restarted. Imported contacts have no first name and no stated
vertical, so they get "Hi there," and A4's weight-loss variant.

## Required environment variables

| Var | Status | Who sets it |
|---|---|---|
| `RESEND_API_KEY` | **Set** (2026-09-10, via the Resend MCP — a new key scoped `sending_access` + restricted to the `freeley.com` domain, named "Freeley Netlify Functions"; the pre-existing "Freeley" key from 2026-09-01 was left alone since its secret can't be retrieved and it may be used elsewhere) | Done |
| `RESEND_FROM_EMAIL` | Set (`Freeley <no-reply@freeley.com>`) | — |
| `RESEND_WEBHOOK_SECRET` | **Set** (2026-09-10, webhook id `2eff0154-4bd7-4fb9-85b6-24a28f9df40a`, events `email.bounced`/`email.complained`/`email.suppressed`) | Done |
| `EMAIL_UNSUBSCRIBE_SECRET` | **Set** (generated 2026-09-10) | Done |
| `EMAIL_POSTAL_ADDRESS` | **Deliberately not set** (client decision, 2026-09-15) — CAN-SPAM technically calls for a physical mailing address on marketing footers; the footer just omits the line while this is unset. Not a bug — a known, accepted gap | — |
| `EMAIL_DRY_RUN` | Not set | Optional — set to `true` on a branch/preview context to render+log every send without actually calling Resend |
| `ADMIN_IMPORT_SECRET` | **Set** (2026-09-15, via the Netlify MCP) — `importLeadNurture.js` is now callable | Done |

## Manual setup checklist

Done via the Resend MCP (2026-09-10) — no dashboard visit needed:

- [x] **`freeley.com` domain** — already verified in Resend (since
  2026-09-01, `docs/RESEND_EMAIL_SETUP.md`'s "pending" note was stale —
  deliverability was never actually blocked on this).
- [x] **`RESEND_API_KEY`** — new key created, scoped `sending_access` +
  restricted to `freeley.com`, set in Netlify.
- [x] **Resend webhook** registered at
  `https://freeley.com/.netlify/functions/resendWebhook` for
  `email.bounced`/`email.complained`/`email.suppressed`;
  `RESEND_WEBHOOK_SECRET` set in Netlify.

Still needs the client:

1. **Authorize.Net Merchant Interface → Webhooks**: add these four event
   types (in addition to the four already registered per
   `authnetWebhook.js`'s header comment):
   `net.authorize.payment.authcapture.created`,
   `net.authorize.customer.subscription.suspended`,
   `net.authorize.customer.subscription.terminated`,
   `net.authorize.customer.subscription.cancelled`. Repeat for the sandbox
   Merchant Interface if testing there. (No MCP for this one.)
2. Supabase SMTP + the 4 Auth email templates — already documented in
   `docs/RESEND_EMAIL_SETUP.md`, unchanged by this work.

## Testing

- `npm test` runs the full unit suite, including:
  `tests/unit/email-engine.test.js` (send/dedupe/suppression/journey
  behavior), `tests/unit/email-templates.test.js` (every template renders
  cleanly and passes the PHI guard), `tests/unit/email-phi-guard.test.js`,
  `tests/unit/email-unsubscribe.test.js`,
  `tests/unit/process-email-queue.test.js`.
- Local rendering: with `RESEND_API_KEY` set locally and `netlify dev`
  running, trigger any of the flows above and check the function logs for
  `[EMAIL ENGINE]` lines — `Sent "…"` means it actually called Resend, `DRY
  RUN would send "…"` means it didn't (see `shouldActuallySend()`: outside
  the `production` Netlify context, only addresses matching
  `MDI_TEST_EMAIL_PATTERNS` — e.g. `+test@` — actually send; everything else
  is logged only).
- `GET /.netlify/functions/processEmailQueue?dry=1` shows what the queue
  drain would do next, without sending or removing anything.
- After a real production purchase using a `+test@` email (per the standing
  rule in `docs/HANDOFF_2026-09-01.md` — never probe production intake with
  anything else): confirm `order-confirmed`, `complete-intake`, and
  `hub-welcome` all arrive, then check the Netlify function logs for
  `processEmailQueue` runs every 10 minutes with no `RESEND_API_KEY not set`
  warnings.

## Campaign flow (live 2026-09-14)

Anthony's feedback on the first send was that the emails "all looked the same"
and that the full flow should be 20–30 emails. The answer is a
newsletter-style campaign — **29 emails in three tracks** (16 lead nurture, 9
patient newsletter, 4 re-engagement), each with its own layout and a hero image
from `public/assets/`. Approved and wired into the engine as the `lead-nurture`
and `patient-newsletter` journeys in the table above.

- **Copy** lives in `docs/email-campaign/flow.js`. It is production code, not a
  document: editing an email's text there changes what sends.
- **Rendering** is `netlify/functions/lib/email-templates/campaign-render.js` —
  six bespoke layouts (hero+timeline, hero+tiles, price ladder, numbered
  editorial, offer card, colour-coded playbook) plus a generic one. A6's price
  ladder is read live from `pricing.json` rather than restated, so it can't go
  stale.
- **Journey steps** are thin adapters: `journeys/lead-nurture.js` and
  `journeys/patient-newsletter.js` each build their slice of the `TEMPLATES`
  map from flow.js's own `EMAILS`, so the registry can't drift from the copy.
- **Client PDF**: `docs/email-campaign/Freeley_Email_Campaign_Flow.pdf` (copy
  page + a mobile/desktop rendered preview per email, screenshotted from the
  real brand shell via `docs/email-campaign/render.js`, which is now a thin
  preview wrapper over the same renderer), rebuilt with `npm run campaign:pdf`
  (needs `npx playwright install chromium` once). `npm run campaign:samples`
  writes a handful as real HTML for inbox testing.

Vertical targeting: A4 has four variants and picks the one matching the lead's
self-declared `vertical`, falling back to weight loss when it's unknown. That
value is raw quiz text, not an enum — `asw.js` forwards step-1's option labels
verbatim, comma-joined for a multi-select, so `"Longevity & performance"` and
`"Hair loss, Weight loss"` both have to resolve (`resolveVariant` matches by
containment, first segment wins). A8 and B4 deliberately cover all four
verticals in one body — only A4, where the whole email pitches one product
line, splits. Subject lines never mention a vertical.

Every freeley.com link in every campaign email is stamped with
`utm_source=email&utm_medium=campaign&utm_campaign=<journey>&utm_content=<email
id>` centrally by `campaign-render.js`'s `addUtm`, applied to the body only —
never to the shell footer or the HMAC-signed preferences link, whose query
string can't be appended to.

C4 (the day-90 sunset email) opts people back in through that same signed
preferences link plus `&keep=1`, which `emailPreferences.js` records as
`monthly_letter_opt_in` on the contact. The signature is what identifies the
clicker — a bare `/?keep=1` link carries no identity and would record nothing.

A13/A15 link to `/assessment-quiz?promo=WELCOME10`. A head-inline script
(`astro.config.mjs`) stashes any `?promo=` into `sessionStorage`, and
`checkout.astro` feeds it through its existing promo form on load, so the code
applies itself rather than asking the reader to retype it at checkout. As of
2026-09-15 `WELCOME10` is set `active: false` in `pricing.json` — the client
asked not to implement this promo yet, so A13/A15/C3 ship as designed but the
code does not actually discount anything until it's flipped back on with a
confirmed code/value (and a real expiry — `pricing.json` has none today).

A6's price table now includes the 24-month column, read live from
`pricing.json` — the client confirmed those tier prices as final on
2026-09-15, so A6 and A4's hair-loss/sexual-wellness/longevity variants quote
them directly instead of hedging with "lower on every longer plan."

The transactional emails above are unchanged. Still open for the client, all
shipped in their safest form rather than blocked — see `OPEN_QUESTIONS` at the
bottom of `flow.js`: reactivating `WELCOME10` (or a replacement) before Day 23,
the declined-case refund wording (A12), and a consented patient story to
replace A10's holding version.
