# Freeley — Telehealth Platform

> **Freeley Health LLC** | freeley.com  
> JAMstack architecture: Static HTML + Netlify Functions + Firebase Auth + Stripe + MD Integrations

---

## Quick Start

```bash
# Clone
git clone https://github.com/Legacypay/Freeley_Netlify.git
cd Freeley_Netlify

# Install
npm install

# Local dev (Netlify CLI)
npx netlify dev
```

## Architecture

```
Frontend (Static HTML/CSS/JS)
├── index.html          → Homepage
├── quiz.html           → Patient intake quiz  
├── checkout.html       → Stripe checkout + MDI submission
├── hub.html            → Patient dashboard (Firebase Auth)
├── weight-loss.html    → Treatment landing pages
├── longevity.html
├── hair-loss.html
├── sexual-wellness.html
└── promo-*.html        → Campaign landing pages

Backend (Netlify Serverless Functions)
├── create-payment-intent.js  → Creates Stripe PaymentIntents
├── submitQuiz.js             → Creates MDI patient + case
├── caseStatus.js             → Returns patient-friendly case status (AUTH REQUIRED)
├── stripeWebhook.js          → Handles Stripe payment events
├── mdiWebhook.js             → Handles MD Integrations events
├── savePendingCase.js        → Queues failed MDI submissions
├── retryPendingCases.js      → Scheduled retry (every 15 min)
├── captureLead.js            → Exit-intent email capture
├── track-conversion.js       → HIPAA-compliant CAPI tracking
├── health.js                 → Health check endpoint
└── lib/
    ├── mdi-client.js         → MDI API client (OAuth2 + token cache)
    ├── products.js           → Product/offering configuration
    └── logger.js             → Structured JSON logging

Shared Config
├── pricing.json              → Single source of truth for all pricing
└── netlify.toml              → Netlify config, headers, scheduled functions
```

## Environment Variables

Set these in **Netlify Dashboard → Site Settings → Environment Variables**:

### Required
| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `MDI_CLIENT_ID` | MD Integrations Partner Client ID |
| `MDI_CLIENT_SECRET` | MD Integrations Partner Client Secret |
| `MDI_WEBHOOK_SECRET` | MDI webhook signing secret |

### Optional
| Variable | Description |
|---|---|
| `MDI_BASE_URL` | MDI API base URL (default: `https://api.mdintegrations.com`) |
| `MDI_STRIVE_PHARMACY_ID` | Strive Pharmacy ID in MDI |
| `N8N_WEBHOOK_URL` | Internal webhook for alerts/notifications |
| `SLACK_WEBHOOK_URL` | Slack webhook for error alerts |
| `META_PIXEL_ID` | Meta/Facebook Pixel ID |
| `META_ACCESS_TOKEN` | Meta Conversions API access token |
| `GA4_MEASUREMENT_ID` | Google Analytics 4 Measurement ID |
| `GA4_API_SECRET` | GA4 Measurement Protocol API secret |
| `FIREBASE_API_KEY` | Firebase API key (for server-side token verification) |

## Key Flows

### 1. Patient Checkout → MDI Case Creation
```
Quiz → checkout.html → create-payment-intent → Stripe Payment
                      → submitQuiz → MDI (create patient + case)
                      → If MDI fails: savePendingCase → retryPendingCases (cron)
```

### 2. Webhook Event Processing
```
Stripe → stripeWebhook.js → payment_intent.succeeded → n8n alert
MDI    → mdiWebhook.js    → case status change → n8n alert
```

### 3. Patient Hub (Authenticated)
```
hub.html → Firebase Login → caseStatus.js (Bearer token required)
                          → MDI case details (patient-friendly)
```

## Security

- **CORS**: All API endpoints locked to `freeley.com` only
- **Auth**: `caseStatus` requires Firebase ID token
- **Webhooks**: Both Stripe and MDI use signature verification (fail closed)
- **Headers**: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff
- **HIPAA**: No PHI stored in Freeley infrastructure; conversion tracking uses hashed PII only
- **Secrets**: All API keys in Netlify env vars, `.env` files gitignored

## Deployment

Pushes to `main` auto-deploy via Netlify. The build runs:
```bash
npm install && node build_blog.js
```

---

*Stabilized 2026-04-06 | Freeley Health LLC*
