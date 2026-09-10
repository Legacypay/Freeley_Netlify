/**
 * Shared HTML shell for every email THIS codebase sends directly via Resend
 * (see lib/resend-client.js, lib/email/engine.js). Keeps one visual language
 * across all of them — logo, colors, footer — instead of duplicating a full
 * HTML document per email. Colors/fonts are hardcoded (not CSS custom
 * properties) because mail clients don't support `var()`; values copied from
 * public/style/style.css's :root block, the same palette every marketing
 * page uses.
 *
 * NOT used for Supabase Auth's own emails (magic link, signup confirmation,
 * password reset) — those live entirely in the Supabase dashboard as Go
 * templates; see netlify/functions/lib/email-templates/supabase/*.html.
 */

const COLORS = {
  green: '#123c2c',
  greenDeep: '#0d3122',
  brand: '#0f6b45',
  ink: '#1a1c1a',
  muted: '#63665f',
  line: '#e5ded0',
  card: '#efe9dd'
};

const LOGO_URL = 'https://freeley.com/assets/brand/freeley_logo_primary.png';

/**
 * @param {{ preheader?: string, bodyHtml: string, kind?: 'transactional'|'marketing',
 *   unsubscribeUrl?: string|null }} args
 *   bodyHtml is raw HTML dropped inside the white card — headings/paragraphs/
 *   buttons, already styled inline by the caller. `kind:'marketing'` (with a
 *   non-null unsubscribeUrl) appends an unsubscribe line to the footer, as
 *   CAN-SPAM requires on commercial email — transactional emails (order
 *   status, receipts) never pass this.
 */
function renderEmailShell({ preheader, bodyHtml, kind = 'transactional', unsubscribeUrl }) {
  const address = process.env.EMAIL_POSTAL_ADDRESS;
  const unsubscribeLine = kind === 'marketing' && unsubscribeUrl
    ? `<br /><a href="${unsubscribeUrl}" style="color:${COLORS.muted}; text-decoration:underline;">Unsubscribe</a> from emails like this.`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Freeley</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.card}; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">
${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.card}; padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td align="center" style="padding-bottom:24px;">
        <img src="${LOGO_URL}" alt="Freeley" width="132" style="display:block; height:auto;" />
      </td></tr>
      <tr><td style="background:#ffffff; border-radius:20px; padding:40px 36px; box-shadow:0 10px 30px rgba(0,0,0,.08);">
        ${bodyHtml}
      </td></tr>
      <tr><td align="center" style="padding-top:28px; font-size:12px; line-height:1.6; color:${COLORS.muted};">
        Freeley Health &middot; Physician-supervised telehealth${address ? '<br />' + address : ''}<br />
        This message was sent because you have an account at
        <a href="https://freeley.com" style="color:${COLORS.brand}; text-decoration:none;">freeley.com</a>.${unsubscribeLine}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Rounded pill button matching the site's .quiz-btn-primary/.hub-auth__submit style. */
function renderButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td align="center" style="border-radius:999px; background:${COLORS.green};">
    <a href="${url}" style="display:inline-block; padding:15px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:999px; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">${label}</a>
  </td></tr></table>`;
}

/** Plain text link for a secondary call-to-action, under a primary button. */
function renderSecondaryLink(label, url) {
  return `<p style="margin:0 0 8px; text-align:center; font-size:13.5px;"><a href="${url}" style="color:${COLORS.brand}; text-decoration:none; font-weight:600;">${label}</a></p>`;
}

/**
 * Numbered step timeline — used for "what happens next" / order-progress
 * style emails.
 * @param {{ title: string, detail?: string, done?: boolean }[]} steps
 */
function renderStepTimeline(steps) {
  const rows = steps.map((step, i) => `
    <tr>
      <td valign="top" width="32" style="padding:0 12px 18px 0;">
        <div style="width:24px; height:24px; border-radius:50%; background:${step.done ? COLORS.brand : COLORS.card}; color:${step.done ? '#ffffff' : COLORS.muted}; font-size:12px; font-weight:700; line-height:24px; text-align:center; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">${i + 1}</div>
      </td>
      <td valign="top" style="padding:0 0 18px;">
        <p style="margin:0 0 2px; font-size:14.5px; font-weight:600; color:${COLORS.ink};">${step.title}</p>
        ${step.detail ? `<p style="margin:0; font-size:13px; line-height:1.5; color:${COLORS.muted};">${step.detail}</p>` : ''}
      </td>
    </tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 20px;">${rows}</table>`;
}

/** Small label/value card — used for receipts (amount charged, plan, etc). */
function renderStatCard(rows) {
  const inner = rows.map(([label, value], i) => `
    <p style="margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:${COLORS.muted};">${label}</p>
    <p style="margin:0 0 ${i === rows.length - 1 ? 0 : 14}px; font-size:15px; font-weight:600; color:${COLORS.ink};">${value}</p>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px; background:${COLORS.card}; border-radius:14px;"><tr><td style="padding:18px 20px;">${inner}</td></tr></table>`;
}

/** Freeley site URL (process.env.URL is Netlify's canonical site URL), optionally with a path appended. */
function siteUrl(path = '') {
  const base = (process.env.URL || 'https://freeley.com').replace(/\/$/, '');
  return base + path;
}

module.exports = { renderEmailShell, renderButton, renderSecondaryLink, renderStepTimeline, renderStatCard, siteUrl, COLORS, LOGO_URL };
