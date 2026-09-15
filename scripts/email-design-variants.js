#!/usr/bin/env node
/**
 * One-off design comparison for Anthony: 3 corner/weight treatments for the
 * email shell (lib/email-templates/shared.js), each rendered around the
 * SAME two representative emails so the only variable is the shell style.
 *
 * Exploratory only — none of this touches the production shared.js. The
 * two email bodies below are deliberately duplicated (not imported from
 * lib/email-templates/order-confirmed.js / journeys/onboarding.js) because
 * those call the CURRENT renderButton/renderStepTimeline directly and
 * aren't parameterized by shell style; once a direction is picked, that
 * one variant's tokens fold into shared.js for real and this file goes away.
 *
 * Usage: node scripts/email-design-variants.js [output-path.html]
 */

const fs = require('fs');
const path = require('path');
const { COLORS } = require('../netlify/functions/lib/email-templates/shared');
const { inlineLogo, WHITE_LOGO_URL, HIPAA_BADGE_URL, USA_BADGE_URL } = require('./lib/inline-logo');

const STYLES = [
  {
    key: 'rounded',
    label: 'A — Rounded',
    blurb: 'Current shell — 20px card, full pill button.',
    cardRadius: '20px',
    buttonRadius: '999px',
    stepRadius: '50%',
    statRadius: '14px',
    cardShadow: '0 10px 30px rgba(0,0,0,.08)',
    cardBorder: 'none',
    padding: '40px 36px',
    topBar: false
  },
  {
    key: 'soft',
    label: 'B — Soft',
    blurb: 'Slightly squared — 10px card, 10px button, thin border replaces the heavy shadow.',
    cardRadius: '10px',
    buttonRadius: '10px',
    stepRadius: '6px',
    statRadius: '8px',
    cardShadow: '0 6px 20px rgba(0,0,0,.05)',
    cardBorder: `1px solid ${COLORS.line}`,
    padding: '40px 36px',
    topBar: false
  },
  {
    key: 'editorial',
    label: 'C — Editorial',
    blurb: 'Crisp and clinical — 4px corners, hairline border, a brand-green top bar instead of a shadow.',
    cardRadius: '4px',
    buttonRadius: '4px',
    stepRadius: '2px',
    statRadius: '2px',
    cardShadow: 'none',
    cardBorder: `1px solid ${COLORS.line}`,
    padding: '36px 36px 40px',
    topBar: true
  }
];

function eyebrow(style, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:${COLORS.card}; border-radius:${style.buttonRadius === '999px' ? '999px' : '4px'}; padding:5px 12px;">
    <span style="font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:${COLORS.brand};">${label}</span>
  </td></tr></table>`;
}

function trustStrip(style) {
  // Explicit width AND height on both badges (not just width) — without a
  // reserved height, a mail client that hasn't loaded remote images yet
  // (the mobile-client default) collapses the cell to zero height instead
  // of holding its place, which reads as "broken" even when the image is
  // simply pending a tap-to-load.
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0; border-top:1px solid ${COLORS.line}; padding-top:20px;">
    <tr>
      <td valign="middle">
        <img src="${HIPAA_BADGE_URL}" width="71" height="40" alt="HIPAA compliant" style="display:block; max-width:100%; height:auto;" />
      </td>
      <td width="10"></td>
      <td valign="middle">
        <img src="${USA_BADGE_URL}" width="82" height="32" alt="Made in USA" style="display:block; max-width:100%; height:auto;" />
      </td>
      <td align="right" valign="middle" class="trust-copy" style="font-size:11.5px; line-height:1.5; color:${COLORS.muted};">
        Reviewed by a<br />licensed clinician
      </td>
    </tr>
  </table>`;
}

