/**
 * Renders any of the 29 campaign emails defined in docs/email-campaign/flow.js
 * into real HTML using the production brand shell (./shared.js). Used by the
 * two campaign journeys — journeys/lead-nurture.js (A1–A16, C1–C4) and
 * journeys/patient-newsletter.js (B1–B9) — and, through the thin wrapper at
 * docs/email-campaign/render.js, by scripts/build-campaign-pdf.js and
 * scripts/render-campaign-samples.js. One renderer, so the PDF the client
 * approved and the email that actually sends can never drift apart.
 *
 * Six emails get a bespoke layout (hero+timeline, hero+tiles, price ladder,
 * numbered editorial, offer card, colour-coded playbook); everything else goes
 * through the generic layout, which follows each email's `layout` hint loosely:
 * eyebrow → headline → body → (image) → button → P.S.
 *
 * WHY THE COPY LIVES UNDER docs/: flow.js is simultaneously the client-facing
 * proposal (it is what the PDF is built from) and the production copy, and
 * duplicating 29 emails' worth of text into two files is how they start
 * disagreeing. Requiring across the tree is safe here — Netlify's function
 * bundler traces require() from the entry file wherever it leads, which is
 * already how create-authnet-transaction.js and create-payment-intent.js pull
 * in the repo-root pricing.json — and netlify.toml declares no `included_files`
 * restriction and there is no .netlifyignore.
 */
const { renderEmailShell, renderButton, renderStepTimeline, siteUrl, COLORS } = require('./shared');
const { EMAILS, TRACKS } = require('../../../../docs/email-campaign/flow');
const PRICING = require('../../../../pricing.json');

// pricing.json's promos block is the only place a code is defined; A13/A15/C3
// quote it, and create-authnet-transaction.js is what actually honours it.
const PROMO_CODE = 'WELCOME10';

const SERIF = "Georgia,'Source Serif 4',serif";
const SANS = "-apple-system,'Archivo',Helvetica,Arial,sans-serif";

/**
 * Merge-tag resolvers. flow.js's copy is written with {{snake_case}} tags;
 * the engine hands templates the camelCase `data` object enrollJourney was
 * called with. Every tag flow.js uses needs an entry here — an unknown one
 * renders as nothing rather than leaking "{{tag}}" or "undefined" into an
 * inbox, and warns so the gap shows up in the function logs.
 */
const MERGE = {
  first_name: (d) => String(d.firstName || d.first_name || '').trim() || 'there',
  vertical: (d) => String(d.vertical || '').trim(),
  resume_url: (d) => d.resumeUrl || d.resume_url || siteUrl('/assessment-quiz'),
  promo_code: (d) => d.promoCode || d.promo_code || PROMO_CODE,
  hub_url: (d) => d.hubUrl || d.hub_url || siteUrl('/hub'),
  // C4's "keep me on the monthly letter" button. The HMAC-signed
  // emailPreferences link the engine already injects for the unsubscribe
  // footer is what identifies the clicker, so the same link plus &keep=1 is
  // the only version of this button that can actually record anything — a
  // bare /?keep=1 carries no identity. Falls back to the plain preferences
  // page if a caller somehow renders C4 with no unsubscribe URL.
  keep_url: (d) => (d.unsubscribeUrl ? `${d.unsubscribeUrl}&keep=1` : siteUrl('/.netlify/functions/emailPreferences?keep=1'))
};

