/**
 * Shared HTML shell for every email THIS codebase sends directly via Resend
 * (see lib/resend-client.js). Keeps one visual language across all of them —
 * logo, colors, footer — instead of duplicating a full HTML document per
 * email. Colors/fonts are hardcoded (not CSS custom properties) because mail
 * clients don't support `var()`; values copied from public/style/style.css's
 * :root block, the same palette every marketing page uses.
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
 * @param {{ preheader?: string, bodyHtml: string }} args bodyHtml is raw HTML
 *   dropped inside the white card — headings/paragraphs/buttons, already
 *   styled inline by the caller.
 */
function renderEmailShell({ preheader, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
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
        Freeley Health &middot; Physician-supervised telehealth<br />
        This message was sent because you have an account at
        <a href="https://freeley.com" style="color:${COLORS.brand}; text-decoration:none;">freeley.com</a>.
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

module.exports = { renderEmailShell, renderButton, COLORS, LOGO_URL };
