# MDI Go-Live Operations Checklist

Source: partner onboarding message from MD Integrations (MDI), 2026-08-21.
Partner portal: https://partners.mdintegrations.com/partner/f81508d1-3c53-4849-a636-1e9050a68e00
Clinicians portal (cases): https://app.mdintegrations.com/tabs/cases/<encounter-id>

Legend: `[x]` done (with what was done), `[ ]` pending, `(code)` lives in this
repo, `(process)` is a team/ops action outside the repo.

## What the official API docs say (read 2026-08-21)

Docs: `https://api.mdintegrations.com/v1` → redirects to the Postman collection
`https://documenter.getpostman.com/view/14212272/2s8Yt1r9B8`. Relevant facts:

| Topic | Documented |
|---|---|
| `POST /v1/partner/vouchers` fields | `questionnaire_id*`, `patient_id`, `hold_status` ("hold the status to not enter into the MDI flow", default false), **`demo`** ("Demo vouchers will not create any patient or cases and will not expire", default false), `expires_at`, `offerings[].id` (+ `product.pharmacy_id`/`force_pharmacy`), `diseases[]`, `metadata` (string 255), `pharmacy_id`, `prefilled_questions[]`. **`environment_id` is NOT documented** (we send it because the portal Test Bench does). |
| Case payload | `is_chargeable` boolean ("Whether or not the case should be charged") and `tags[]` exist on `POST /v1/partner/cases`, but we never create cases directly — they're born from the voucher/onboarding flow. |
| Tags | `GET/POST /v1/partner/tags`, `GET/PATCH/DELETE /v1/partner/tags/:tag_id`; **`POST /v1/partner/cases/:case_id/tags/:tag_id`** (body `{ "notes": "…" }`) attaches a tag to an existing case. This is the API equivalent of the portal's "test case" tag. Tags carry `auto_detach_status[]`. |
| Case statuses | `created, assigned, support, waiting, processing, completed, cancelled`. "Approved" is not in that list, but cases expose `is_additional_approval_needed` and there is **`POST /v1/partner/cases/:case_id/processing` — "Send an Approved Case to Processing"**. So Approved = partner must act: accept (→ processing) or move back to Assigned. |
| Documented webhook events | `case_assigned_to_clinician`, `case_processing`, `case_completed`, `case_transferred_to_support`, `new_case_message`, `case_cancelled`, `case_waiting`, patient modified, prescriptions submitted. `case_approved` (which our webhook handles) is not in the public list — confirm its payload with MDI. |

Follow-up found while reading (not changed, needs a sandbox test first): our
voucher payload sends `offering_id` at the top level; the documented shape is
`offerings: [{ "id": "<offering_id>" }]`. If MDI ignores the top-level field,
clinicians may not see the chosen product/dose tier on the voucher.

---

## 0. Confirm what "Approved" means (process — BLOCKS §3)

Our webhook (`netlify/functions/mdiWebhook.js`) receives a `case_approved` event.
MDI's message says the portal status **"Approved" = the doctor is requesting a
treatment/titration change and the team must move the encounter back to
"Assigned"** — i.e. it is NOT a final approval.

- [ ] Ask MDI (Slack) whether portal "Approved" ↔ webhook `case_approved`, and
      what event (if any) signals the *final* prescription approval. Also ask
      whether accepting the change should be done with
      `POST /v1/partner/cases/:case_id/processing` or by moving to Assigned in
      the portal, as their message says.
- [x] Until confirmed, the patient-facing "your prescription has been approved"
      email on `case_approved` is PAUSED (commented out in `mdiWebhook.js`) and
      the internal n8n alert is now `ACTION_REQUIRED_review_and_move_to_assigned`
      with the encounter URL. *(2026-08-21)*

## 1. Test Orders — never get billed for a test (code + process)

MDI bills every LIVE encounter that is not tagged "test case" in the portal.
There is **no API field** for that tag; the only API-level discriminator is
`environment_id` (sandbox vs. live). So the protection is: tests never reach
the live environment.

