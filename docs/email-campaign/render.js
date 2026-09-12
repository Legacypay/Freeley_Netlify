/**
 * Renders any email from flow.js as real HTML using the production brand
 * shell (netlify/functions/lib/email-templates/shared.js). Used by
 * scripts/build-campaign-pdf.js (mobile/desktop previews for every email) and
 * scripts/render-campaign-samples.js (the handful sent to a real inbox).
 *
 * Six emails get a bespoke layout (hero+timeline, hero+tiles, price ladder,
 * numbered editorial, offer card, colour-coded playbook); everything else goes
 * through the generic layout, which follows each email's `layout` hint loosely:
 * eyebrow → headline → body → (image) → button → P.S.
 */
const { renderEmailShell, renderButton, renderStepTimeline, COLORS } = require('../../netlify/functions/lib/email-templates/shared');
const { EMAILS, TRACKS, SITE } = require('./flow');

const SAMPLE = { first_name: 'Samuel', promo_code: 'WELCOME10', resume_url: `${SITE}/assessment-quiz`, next_refill_date: 'October 24', next_refill_amount: '$199.00', referral_code: 'SAMUEL10', vertical: 'weight loss' };
const UNSUB = `${SITE}/.netlify/functions/emailPreferences?sample=1`;
const img = (rel) => `${SITE}/${rel.split('/').map(encodeURIComponent).join('/')}`;

const SERIF = "Georgia,'Source Serif 4',serif";
const SANS = "-apple-system,'Archivo',Helvetica,Arial,sans-serif";
const h1 = (t, size = 26) => `<h1 style="margin:0 0 16px; font-family:${SERIF}; font-size:${size}px; line-height:1.2; font-weight:600; color:${COLORS.ink};">${t}</h1>`;
const p = (t) => `<p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${t}</p>`;
const muted = (t) => `<p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:${COLORS.muted};">${t}</p>`;
const tag = (t) => `<p style="margin:0 0 12px; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; font-weight:700; color:${COLORS.brand};">${t}</p>`;
const hero = (rel, alt = '') => `<img src="${img(rel)}" alt="${alt}" width="408" style="display:block; width:100%; max-width:408px; height:auto; border-radius:14px; margin:0 0 22px;" />`;
const smallImg = (rel, w = 180) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><img src="${img(rel)}" alt="" width="${w}" style="display:block; width:${w}px; max-width:100%; height:auto; margin:4px auto 8px;" /></td></tr></table>`;

const fill = (s) => String(s)
  .replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE[k] ?? `{{${k}}}`)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([A-Z][^\]]{6,})\]/g, `<em style="color:${COLORS.muted};">[$1]</em>`);

function bodyHtml(lines) {
  let out = '', list = false;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!list) { out += `<ul style="margin:0 0 16px; padding-left:20px;">`; list = true; }
      out += `<li style="margin:0 0 8px; font-size:15px; line-height:1.55; color:${COLORS.ink};">${fill(line.slice(2))}</li>`;
    } else {
      if (list) { out += '</ul>'; list = false; }
      out += p(fill(line));
    }
  }
  if (list) out += '</ul>';
  return out;
}
function bodyText(e) {
  const strip = (s) => fill(s).replace(/<[^>]+>/g, '');
  const lines = [strip(e.headline), '', ...e.body.map((l) => strip(l).replace(/^- /, '• ')), '', `${e.cta.label}: ${fill(e.cta.url)}`];
  if (e.ps) lines.push('', 'P.S. ' + strip(e.ps));
  lines.push('', 'Freeley · freeley.com', 'Unsubscribe: ' + UNSUB);
  return lines.join('\n');
}
const tiles = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr>${items.map(([n, label]) => `
  <td width="33%" valign="top" align="center" style="padding:0 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${COLORS.card}; border-radius:14px; padding:16px 8px;">
      <p style="margin:0 0 4px; font-family:${SERIF}; font-size:26px; line-height:1; color:${COLORS.brand};">${n}</p>
      <p style="margin:0; font-size:12.5px; line-height:1.35; font-weight:600; color:${COLORS.ink}; font-family:${SANS};">${label}</p>
    </td></tr></table>
  </td>`).join('')}</tr></table>`;
