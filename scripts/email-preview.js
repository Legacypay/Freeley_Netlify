#!/usr/bin/env node
/**
 * Renders every registered email template (netlify/functions/lib/email-templates)
 * with representative sample data into one self-contained HTML gallery —
 * each template shown inside its own iframe so the real, fully-inlined
 * email HTML renders exactly as it would in an inbox, with a subject/
 * preheader header above it.
 *
 * Usage:
 *   node scripts/email-preview.js [output-path.html]
 *   npm run email:preview -- [output-path.html]
 * Defaults to writing ./email-preview.html in the repo root.
 */

const fs = require('fs');
const path = require('path');

const { TEMPLATES } = require('../netlify/functions/lib/email-templates');

const UNSUB = 'https://freeley.com/.netlify/functions/emailPreferences?e=jane%40example.com&t=preview';

// Representative data per template — kept independent from
// tests/unit/email-templates.test.js's fixture map (that one asserts
// correctness; this one is for visual review) even though they overlap.
const DATA_BY_TEMPLATE = {
  'order-confirmed': { firstName: 'Jane', productLabel: 'Freeley Weight Loss Plan', planMonths: 3, amount: '$267.00', cardLast4: '4242', billingModel: 'subscription' },
  'complete-intake': { firstName: 'Jane', onboardingUrl: 'https://onboard.mdintegrations.com/example' },
  'case-waiting': { firstName: 'Jane' },
  'case-completed': { firstName: 'Jane' },
  'order-shipped': { firstName: 'Jane' },
  'clinician-message': { firstName: 'Jane' },
  'payment-failed': { firstName: 'Jane', retryUrl: 'https://freeley.com/checkout' },
  'refund-issued': { firstName: 'Jane', amount: '$89.00' },
  'renewal-charged': { amount: '$89.00', cardLast4: '4242' },
  'renewal-failed': { firstName: 'Jane' },
  'subscription-cancelled': { firstName: 'Jane' },
  'hub-welcome': { firstName: 'Jane', email: 'jane@example.com', password: 'Ab3dEfGhJk9m', hubUrl: 'https://freeley.com/hub' },
  'quiz-abandoned-1': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'quiz-abandoned-2': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'quiz-abandoned-3': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'checkout-abandoned-1': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'checkout-abandoned-2': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'checkout-abandoned-3': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'browse-abandoned-1': { resumeUrl: 'https://freeley.com/how-it-works', unsubscribeUrl: UNSUB },
  'browse-abandoned-2': { resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'intake-reminder-1': { firstName: 'Jane', onboardingUrl: 'https://onboard.mdintegrations.com/example', unsubscribeUrl: UNSUB },
  'intake-reminder-2': { firstName: 'Jane', onboardingUrl: 'https://onboard.mdintegrations.com/example', unsubscribeUrl: UNSUB },
  'onboarding-1': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'onboarding-2': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'onboarding-3': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'refill-reminder': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'winback-1': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'winback-2': { firstName: 'Jane', unsubscribeUrl: UNSUB }
};

const GROUPS = [
  { title: 'Transactional', keys: ['order-confirmed', 'complete-intake', 'case-waiting', 'case-completed', 'order-shipped', 'clinician-message', 'payment-failed', 'refund-issued', 'renewal-charged', 'renewal-failed', 'subscription-cancelled', 'hub-welcome'] },
  { title: 'Quiz abandoned', keys: ['quiz-abandoned-1', 'quiz-abandoned-2', 'quiz-abandoned-3'] },
  { title: 'Checkout abandoned', keys: ['checkout-abandoned-1', 'checkout-abandoned-2', 'checkout-abandoned-3'] },
  { title: 'Browse abandoned', keys: ['browse-abandoned-1', 'browse-abandoned-2'] },
  { title: 'Intake reminder', keys: ['intake-reminder-1', 'intake-reminder-2'] },
  { title: 'Onboarding', keys: ['onboarding-1', 'onboarding-2', 'onboarding-3'] },
  { title: 'Refill reminder', keys: ['refill-reminder'] },
  { title: 'Winback', keys: ['winback-1', 'winback-2'] }
];

const TRANSACTIONAL_KEYS = new Set(GROUPS[0].keys);

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderCard(key) {
  const data = DATA_BY_TEMPLATE[key];
  if (!data) throw new Error(`No preview fixture for template "${key}" — add one to DATA_BY_TEMPLATE`);
  const { subject, preheader, html } = TEMPLATES[key](data);
  const kind = TRANSACTIONAL_KEYS.has(key) ? 'transactional' : 'marketing';
  return `
      <article class="card" id="tpl-${escapeAttr(key)}">
        <div class="msg-row">
          <span class="msg-from">Freeley &lt;no-reply@freeley.com&gt;</span>
          <span class="msg-kind kind-${kind}">${kind}</span>
        </div>
        <div class="msg-subject">${escapeHtml(subject)}</div>
        ${preheader ? `<div class="msg-preheader">${escapeHtml(preheader)}</div>` : '<div class="msg-preheader">&nbsp;</div>'}
        <div class="msg-key">${escapeHtml(key)}</div>
        <iframe class="msg-frame" srcdoc="${escapeAttr(html)}" loading="lazy" title="${escapeAttr(subject)}"></iframe>
      </article>`;
}

function buildGallery() {
  const total = GROUPS.reduce((n, g) => n + g.keys.length, 0);
  const marketingCount = total - TRANSACTIONAL_KEYS.size;
  const nav = GROUPS.map(g => `<a href="#sec-${slugify(g.title)}">${escapeHtml(g.title)} <span class="count">${g.keys.length}</span></a>`).join('');
  const sections = GROUPS.map(g => `
    <section class="group" id="sec-${slugify(g.title)}">
      <h2>${escapeHtml(g.title)}</h2>
      <div class="grid">${g.keys.map(renderCard).join('\n')}</div>
    </section>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Freeley Email Bench</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
  :root {
    --bg: #f2f4f1;
    --surface: #ffffff;
    --ink: #14181a;
    --muted: #5b6560;
    --line: #dde3dd;
    --accent: #0f6b45;
    --accent-ink: #ffffff;
    --chip-marketing-bg: #eef2ea;
    --chip-marketing-ink: #3d5c3f;
    --chip-transactional-bg: #eaf1ee;
    --chip-transactional-ink: #0f5138;
    --shadow: 0 1px 2px rgba(20,24,26,.04), 0 8px 24px rgba(20,24,26,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #14171a;
      --surface: #1c2023;
      --ink: #edf1ee;
      --muted: #9aa5a0;
      --line: #2c3236;
      --accent: #3fae7c;
      --accent-ink: #08150f;
      --chip-marketing-bg: #24322a;
      --chip-marketing-ink: #b8d6bd;
      --chip-transactional-bg: #1c332b;
      --chip-transactional-ink: #8fe0bd;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.4);
    }
  }
  :root[data-theme="dark"] {
    --bg: #14171a; --surface: #1c2023; --ink: #edf1ee; --muted: #9aa5a0; --line: #2c3236;
    --accent: #3fae7c; --accent-ink: #08150f; --chip-marketing-bg: #24322a; --chip-marketing-ink: #b8d6bd;
    --chip-transactional-bg: #1c332b; --chip-transactional-ink: #8fe0bd;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.4);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: 'IBM Plex Sans', -apple-system, Helvetica, Arial, sans-serif;
    display: grid; grid-template-columns: 240px 1fr; min-height: 100vh;
  }
  @media (max-width: 760px) { body { grid-template-columns: 1fr; } }
  aside {
    border-right: 1px solid var(--line); padding: 24px 16px; position: sticky; top: 0;
    height: 100vh; overflow-y: auto;
  }
  @media (max-width: 760px) { aside { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--line); } }
  aside .brand { font-weight: 700; font-size: 15px; margin-bottom: 2px; }
  aside .tagline { font-size: 12px; color: var(--muted); margin-bottom: 20px; }
  aside .stat { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); margin-bottom: 2px; font-variant-numeric: tabular-nums; }
  aside nav { margin-top: 20px; display: flex; flex-direction: column; gap: 2px; }
  aside nav a {
    display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 6px;
    color: var(--ink); text-decoration: none; font-size: 13px;
  }
  aside nav a:hover { background: var(--surface); }
  aside nav a .count { font-family: 'JetBrains Mono', monospace; color: var(--muted); font-size: 11px; }
  main { padding: 28px 28px 80px; min-width: 0; }
  main > .lede { max-width: 640px; margin-bottom: 32px; }
  main > .lede h1 { font-size: 22px; margin: 0 0 6px; }
  main > .lede p { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin: 0; }
  .group { margin-bottom: 44px; }
  .group h2 {
    font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted);
    margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--line);
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px; }
  .card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column;
    scroll-margin-top: 16px;
  }
  .msg-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px 0; }
  .msg-from { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
  .msg-kind {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; white-space: nowrap;
  }
  .kind-transactional { background: var(--chip-transactional-bg); color: var(--chip-transactional-ink); }
  .kind-marketing { background: var(--chip-marketing-bg); color: var(--chip-marketing-ink); }
  .msg-subject { font-size: 14.5px; font-weight: 600; padding: 8px 14px 0; text-wrap: balance; }
  .msg-preheader { font-size: 12px; color: var(--muted); padding: 3px 14px 10px; }
  .msg-key {
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted);
    padding: 0 14px 10px; border-bottom: 1px solid var(--line);
  }
  .msg-frame { width: 100%; height: 540px; border: 0; background: #efe9dd; }
</style>
</head>
<body>
  <aside>
    <div class="brand">Freeley Email Bench</div>
    <div class="tagline">Rendered preview — every template, real HTML</div>
    <div class="stat">${total} templates</div>
    <div class="stat">${TRANSACTIONAL_KEYS.size} transactional · ${marketingCount} marketing</div>
    <nav>${nav}</nav>
  </aside>
  <main>
    <div class="lede">
      <h1>Email flow — full catalog</h1>
      <p>Generated ${new Date().toISOString().slice(0, 10)}. Each panel is the exact, fully-inlined HTML the patient receives, rendered live in an iframe — not a screenshot. Subject and preheader are shown above it as they'd appear in an inbox list. See <code>docs/EMAIL_FLOWS.md</code> for triggers and timing.</p>
    </div>
    ${sections}
  </main>
</body>
</html>`;
}

const outPath = path.resolve(process.cwd(), process.argv[2] || 'email-preview.html');
fs.writeFileSync(outPath, buildGallery(), 'utf8');
console.log(`Wrote ${GROUPS.reduce((n, g) => n + g.keys.length, 0)} template previews to ${outPath}`);