const img = (rel) => siteUrl('/' + rel.split('/').map(encodeURIComponent).join('/'));
const h1 = (t, size = 26) => `<h1 style="margin:0 0 16px; font-family:${SERIF}; font-size:${size}px; line-height:1.2; font-weight:600; color:${COLORS.ink};">${t}</h1>`;
const p = (t) => `<p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${t}</p>`;
const muted = (t) => `<p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:${COLORS.muted};">${t}</p>`;
const tag = (t) => `<p style="margin:0 0 12px; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; font-weight:700; color:${COLORS.brand};">${t}</p>`;
const hero = (rel, alt = '') => `<img src="${img(rel)}" alt="${alt}" width="408" style="display:block; width:100%; max-width:408px; height:auto; border-radius:14px; margin:0 0 22px;" />`;
const smallImg = (rel, w = 180) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><img src="${img(rel)}" alt="" width="${w}" style="display:block; width:${w}px; max-width:100%; height:auto; margin:4px auto 8px;" /></td></tr></table>`;

/** flow.js's inline syntax → HTML: {{merge tags}}, **bold**, [label](url). */
const fill = (s, data) => String(s)
  .replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const resolve = MERGE[k];
    if (!resolve) {
      console.warn(`[CAMPAIGN RENDER] No resolver for merge tag {{${k}}} — rendering empty`);
      return '';
    }
    return resolve(data);
  })
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\][]+)\]\(([^)\s]+)\)/g, `<a href="$2" style="color:${COLORS.brand}; font-weight:600; text-decoration:underline;">$1</a>`);

function bodyHtml(lines, data) {
  let out = '', list = false;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!list) { out += `<ul style="margin:0 0 16px; padding-left:20px;">`; list = true; }
      out += `<li style="margin:0 0 8px; font-size:15px; line-height:1.55; color:${COLORS.ink};">${fill(line.slice(2), data)}</li>`;
    } else {
      if (list) { out += '</ul>'; list = false; }
      out += p(fill(line, data));
    }
  }
  if (list) out += '</ul>';
  return out;
}

function bodyText(e, data, unsubscribeUrl) {
  const strip = (s) => fill(s, data).replace(/<[^>]+>/g, '');
  const lines = [strip(e.headline), '', ...e.body.map((l) => strip(l).replace(/^- /, '• ')), '', `${e.cta.label}: ${fill(e.cta.url, data)}`];
  if (e.ps) lines.push('', 'P.S. ' + strip(e.ps));
  lines.push('', 'Freeley · freeley.com');
  if (unsubscribeUrl) lines.push('Unsubscribe: ' + unsubscribeUrl);
  return lines.join('\n');
}

const tiles = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr>${items.map(([n, label]) => `
  <td width="33%" valign="top" align="center" style="padding:0 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${COLORS.card}; border-radius:14px; padding:16px 8px;">
      <p style="margin:0 0 4px; font-family:${SERIF}; font-size:26px; line-height:1; color:${COLORS.brand};">${n}</p>
      <p style="margin:0; font-size:12.5px; line-height:1.35; font-weight:600; color:${COLORS.ink}; font-family:${SANS};">${label}</p>
    </td></tr></table>
  </td>`).join('')}</tr></table>`;
const cta = (e, data) => renderButton(e.cta.label, fill(e.cta.url, data));
const strongSplit = (l, data) => { const m = fill(l.replace(/^- /, ''), data).match(/^<strong>(.+?)<\/strong>\s*(.*)$/); return m ? { title: m[1], detail: m[2] } : { title: fill(l, data), detail: '' }; };
const eyebrow = (e, v) => {
  const base = e.track === 'B' ? 'The Freeley Journal' : e.track === 'C' ? 'Freeley' : 'Freeley Letter';
  return `${base} · ${v?.vertical ? v.vertical + ' · ' : ''}Day ${e.day}`;
};
/**
 * Stamps utm_* on every freeley.com link in the email body, centrally, so no
 * email can ship untagged and nobody has to remember to hand-add them (flow.js
 * RULES' "Measurement" entry is the promise this keeps). Applied to the body
 * HTML only — never to the shell's footer or the unsubscribe/preferences link,
 * whose query strings are signed. A link that already carries utm_source is
 * left alone.
 */
function addUtm(html, e, journey) {
  const base = siteUrl('');
  return String(html).replace(/href="([^"]+)"/g, (whole, url) => {
    if (!url.startsWith(base) || /[?&]utm_source=/.test(url)) return whole;
    if (url.includes('/.netlify/functions/emailPreferences')) return whole;
    const sep = url.includes('?') ? '&' : '?';
    return `href="${url}${sep}utm_source=email&utm_medium=campaign&utm_campaign=${journey}&utm_content=${e.id}"`;
  });
}