- [x] `resolveMdiEnvironment({ isTest })` in `lib/mdi-client.js` is the single
      decision point: live only when `MDI_LIVE_MODE=true` AND not a test.
      Env IDs de-duplicated (were copy-pasted in two functions); overridable via
      `MDI_SANDBOX_ENV_ID` / `MDI_LIVE_ENV_ID`. *(2026-08-21)*
- [x] `submitQuiz` and `savePendingCase` accept `"is_test": true` (boolean,
      validated) → forced sandbox, `[TEST CASE]` log prefix, `is_test` +
      `environment` stamped on the `mdi-orders` record and on any queued retry
      record. *(2026-08-21)*
- [x] `retryPendingCases` honors the stamped environment instead of re-reading
      `MDI_LIVE_MODE` (closed a leak: a record queued as sandbox could be
      retried as live after the env var flipped). Legacy records without a
      stamp default to sandbox + warning. *(2026-08-21)*
- [x] Every live voucher logs `⚠️ LIVE VOUCHER CREATED (billable)` with the
      portal link so accidental QA in live is easy to find and tag. *(2026-08-21)*
- [x] `mdiWebhook.sendPatientEmail` skips test/sandbox orders — a test with a
      real email no longer emails that inbox. *(2026-08-21)*
- [ ] **Check `MDI_LIVE_MODE` in Netlify → Site settings → Environment
      variables.** If `true`, every non-test submission is billable from now on.
- [ ] Team policy (write in Slack/Notion): local dev never sets `MDI_LIVE_MODE`;
      API tests always send `is_test: true`; the ONLY vouchers created in live
      are real checkouts or deliberate final QA — and those must be tagged
      "test case" in the clinicians portal immediately after creation.

How to submit a safe API test (always sandbox, never billed):
```bash
curl -X POST https://freeley.com/.netlify/functions/submitQuiz \
  -H 'Content-Type: application/json' \
  -d '{"is_test":true,"product":"semaglutide","patient":{"first_name":"Test","last_name":"Case","email":"qa@freeley.com"}}'
```

Note: the live checkout (`src/pages/checkout.astro`) does not call `submitQuiz`
yet (payment step is still a mock) — wiring it is a separate task.

Deliberately NOT built (YAGNI while tests never reach live): auto-attaching the
"test case" tag via `POST /v1/partner/cases/:case_id/tags/:tag_id` from the
`case_created` webhook for `is_test` orders, and sending `demo: true` on the
voucher. Both are ~20 lines on top of `mdiRequest` if a live end-to-end QA mode
is ever needed — see the API table above for the exact endpoints.

## 2. Patient Support & Messaging (process)

The **Partner Support inbox in the Clinicians Portal** is where non-clinical
patient questions land. It is separate from the patient↔clinician chat that
the Health Hub already surfaces (`getMessages.js` / `sendMessage.js`).

- [ ] Name the person/rotation that owns the inbox.
- [ ] Define a response SLA (suggest: same business day).

## 3. Approved status — action required (process, after §0)

- [x] Internal alert is now ACTION REQUIRED with encounter URL (see §0).
- [ ] Document the runbook: open the encounter → read the clinician's requested
      change → apply/confirm → move encounter back to **Assigned**.
- [ ] Once §0 is answered: re-enable (or rewrite) the patient email in
      `mdiWebhook.js` `case_approved` — one commented line.

## 4. Flagging issues to MDI (process)

- [ ] Pick the Slack channel for MDI issue reports.
- [ ] Rule: share ONLY the Encounter ID — the UUID after `/cases/` in the
      clinicians-portal URL. Never patient name, email, DOB, or any PHI.

## 5. Updating offerings (process + code)

- [x] Header comment added to `netlify/functions/lib/products.js`: offering
      additions/edits go through MDI medical review (5–7 business days) BEFORE
      any `offering_id` / `questionnaire_id` is wired here. *(2026-08-21)*
- [ ] Process: request → MDI review → approval → then code change + deploy.
      Plan launches accordingly.
