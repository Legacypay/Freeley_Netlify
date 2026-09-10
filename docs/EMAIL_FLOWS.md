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

This is now a complete system: 26 emails (11 transactional + a
one-time-per-flow Hub welcome + 14 drip-journey steps), all branded, all
routed through Resend, with suppression/unsubscribe handling and PHI
guardrails. See `netlify/functions/lib/AGENTS.md`'s own "Email flow" note
for the engine's internal design; this doc is the catalog + the manual setup
checklist.

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
| `quiz-abandoned` | `captureLead.js` (`source:'quiz'`, fired from `public/quiz-scripts/asw.js` step 2) | +1h, +24h, +72h | `submitQuiz.js` success, or a purchase |
| `checkout-abandoned` | `captureLead.js` (`source:'checkout'`, fired on blur of the checkout email field) | +1h, +24h, +72h | A purchase |
| `browse-abandoned` | `captureLead.js` (`source:'exit-intent'`, from `public/exit-intent.js`) | +10min, +48h | A purchase |
| `intake-reminder` | `submitQuiz.js`/`retryPendingCases.js`, alongside `complete-intake` | +24h, +72h | `mdiWebhook.js`'s `case_created`/`case_assigned_to_clinician`/`voucher_used` |
| `onboarding` | `create-authnet-transaction.js`, after a successful purchase | D+2, D+7, D+21 | `subscription-cancelled` |
| `refill-reminder` | `create-authnet-transaction.js` | One reminder, timed off `lib/authnet-arb.js`'s own `nextCycleStartDate()` (3 days before a subscription renewal, 7 days before a one-time order's term ends) | Cancellation |
| `winback` | `authnetWebhook.js` (`subscription.suspended`), `cancelSubscription.js` | +7d, +30d | A new purchase |

**Waitlist** (`waitlist` Supabase table) is intentionally out of this
system — Supabase RLS has no anon-readable policy on it and this codebase
has no service-role key (deliberate, see `supabase/AGENTS.md`). To email the
waitlist: export the table from the Supabase dashboard, import as a Resend
Audience, send a Broadcast using the same brand shell (`lib/email-templates/shared.js`'s
components can be copy-pasted for a one-off broadcast HTML).

## Required environment variables

| Var | Status | Who sets it |
|---|---|---|
| `RESEND_API_KEY` | **Not set in production** | You — Resend dashboard → Settings → API Keys |
| `RESEND_FROM_EMAIL` | Set (`Freeley <no-reply@freeley.com>`) | — |
| `RESEND_WEBHOOK_SECRET` | Not set | You — after registering the webhook (below) |
| `EMAIL_UNSUBSCRIBE_SECRET` | **Set** (generated 2026-09-10) | Done |
| `EMAIL_POSTAL_ADDRESS` | Not set | You — CAN-SPAM requires a physical mailing address on marketing email footers; footer omits the line until this is set |
| `EMAIL_DRY_RUN` | Not set | Optional — set to `true` on a branch/preview context to render+log every send without actually calling Resend |

## Manual setup checklist (can't be done from code)

1. **Verify `freeley.com` in Resend.** Until this is done, sends land in
   spam or bounce outright. Add the DKIM/SPF/DMARC records Resend gives you
   wherever `freeley.com`'s DNS is hosted, then click Verify.
2. **Set `RESEND_API_KEY`** in Netlify (production scope, functions).
3. **Register the Resend webhook**: Resend dashboard → Webhooks → Add
   Endpoint → `https://freeley.com/.netlify/functions/resendWebhook`,
   events `email.bounced` + `email.complained`. Copy the Signing Secret into
   `RESEND_WEBHOOK_SECRET`.
4. **Authorize.Net Merchant Interface → Webhooks**: add these four event
   types (in addition to the four already registered per
   `authnetWebhook.js`'s header comment):
   `net.authorize.payment.authcapture.created`,
   `net.authorize.customer.subscription.suspended`,
   `net.authorize.customer.subscription.terminated`,
   `net.authorize.customer.subscription.cancelled`. Repeat for the sandbox
   Merchant Interface if testing there.
5. **Set `EMAIL_POSTAL_ADDRESS`** once you have one to publish.
6. Supabase SMTP + the 4 Auth email templates — already documented in
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