function button(style, label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td align="center" style="border-radius:${style.buttonRadius}; background:${COLORS.green};">
    <a href="${url}" style="display:inline-block; padding:15px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:${style.buttonRadius}; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">${label}</a>
  </td></tr></table>`;
}

// 2x2 grid instead of a stacked list — denser, reads like a real receipt
// rather than a plain label/value list.
// `stat-cell` gets a mobile @media override (stack to one column) — inline
// styles alone can't respond to viewport width, only a class selector can.
function statCard(style, pairs) {
  const cell = ([label, value]) => `
    <td width="50%" valign="top" class="stat-cell" style="padding:0 10px 16px 0;">
      <p style="margin:0 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:${COLORS.muted};">${label}</p>
      <p style="margin:0; font-size:16px; font-weight:700; color:${COLORS.ink};">${value}</p>
    </td>`;
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    rows.push(`<tr>${cell(pairs[i])}${pairs[i + 1] ? cell(pairs[i + 1]) : '<td></td>'}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px; background:${COLORS.card}; border-radius:${style.statRadius}; border:1px solid ${COLORS.line};"><tr><td style="padding:18px 20px 2px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows.join('')}</table></td></tr></table>`;
}

// Solid brand-green numbered circles (was a pale grey outline) — reads as a
// real progress tracker instead of a plain bullet list, wrapped in its own
// tinted panel so it reads as one distinct "block" rather than floating copy.
function stepTimeline(style, steps) {
  const rows = steps.map((s, i) => `
    <tr>
      <td valign="top" width="30" style="padding:0 12px ${i === steps.length - 1 ? 0 : 16}px 0;">
        <div style="width:22px; height:22px; border-radius:${style.stepRadius}; background:${COLORS.green}; color:#ffffff; font-size:11.5px; font-weight:700; line-height:22px; text-align:center; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">${i + 1}</div>
      </td>
      <td valign="top" style="padding:0 0 ${i === steps.length - 1 ? 0 : 16}px;">
        <p style="margin:0 0 2px; font-size:14px; font-weight:600; color:${COLORS.ink};">${s.title}</p>
        <p style="margin:0; font-size:12.5px; line-height:1.5; color:${COLORS.muted};">${s.detail}</p>
      </td>
    </tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px; background:${COLORS.card}; border-radius:${style.statRadius}; border:1px solid ${COLORS.line};"><tr><td style="padding:18px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr></table>`;
}

function secondaryLink(label, url) {
  return `<p style="margin:0 0 4px; text-align:center; font-size:13px;"><a href="${url}" style="color:${COLORS.brand}; text-decoration:none; font-weight:600;">${label}</a></p>`;
}

function helpCard(style) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0 0; background:${COLORS.card}; border-radius:${style.statRadius}; border:1px solid ${COLORS.line};"><tr><td style="padding:14px 18px;">
    <p style="margin:0; font-size:12.5px; line-height:1.5; color:${COLORS.muted};">
      <strong style="color:${COLORS.ink};">Questions about your order?</strong><br />
      Message your care team anytime from the Hub, or reply to this email.
    </p>
  </td></tr></table>`;
}

// ── Two representative bodies (content matches the real order-confirmed
// and onboarding-1 templates, expanded with the header band / eyebrow /
// mini-timeline / trust strip components above) ──
function orderConfirmedBody(style) {
  return `
    ${eyebrow(style, 'Order confirmed')}
    <h1 style="margin:0 0 14px; font-family:Georgia,'Source Serif 4',serif; font-size:27px; font-weight:600; color:${COLORS.ink}; text-wrap:balance;">Thanks for choosing Freeley, Jane</h1>
    <p style="margin:0 0 22px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your payment went through and your care team has been notified. This plan renews automatically every 3 months — you can change or cancel anytime from the Hub.
    </p>
    ${statCard(style, [['Plan', 'Weight Loss Plan'], ['Term', '3 months'], ['Amount charged', '$267.00'], ['Card on file', '&bull;&bull;&bull;&bull; 4242']])}
    <p style="margin:0 0 12px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:${COLORS.muted};">What happens next</p>
    ${stepTimeline(style, [
      { title: 'Clinician review', detail: 'A licensed clinician reviews your intake, usually within 24–48 hours.' },
      { title: 'Pharmacy fulfillment', detail: 'Once approved, your prescription is sent to our pharmacy partner.' },
      { title: 'Shipped to your door', detail: "You'll get tracking the moment it ships." }
    ])}
    ${button(style, 'Go to your Hub', 'https://freeley.com/hub')}
    ${secondaryLink('View full order details', 'https://freeley.com/hub')}
    ${helpCard(style)}
    ${trustStrip(style)}
  `;
}

function onboardingBody(style) {
  return `
    ${eyebrow(style, 'Getting started')}
    <h1 style="margin:0 0 14px; font-family:Georgia,'Source Serif 4',serif; font-size:27px; font-weight:600; color:${COLORS.ink}; text-wrap:balance;">What happens next</h1>
    <p style="margin:0 0 22px; font-size:15px; line-height:1.6; color:${COLORS.ink};">Hi Jane, here's the process from here:</p>
    ${stepTimeline(style, [
      { title: 'Clinician review', detail: 'A licensed clinician reviews your intake, usually within 24–48 hours.' },
      { title: 'Pharmacy fulfillment', detail: 'Once approved, your prescription is sent to our pharmacy partner.' },
      { title: 'Shipped to your door', detail: "You'll get an email the moment it ships." }
    ])}
    ${button(style, 'Check your status', 'https://freeley.com/hub')}
    ${secondaryLink('Message your care team', 'https://freeley.com/hub')}
    ${helpCard(style)}
    ${trustStrip(style)}
  `;
}

/**
 * @param {boolean} [inline=true] Inline the logo as a data: URI (needed for
 *   Artifact previews, whose CSP blocks external images) — pass false to
 *   get the plain HTTPS logo URL a real send (or a real inbox) needs.
 */