const cta = (e) => renderButton(e.cta.label, fill(e.cta.url));
const strongSplit = (l) => { const m = fill(l.replace(/^- /, '')).match(/^<strong>(.+?)<\/strong>\s*(.*)$/); return m ? { title: m[1], detail: m[2] } : { title: fill(l), detail: '' }; };
const trackName = (e) => (TRACKS.find((t) => t.id === e.track) || {}).name || '';
const eyebrow = (e, v) => {
  const base = e.track === 'B' ? 'The Freeley Journal' : e.track === 'C' ? 'Freeley' : 'Freeley Letter';
  return `${base} · ${v?.vertical ? v.vertical + ' · ' : ''}Day ${e.day}`;
};
const finish = (e, v, inner) => ({
  id: v ? `${e.id}-${v.vertical.toLowerCase().replace(/\s+/g, '-')}` : e.id,
  emailId: e.id, vertical: v?.vertical || null,
  subject: fill((v || e).subject), preheader: fill((v || e).preheader), text: bodyText(v || e),
  html: renderEmailShell({ preheader: fill((v || e).preheader), bodyHtml: inner, kind: 'marketing', unsubscribeUrl: UNSUB })
});

// ── Generic layout ────────────────────────────────────────────────────────
const isPhoto = (rel) => /\.(jpe?g|webp)$/i.test(rel) || /hero|lifestyle|couple|cta-girl/i.test(rel);
function generic(e, v) {
  const c = v || e;
  const src = c.image?.src || '';
  const useHero = src && isPhoto(src);
  const inner = `
    ${useHero ? hero(src) : ''}
    ${tag(eyebrow(e, v))}
    ${h1(c.headline)}
    ${bodyHtml(c.body)}
    ${src && !useHero ? smallImg(src) : ''}
    ${cta(c)}
    ${c.ps ? muted('P.S. ' + fill(c.ps)) : ''}`;
  return finish(e, v, inner);
}

