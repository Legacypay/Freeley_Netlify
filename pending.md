# Pending — MDI Go-Live (2026-08-21)

Detailed checklist with context: `docs/MDI_GO_LIVE_OPERATIONS.md`.
Shipped so far: `b7d07e0`, `3040e67`, `10dbe34` on `main`.

## Blocked on you / the team (not doable from the repo)

- [ ] **Check `MDI_LIVE_MODE` in Netlify** → freeley-health → Environment
      variables. If `true`, every `submitQuiz` POST without `is_test: true` is
      a billable live encounter.
- [ ] **Ask MDI on Slack** whether portal status "Approved" == webhook event
      `case_approved` (it is not in their public webhook list), and whether the
      team should accept a requested change with
      `POST /v1/partner/cases/:case_id/processing` or by moving the encounter
      back to Assigned in the portal.
- [ ] Name the owner (person/rotation) of the **Partner Support inbox** in the
      Clinicians Portal + response SLA.
- [ ] Pick the **Slack channel** for flagging encounter issues to MDI. Rule:
      share only the Encounter ID (UUID after `/cases/` in the URL), never PHI.
- [ ] Write the **Approved-status runbook**: open encounter → read the
      clinician's requested change → accept/adjust → move back to Assigned.
- [ ] Write the **offerings process**: request → MDI medical review (5–7
      business days) → approval → only then edit `lib/products.js` + deploy.
- [ ] Team policy: local dev never sets `MDI_LIVE_MODE`; API tests always send
      `is_test: true`; any deliberate live QA voucher gets tagged "test case" in
      the portal immediately after creation.

## Code follow-ups (after the answers above)

- [ ] `mdiWebhook.js` `case_approved`: re-enable or rewrite the patient email
      once MDI confirms what the event means (one commented line).
- [ ] Voucher payload shape: we send top-level `offering_id`; docs want
      `offerings: [{ "id": "<offering_id>" }]`. Verify with a sandbox
      `is_test: true` submission (needs MDI creds locally), then fix in
      `submitQuiz.js` + `retryPendingCases.js`.
- [ ] Wire the real checkout (`src/pages/checkout.astro` `processPayment()` is a
      mock) to the payment function and then to `submitQuiz` — separate task.
- [ ] Optional, only if a live end-to-end QA mode is ever needed: auto-attach
      the "test case" tag from the `case_created` webhook for `is_test` orders
      via `POST /v1/partner/cases/:case_id/tags/:tag_id` (tag id from
      `GET /v1/partner/tags`), or send `demo: true` on the voucher.