function renderShell(style, bodyHtml, preheader, inline = true) {
  // Every style now carries the logo inside a full-bleed brand-green band at
  // the top of the card (reversed/cream mark) instead of floating loose on
  // the page background — one more layer of visual structure per the
  // "more detailed" direction, and it doubles as the old thin accent bar
  // for the editorial style.
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Freeley</title>
<style>
  /* Fer's mobile report: no responsive rules existed at all before this —
     every client got the same fixed desktop padding/columns regardless of
     screen width. This is the standard "hybrid" email media-query pattern
     (supported by Gmail app, iOS/Apple Mail, Outlook.com mobile — the
     clients that matter on a phone; ignored harmlessly by clients that
     don't support it, which just keep the desktop layout). */
  @media only screen and (max-width: 480px) {
    .band-pad { padding-left:20px !important; padding-right:20px !important; }
    .card-pad { padding-left:22px !important; padding-right:22px !important; }
    .stat-cell { display:block !important; width:100% !important; padding-right:0 !important; }
    .trust-copy { display:none !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:${COLORS.card}; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.card}; padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td style="background:#ffffff; border-radius:${style.cardRadius}; border:${style.cardBorder}; box-shadow:${style.cardShadow}; overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" class="band-pad" style="background:${COLORS.green}; padding:20px 36px;">
            <img src="${WHITE_LOGO_URL}" alt="Freeley" width="112" height="26" style="display:block; max-width:100%; height:auto;" />
          </td></tr>
          <tr><td class="card-pad" style="padding:${style.padding};">${bodyHtml}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding-top:28px; font-size:12px; line-height:1.6; color:${COLORS.muted};">
        Freeley Health &middot; Physician-supervised telehealth<br />
        This message was sent because you have an account at
        <a href="https://freeley.com" style="color:${COLORS.brand}; text-decoration:none;">freeley.com</a>.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  return inline ? inlineLogo(doc) : doc;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildComparison() {
  const columns = STYLES.map(style => {
    const emails = [
      { subject: 'Your Freeley order is confirmed', html: renderShell(style, orderConfirmedBody(style), 'Payment received — here is what happens next.') },
      { subject: 'What happens next with your order', html: renderShell(style, onboardingBody(style), 'A quick look at the process ahead.') }
    ];
    const cards = emails.map(e => `
        <div class="msg-subject">${escapeHtml(e.subject)}</div>
        <iframe srcdoc="${e.html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" loading="lazy" title="${escapeHtml(e.subject)}"></iframe>`).join('\n');
    return `
      <section class="col">
        <header>
          <div class="label">${escapeHtml(style.label)}</div>
          <div class="blurb">${escapeHtml(style.blurb)}</div>
          <div class="tokens">card ${style.cardRadius} · button ${style.buttonRadius}</div>
        </header>
        ${cards}
      </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Freeley Email Shell</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
  :root { --bg:#f2f4f1; --surface:#ffffff; --ink:#14181a; --muted:#5b6560; --line:#dde3dd; --accent:#0f6b45; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg:#14171a; --surface:#1c2023; --ink:#edf1ee; --muted:#9aa5a0; --line:#2c3236; --accent:#3fae7c; }
  }
  :root[data-theme="dark"] { --bg:#14171a; --surface:#1c2023; --ink:#edf1ee; --muted:#9aa5a0; --line:#2c3236; --accent:#3fae7c; }
  * { box-sizing: border-box; }
  body { margin:0; padding:28px 16px 60px; background:var(--bg); color:var(--ink); font-family:'IBM Plex Sans',-apple-system,Helvetica,Arial,sans-serif; }
  .lede { max-width: 720px; margin: 0 auto 28px; }
  .lede h1 { font-size: 22px; margin: 0 0 6px; }
  .lede p { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin: 0; }
  .board { display: grid; grid-template-columns: repeat(3, minmax(300px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; align-items: start; }
  @media (max-width: 980px) { .board { grid-template-columns: 1fr; } }
  .col { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .col header { border-bottom: 1px solid var(--line); padding-bottom: 12px; }
  .col .label { font-weight: 700; font-size: 15px; }
  .col .blurb { font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
  .col .tokens { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); margin-top: 8px; }
  .msg-subject { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  iframe { width: 100%; height: 780px; border: 0; border-radius: 6px; background: #efe9dd; margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="lede">
    <h1>Email shell — three corner treatments</h1>
    <p>Same two emails, same palette and type, only the card/button radius and border/shadow weight change. Generated ${new Date().toISOString().slice(0, 10)}.</p>
  </div>
  <div class="board">${columns}</div>
</body>
</html>`;
}

if (require.main === module) {
  const outPath = path.resolve(process.cwd(), process.argv[2] || 'email-design-variants.html');
  fs.writeFileSync(outPath, buildComparison(), 'utf8');
  console.log(`Wrote 3-style comparison (2 emails each) to ${outPath}`);
}

module.exports = { STYLES, renderShell, orderConfirmedBody, onboardingBody };