// ── Bespoke layouts ───────────────────────────────────────────────────────
const SPECIAL = {
  A1(e) {
    const [greet, intro, s1, s2, s3, outro] = e.body;
    return finish(e, null, `
      ${hero(e.image.src, 'Freeley patients')}
      ${tag('Welcome to Freeley')}
      ${h1(e.headline)}
      ${p(fill(greet))}${p(fill(intro))}
      ${renderStepTimeline([strongSplit(s1), strongSplit(s2), strongSplit(s3)])}
      ${p(fill(outro))}
      ${cta(e)}
      ${muted('P.S. ' + fill(e.ps))}`);
  },
  A4(e, v) {
    const [greet, para1, lead, b1, b2, b3, close] = v.body;
    const labels = [b1, b2, b3].map((l) => strongSplit(l).title.replace(/[."]/g, '').replace(/\s*$/, ''));
    return finish(e, v, `
      ${hero(v.image.src, v.vertical)}
      ${tag(`${v.vertical} · Day ${e.day}`)}
      ${h1(v.headline)}
      ${p(fill(greet))}${p(fill(para1))}${p(fill(lead))}
      ${tiles([['01', labels[0]], ['02', labels[1]], ['03', labels[2]]])}
      ${bodyHtml([b1, b2, b3])}
      ${p(fill(close))}
      ${cta(v)}`);
  },
  A6(e) {
    const [greet, lead, ...rest] = e.body;
    const included = rest.filter((l) => l.startsWith('- '));
    const after = rest.filter((l) => !l.startsWith('- '));
    const rows = [['GLP-1 weight loss', '$299', '$259', '$229', '$199'], ['Sexual wellness', '$99', '$85', '$75', '$69'], ['Longevity', '$129', '$115', '$99', '$89'], ['Hair loss', '$89', '$75', '$65', '$59']];
    const cell = (t, first, last) => `<td style="padding:10px 8px; font-size:13px; text-align:${first ? 'left' : 'center'}; font-weight:${first || last ? 600 : 400}; color:${last ? COLORS.brand : COLORS.ink}; border-bottom:1px solid ${COLORS.line};">${t}</td>`;
    const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px; border-collapse:collapse; font-family:${SANS};">
      <tr>${['Per month', '1 mo', '3 mo', '6 mo', '12 mo'].map((h, i) => `<th style="padding:8px; font-size:11px; letter-spacing:.6px; text-transform:uppercase; color:${COLORS.muted}; text-align:${i ? 'center' : 'left'}; border-bottom:2px solid ${COLORS.line};">${h}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c, i) => cell(c, i === 0, i === 4)).join('')}</tr>`).join('')}</table>`;
    return finish(e, null, `
      ${tag('Pricing · Day 9')}
      ${h1(e.headline)}
      ${p(fill(greet))}${p(fill(lead))}
      ${bodyHtml(included)}
      ${table}
      ${p(fill(after[1]))}
      ${cta(e)}
      ${muted(fill(after[0]))}`);
  },
  A9(e) {
    const [greet, ...items] = e.body;
    const list = items.slice(0, 5).map((l) => {
      const m = fill(l).match(/^<strong>(\d)\.\s*(.+?)<\/strong>\s*(.*)$/);
      return `<tr>
        <td valign="top" width="40" style="padding:0 12px 20px 0;"><div style="font-family:${SERIF}; font-size:30px; line-height:1; color:${COLORS.brand};">${m[1]}</div></td>
        <td valign="top" style="padding:0 0 20px; border-bottom:1px solid ${COLORS.line};">
          <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:${COLORS.ink};">${m[2]}</p>
          <p style="margin:0 0 12px; font-size:14px; line-height:1.55; color:${COLORS.ink};">${m[3]}</p></td></tr>`;
    }).join('');
    return finish(e, null, `
      ${tag('Freeley Letter · No. 9')}
      ${h1(e.headline, 30)}
      ${p(fill(greet))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${list}</table>
      ${p(fill(items[5]))}
      ${cta(e)}
      ${muted('Freeley Letter goes out every other week to people who asked to hear from us. Reply any time — a person reads it.')}`);
  },
  A13(e) {
    const [greet, lead, , close] = e.body;
    const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;"><tr><td align="center" style="background:${COLORS.green}; border-radius:18px; padding:28px 20px;">
      <p style="margin:0 0 6px; font-size:12px; letter-spacing:1.4px; text-transform:uppercase; color:#cfe3d8; font-family:${SANS};">10% off your first order</p>
      <p style="margin:0 0 6px; font-family:${SERIF}; font-size:38px; letter-spacing:2px; color:#ffffff;">${SAMPLE.promo_code}</p>
      <p style="margin:0; font-size:13px; color:#cfe3d8; font-family:${SANS};">Any plan · any product line · expires Sunday, midnight</p>
    </td></tr></table>`;
    return finish(e, null, `
      ${hero(e.image.src)}
      ${h1(e.headline)}
      ${p(fill(greet))}${p(fill(lead))}
      ${card}
      ${p(fill(close))}
      ${cta(e)}
      ${muted('P.S. ' + fill(e.ps))}`);
  },
  B3(e) {
    const [greet, lead, normal, message, er, close] = e.body;
    const block = (l, color, bg) => { const s = strongSplit(l); return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td style="background:${bg}; border-left:4px solid ${color}; border-radius:0 12px 12px 0; padding:14px 16px;">
        <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:${color}; font-family:${SANS};">${s.title}</p>
        <p style="margin:0; font-size:14px; line-height:1.55; color:${COLORS.ink};">${s.detail}</p></td></tr></table>`; };
    return finish(e, null, `
      ${tag('The Freeley Journal · Week 2')}
      ${h1(e.headline)}
      ${p(fill(greet))}${p(fill(lead))}
      ${block(normal, COLORS.brand, '#e7f1ec')}
      ${block(message, '#8a6a2e', '#fbf3e2')}
      ${block(er, '#9b2c2c', '#fbeaea')}
      ${p(fill(close))}
      ${smallImg(e.image.src, 160)}
      ${cta(e)}`);
  }
};

/** Render one email (or one of its variants). */
function renderCampaignEmail(e, variant = null) {
  const special = SPECIAL[e.id];
  if (special) return special(e, variant);
  return generic(e, variant);
}

/** Render every email in the flow, one entry per variant. */
function renderAll() {
  const out = [];
  for (const e of EMAILS) {
    if (e.variants) for (const v of e.variants) out.push(renderCampaignEmail(e, v));
    else out.push(renderCampaignEmail(e));
  }
  return out;
}

module.exports = { renderCampaignEmail, renderAll, EMAILS };