/** Track A and C are one journey (`lead-nurture`); Track B is `patient-newsletter`. */
const journeyFor = (e) => (e.track === 'B' ? 'patient-newsletter' : 'lead-nurture');

const finish = (e, v, inner, data) => {
  const c = v || e;
  const unsubscribeUrl = data.unsubscribeUrl || null;
  const bodyHtml = addUtm(inner, e, journeyFor(e));
  return {
    id: v ? `${e.id}-${v.vertical.toLowerCase().replace(/\s+/g, '-')}` : e.id,
    emailId: e.id,
    vertical: v?.vertical || null,
    subject: fill(c.subject, data),
    preheader: fill(c.preheader, data),
    text: bodyText(c, data, unsubscribeUrl),
    html: renderEmailShell({ preheader: fill(c.preheader, data), bodyHtml, kind: 'marketing', unsubscribeUrl })
  };
};

// ── Generic layout ────────────────────────────────────────────────────────
const isPhoto = (rel) => /\.(jpe?g|webp)$/i.test(rel) || /hero|lifestyle|couple|cta-girl/i.test(rel);
function generic(e, v, data) {
  const c = v || e;
  const src = c.image?.src || '';
  const useHero = src && isPhoto(src);
  const inner = `
    ${useHero ? hero(src) : ''}
    ${tag(eyebrow(e, v))}
    ${h1(c.headline)}
    ${bodyHtml(c.body, data)}
    ${src && !useHero ? smallImg(src) : ''}
    ${cta(c, data)}
    ${c.ps ? muted('P.S. ' + fill(c.ps, data)) : ''}`;
  return finish(e, v, inner, data);
}

