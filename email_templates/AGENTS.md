<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# email_templates/

## Purpose
Three standalone HTML transactional/marketing email templates for an **abandoned-cart drip sequence**, styled inline (no external CSS) as is required for email-client compatibility, branded for Freeley (`freeley.com`, green/cream palette). **Confirmed not referenced anywhere in this codebase** — a repo-wide search of `netlify/functions/`, `scripts/`, and `src/` for these filenames and related terms (`abandoned_cart`, `trust_building`, `urgency`, `email_templates`) found no matches. These are almost certainly meant to be uploaded/configured in an external email/marketing tool (e.g. the `N8N_WEBHOOK_URL`-driven automation mentioned in `README.md`, or an ESP like Klaviyo/Mailchimp/SendGrid) rather than sent directly from a Netlify Function in this repo.

## Key Files
| File | Description |
|------|-------------|
| `1_abandoned_cart.html` | First email in the sequence — "Your personalized treatment plan is ready for review." Reminds a visitor who started but didn't finish checkout that they're a good candidate for GLP-1 weight-loss treatment, no hidden fees, CTA links to `https://freeley.com/checkout?treatment=weight-loss`. |
| `2_trust_building.html` | Second email — "Not all compounded medications are created equal." Trust/differentiation copy: 503A-licensed pharmacies, FDA-standard compounding facilities, positioned as a follow-up to email 1 for recipients who haven't converted yet. |
| `3_urgency.html` | Third email — "Your physician consultation is still reserved." Urgency/scarcity copy: physician consultation fee (normally $90) currently waived, framed as a limited-time hold on the recipient's evaluation slot; final email in the sequence. |

## For AI Agents
### Working In This Directory
- These are **not wired into any send path in this repo** — do not assume changing them affects live emails without first finding where (if anywhere) they're actually uploaded/triggered externally. If asked to "send" or "wire up" these emails, that requires new integration work (a Netlify Function + email provider, or configuring an external ESP/automation tool), not just editing these files.
- All three share the same inline CSS design system (`.container`, `.header`, `.content`, `.btn`, `.footer` classes with consistent colors/fonts) — if editing copy, keep this shared visual structure so the sequence reads as one brand.
- Pricing/offer details mentioned in the copy (e.g. "$90 consultation fee waived") should be checked against `pricing.json` and current site copy before assuming they're still accurate — these are static snapshots, not sourced live from `pricing.json`.
- Treat the numeric prefixes (`1_`, `2_`, `3_`) as the intended send order in the drip sequence.

### Testing Requirements
None — static HTML files, no build step or test in this repo touches them. If integrated with an ESP, that platform's own preview/test-send tooling would be the verification path.

### Common Patterns
Email-safe HTML conventions throughout: all styling is inline `<style>` in `<head>` (no external stylesheet, no JS), table-free but simple `<div>`-based layout, `max-width: 600px` container — standard practice for cross-email-client rendering compatibility.

## Dependencies
### Internal
None found — not referenced by `netlify/functions/`, `scripts/`, or `src/`.

### External
Presumed external email/marketing automation platform (not present in this repo) is the actual sender; `README.md` documents an `N8N_WEBHOOK_URL` env var used elsewhere in the repo for notifications, which is a plausible (but unconfirmed) integration point for triggering this sequence.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