// ── Bespoke layouts ───────────────────────────────────────────────────────
const SPECIAL = {
  A1(e, v, data) {
    const [greet, intro, s1, s2, s3, outro] = e.body;
    return finish(e, null, `
      ${hero(e.image.src, 'Freeley patients')}
      ${tag('Welcome to Freeley')}
      ${h1(e.headline)}
      ${p(fill(greet, data))}${p(fill(intro, data))}
      ${renderStepTimeline([strongSplit(s1, data), strongSplit(s2, data), strongSplit(s3, data)])}
      ${p(fill(outro, data))}
      ${cta(e, data)}
      ${muted('P.S. ' + fill(e.ps, data))}`, data);
  },
  A4(e, v, data) {
    const [greet, para1, lead, b1, b2, b3, close] = v.body;
    const labels = [b1, b2, b3].map((l) => strongSplit(l, data).title.replace(/[."]/g, '').replace(/\s*$/, ''));
    return finish(e, v, `
      ${hero(v.image.src, v.vertical)}
      ${tag(`${v.vertical} · Day ${e.day}`)}
      ${h1(v.headline)}
      ${p(fill(greet, data))}${p(fill(para1, data))}${p(fill(lead, data))}
      ${tiles([['01', labels[0]], ['02', labels[1]], ['03', labels[2]]])}
      ${bodyHtml([b1, b2, b3], data)}
      ${p(fill(close, data))}
      ${cta(v, data)}`, data);
  },
  A6(e, v, data) {
    const [greet, lead, ...rest] = e.body;
    const included = rest.filter((l) => l.startsWith('- '));
    const after = rest.filter((l) => !l.startsWith('- '));
    const cell = (t, first, last) => `<td style="padding:10px 8px; font-size:13px; text-align:${first ? 'left' : 'center'}; font-weight:${first || last ? 600 : 400}; color:${last ? COLORS.brand : COLORS.ink}; border-bottom:1px solid ${COLORS.line};">${t}</td>`;
    const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px; border-collapse:collapse; font-family:${SANS};">
      <tr>${['Per month', '1 mo', '3 mo', '6 mo', '12 mo', '24 mo'].map((h, i) => `<th style="padding:8px; font-size:11px; letter-spacing:.6px; text-transform:uppercase; color:${COLORS.muted}; text-align:${i ? 'center' : 'left'}; border-bottom:2px solid ${COLORS.line};">${h}</th>`).join('')}</tr>
      ${priceLadder().map((r) => `<tr>${r.map((c, i) => cell(c, i === 0, i === 5)).join('')}</tr>`).join('')}</table>`;
    // Every non-bullet line after the "what's included" list renders in its
    // own order, below the table and above the button. Previously this picked
    // after[0]/after[1] out by index and rendered them reversed, which put the
    // explanation of the price ladder *underneath* the CTA in small grey text;
    // mapping the array keeps the copy in flow.js's order whatever it becomes.
    return finish(e, null, `
      ${tag('Pricing · Day 9')}
      ${h1(e.headline)}
      ${p(fill(greet, data))}${p(fill(lead, data))}
      ${bodyHtml(included, data)}
      ${table}
      ${after.map((l) => p(fill(l, data))).join('')}
      ${cta(e, data)}`, data);
  },
  A9(e, v, data) {
    const [greet, ...items] = e.body;
    const list = items.slice(0, 5).map((l) => {
      const m = fill(l, data).match(/^<strong>(\d)\.\s*(.+?)<\/strong>\s*(.*)$/);
      return `<tr>
        <td valign="top" width="40" style="padding:0 12px 20px 0;"><div style="font-family:${SERIF}; font-size:30px; line-height:1; color:${COLORS.brand};">${m[1]}</div></td>
        <td valign="top" style="padding:0 0 20px; border-bottom:1px solid ${COLORS.line};">
          <p style="margin:0 0 4px; font-size:15px; font-weight:700; color:${COLORS.ink};">${m[2]}</p>
          <p style="margin:0 0 12px; font-size:14px; line-height:1.55; color:${COLORS.ink};">${m[3]}</p></td></tr>`;
    }).join('');
    return finish(e, null, `
      ${tag('Freeley Letter · No. 9')}
      ${h1(e.headline, 30)}
      ${p(fill(greet, data))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${list}</table>
      ${p(fill(items[5], data))}
      ${cta(e, data)}
      ${muted('Freeley Letter goes out every other week to people who asked to hear from us. Reply any time — a person reads it.')}`, data);
  },
  A13(e, v, data) {
    const [greet, lead, , close] = e.body;
    const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;"><tr><td align="center" style="background:${COLORS.green}; border-radius:18px; padding:28px 20px;">
      <p style="margin:0 0 6px; font-size:12px; letter-spacing:1.4px; text-transform:uppercase; color:#cfe3d8; font-family:${SANS};">10% off your first order</p>
      <p style="margin:0 0 6px; font-family:${SERIF}; font-size:38px; letter-spacing:2px; color:#ffffff;">${MERGE.promo_code(data)}</p>
      <p style="margin:0; font-size:13px; color:#cfe3d8; font-family:${SANS};">Any plan · any product line · expires Sunday, midnight</p>
    </td></tr></table>`;
    return finish(e, null, `
      ${hero(e.image.src)}
      ${h1(e.headline)}
      ${p(fill(greet, data))}${p(fill(lead, data))}
      ${card}
      ${p(fill(close, data))}
      ${cta(e, data)}
      ${muted('P.S. ' + fill(e.ps, data))}`, data);
  },
  B3(e, v, data) {
    const [greet, lead, normal, message, er, close] = e.body;
    const block = (l, color, bg) => { const s = strongSplit(l, data); return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td style="background:${bg}; border-left:4px solid ${color}; border-radius:0 12px 12px 0; padding:14px 16px;">
        <p style="margin:0 0 4px; font-size:13px; font-weight:700; color:${color}; font-family:${SANS};">${s.title}</p>
        <p style="margin:0; font-size:14px; line-height:1.55; color:${COLORS.ink};">${s.detail}</p></td></tr></table>`; };
    return finish(e, null, `
      ${tag('The Freeley Journal · Week 2')}
      ${h1(e.headline)}
      ${p(fill(greet, data))}${p(fill(lead, data))}
      ${block(normal, COLORS.brand, '#e7f1ec')}
      ${block(message, '#8a6a2e', '#fbf3e2')}
      ${block(er, '#9b2c2c', '#fbeaea')}
      ${p(fill(close, data))}
      ${smallImg(e.image.src, 160)}
      ${cta(e, data)}`, data);
  }
};

/**
 * A6's price ladder, read straight out of pricing.json rather than restated
 * here — including the 24-month column, confirmed final by the client
 * 2026-09-15 (see pricing.json's `_meta.note`).
 * @returns {string[][]} rows of [label, 1mo, 3mo, 6mo, 12mo, 24mo]
 */
function priceLadder() {
  const row = (label, tiers) => [label, ...['1', '3', '6', '12', '24'].map((m) => '$' + tiers[m])];
  return [
    row('GLP-1 weight loss', PRICING['weight-loss'].semaglutide),
    row('Sexual wellness', PRICING['sexual-wellness'].default),
    row('Longevity', PRICING.longevity.default),
    row('Hair loss', PRICING['hair-loss'].default)
  ];
}

/** Loose match so 'Weight Loss', 'weight-loss' and 'weight loss' all land together. */
const slugVertical = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Picks the vertical variant matching `data.vertical`, falling back to the
 * first one (Weight loss) when the lead's interest is unknown or unrecognised
 * — waitlist imports have no vertical at all. Emails with no variants render
 * their single body.
 *
 * The value captureLead.js forwards is whatever the quiz put in it, which is
 * NOT a tidy enum: public/quiz-scripts/asw.js sends
 * `getSelectedOptionsTexts(1).join(', ')`, i.e. the step-1 option labels
 * verbatim and comma-joined for a multi-select. So "Longevity & performance"
 * (the real label in src/pages/assessment-quiz.astro) and
 * "Hair loss, Weight loss" both have to work. Hence: split on commas, and
 * match a segment against a variant if either contains the other once
 * normalised — an exact-equality check silently sent every longevity lead the
 * GLP-1 email. Earlier segments win, so a multi-select gets its first pick.
 */
function resolveVariant(e, data = {}) {
  if (!e.variants || !e.variants.length) return null;
  const segments = String(data.vertical || '').split(',').map(slugVertical).filter(Boolean);
  for (const segment of segments) {
    const hit = e.variants.find((v) => {
      const key = slugVertical(v.vertical);
      return segment === key || segment.includes(key) || key.includes(segment);
    });
    if (hit) return hit;
  }
  return e.variants[0];
}

/** Renders one email definition (optionally one of its variants) with real merge data. */
function renderCampaign(e, variant, data = {}) {
  const special = SPECIAL[e.id];
  return special ? special(e, variant, data) : generic(e, variant, data);
}

/**
 * The production entry point every journey step template calls.
 * @param {string} emailId  an id from flow.js's EMAILS — 'A1'…'A16', 'B1'…'B9', 'C1'…'C4'
 * @param {object} data     enrollJourney's `data` plus the engine-injected `unsubscribeUrl`
 * @returns {{subject: string, preheader: string, html: string}} the TEMPLATES contract
 */
function renderCampaignEmail(emailId, data = {}) {
  const e = EMAILS.find((x) => x.id === emailId);
  if (!e) throw new Error(`[CAMPAIGN RENDER] Unknown campaign email id "${emailId}"`);
  const { subject, preheader, html } = renderCampaign(e, resolveVariant(e, data), data);
  return { subject, preheader, html };
}

module.exports = { renderCampaign, renderCampaignEmail, resolveVariant, priceLadder, EMAILS, TRACKS, PROMO_CODE };
