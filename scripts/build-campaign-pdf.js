#!/usr/bin/env node
/**
 * Renders docs/email-campaign/flow.js into the client-facing proposal PDF.
 *
 *   node scripts/build-campaign-pdf.js            → docs/email-campaign/Freeley_Email_Campaign_Flow.pdf
 *   node scripts/build-campaign-pdf.js --html     → also keeps the intermediate HTML next to it
 *
 * Uses the Playwright Chromium already in devDependencies (npx playwright
 * install chromium once). Suggested images are read straight from public/,
 * so the PDF shows the real asset each email would use.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { SITE, TRACKS, EMAILS, RULES, OPEN_QUESTIONS } = require('../docs/email-campaign/flow');
const { renderAll } = require('../docs/email-campaign/render');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'email-campaign');
const OUT_PDF = path.join(OUT_DIR, 'Freeley_Email_Campaign_Flow.pdf');
const OUT_HTML = path.join(OUT_DIR, 'Freeley_Email_Campaign_Flow.html');
const KEEP_HTML = process.argv.includes('--html');

const C = { green: '#123c2c', brand: '#0f6b45', ink: '#1a1c1a', muted: '#63665f', line: '#e5ded0', card: '#efe9dd', paper: '#fbf9f4' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\{\{(\w+)\}\}/g, '<span class="tok">{{$1}}</span>')
  .replace(/\[([A-Z][^\]]{6,})\]/g, '<span class="flag">[$1]</span>');

const THUMB_DIR = path.join(OUT_DIR, '.thumbs');
const thumbCache = new Map();

/** Pre-shrinks a public/ asset to a 640px-wide JPEG so the PDF stays small. */
async function thumb(rel) {
  if (!rel) return '';
  if (thumbCache.has(rel)) return thumbCache.get(rel);
  const abs = path.join(ROOT, 'public', rel);
  if (!fs.existsSync(abs)) { console.warn(`[campaign-pdf] missing image: public/${rel}`); thumbCache.set(rel, ''); return ''; }
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const out = path.join(THUMB_DIR, rel.replace(/[\\/]/g, '__').replace(/\.[a-z]+$/i, '') + '.jpg');
  try {
    await sharp(abs).flatten({ background: '#efe9dd' }).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(out);
  } catch (err) {
    console.warn(`[campaign-pdf] could not resize public/${rel}: ${err.message}`);
    thumbCache.set(rel, ''); return '';
  }
  const url = 'file:///' + out.replace(/\\/g, '/').replace(/ /g, '%20');
  thumbCache.set(rel, url);
  return url;
}
const fileUrl = (rel) => thumbCache.get(rel) || '';

async function prepareImages() {
  const all = ['assets/brand/freeley_logo_email.png'];
  for (const e of EMAILS) for (const v of (e.variants || [e])) if (v.image?.src) all.push(v.image.src);
  await Promise.all(all.map(thumb));
}

/**
 * Renders every email with the real brand shell and screenshots it at a
 * phone width and a desktop width (images load live from freeley.com), so
 * each email's page in the PDF shows what actually lands in the inbox.
 * @returns {Map<string, {desktop: string, mobile: string}>} rendered id → file URLs
 */
const VIEWPORTS = { desktop: { width: 1100, height: 900 }, mobile: { width: 390, height: 844 } };
async function capturePreviews(browser) {
  const previews = new Map();
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const rendered = renderAll();
  for (const r of rendered) {
    const htmlPath = path.join(THUMB_DIR, `email-${r.id}.html`);
    fs.writeFileSync(htmlPath, r.html);
    const entry = {};
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1.5 });
      try {
        await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 45000 });
      } catch (err) {
        console.warn(`[campaign-pdf] ${r.id}/${name}: ${err.message.split('\n')[0]} — capturing anyway`);
      }
      const png = path.join(THUMB_DIR, `preview-${r.id}-${name}.png`);
      const jpg = png.replace(/\.png$/, '.jpg');
      await page.screenshot({ path: png, fullPage: true });
      await page.close();
      await sharp(png).jpeg({ quality: 80 }).toFile(jpg);
      fs.unlinkSync(png);
      entry[name] = 'file:///' + jpg.replace(/\\/g, '/');
    }
    previews.set(r.id, entry);
    process.stdout.write(`\r[campaign-pdf] previews ${previews.size}/${rendered.length}   `);
  }
  process.stdout.write('\n');
  return previews;
}
let PREVIEWS = new Map();
const previewId = (e, v) => v ? `${e.id}-${v.vertical.toLowerCase().replace(/\s+/g, '-')}` : e.id;

function renderPreview(e, v) {
  const shots = PREVIEWS.get(previewId(e, v));
  if (!shots) return '';
  const label = `${e.id}${v ? ' · ' + esc(v.vertical) : ''}`;
  return `
    <section class="preview">
      <div class="preview-head"><span class="pid">${label}</span> How it renders — <strong>${esc((v || e).subject)}</strong></div>
      <div class="shots">
        <figure class="shot desktop"><img src="${shots.desktop}" alt=""><figcaption>Desktop · Gmail/Outlook at 1100px</figcaption></figure>
        <figure class="shot mobile"><img src="${shots.mobile}" alt=""><figcaption>Mobile · iPhone width (390px)</figcaption></figure>
      </div>
    </section>`;
}

function renderBody(lines) {
  let html = '', inList = false;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function renderCopy(e) {
  return `
    <div class="copy">
      <div class="meta-line"><span class="k">Subject</span><span class="v subj">${inline(e.subject)}</span></div>
      <div class="meta-line"><span class="k">Preheader</span><span class="v">${inline(e.preheader)}</span></div>
      <div class="email-body">
        <h3>${inline(e.headline)}</h3>
        ${renderBody(e.body)}
        <div class="cta"><span class="btn">${esc(e.cta.label)}</span><span class="cta-url">${esc(e.cta.url.replace(SITE, 'freeley.com'))}</span></div>
        ${e.ps ? `<p class="ps"><strong>P.S.</strong> ${inline(e.ps)}</p>` : ''}
      </div>
    </div>`;
}

function renderImage(img, alts, label) {
  const url = fileUrl(img?.src);
  const altList = (alts || []).filter(Boolean);
  return `
    <div class="visual">
      <div class="visual-label">${label}</div>
      ${url ? `<div class="thumb"><img src="${url}" alt=""></div><div class="path">public/${esc(img.src)}</div>` : '<div class="thumb none">No image — text-only email</div>'}
      ${img?.why ? `<div class="why">${esc(img.why)}</div>` : ''}
      ${altList.length ? `<div class="alts"><span>Also usable:</span> ${altList.map((a) => `<code>${esc(a.replace(/^assets\//, ''))}</code>`).join(' ')}</div>` : ''}
    </div>`;
}

function renderEmail(e, track) {
  const variants = e.variants || null;
  const head = `
    <div class="email-head" style="border-color:${track.color}">
      <div class="id" style="background:${track.color}">${e.id}</div>
      <div class="title">
        <h2>${esc(e.name)}</h2>
        <div class="sub">Day ${e.day}${/^day \d+$/i.test(e.send) ? '' : ' · ' + esc(e.send)}</div>
      </div>
    </div>
    <table class="facts">
      <tr><th>Goal</th><td>${esc(e.goal)}</td></tr>
      <tr><th>Audience</th><td>${inline(e.segment)}</td></tr>
      <tr><th>Layout</th><td>${esc(e.layout)}</td></tr>
      ${e.notes ? `<tr><th>Note</th><td class="note">${inline(e.notes)}</td></tr>` : ''}
    </table>`;

  if (!variants) {
    return `<section class="email">${head}<div class="two-col">${renderCopy(e)}${renderImage(e.image, e.alt, 'Suggested visual')}</div></section>${renderPreview(e, null)}`;
  }
  return `<section class="email">${head}
    <p class="variant-intro">Four versions. The lead sees the one matching their quiz answer.</p>
    ${variants.map((v) => `
      <div class="variant">
        <div class="variant-tag" style="background:${track.color}">${esc(v.vertical)}</div>
        <div class="two-col">${renderCopy(v)}${renderImage(v.image, v.alt, 'Suggested visual')}</div>
      </div>`).join('')}
  </section>${variants.map((v) => renderPreview(e, v)).join('')}`;
}

function renderTimeline() {
  const byTrack = TRACKS.map((t) => ({ t, list: EMAILS.filter((e) => e.track === t.id) }));
  return byTrack.map(({ t, list }) => `
    <div class="tl-track">
      <div class="tl-name" style="color:${t.color}">Track ${t.id} — ${esc(t.name)}</div>
      <div class="tl-row">
        ${list.map((e) => `<div class="tl-item"><div class="tl-dot" style="background:${t.color}"></div><div class="tl-id">${e.id}</div><div class="tl-day">D${e.day}</div><div class="tl-title">${esc(e.name)}</div></div>`).join('')}
      </div>
    </div>`).join('');
}

function renderIndex() {
  return `<table class="index">
    <thead><tr><th>#</th><th>Day</th><th>Email</th><th>Subject line</th><th>CTA</th></tr></thead>
    <tbody>${EMAILS.map((e) => `<tr>
      <td class="mono">${e.id}</td><td class="mono">${e.day}</td><td>${esc(e.name)}${e.variants ? ' <em>(×4 verticals)</em>' : ''}</td>
      <td>${esc(e.variants ? e.variants.map((v) => v.subject).join(' / ') : e.subject)}</td>
      <td>${esc(e.variants ? 'Vertical page' : e.cta.label)}</td></tr>`).join('')}</tbody>
  </table>`;
}

function buildHtml() {
  const total = EMAILS.length;
  const variantCount = EMAILS.reduce((n, e) => n + (e.variants ? e.variants.length - 1 : 0), 0);
  const logo = fileUrl('assets/brand/freeley_logo_email.png');
  const today = new Date().toISOString().slice(0, 10);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Freeley — Email Campaign Flow</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: ${C.ink}; font-size: 10.5pt; line-height: 1.5; background: #fff; }
  h1, h2, h3, .serif { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.01em; }
  a { color: ${C.brand}; text-decoration: none; }
  code { font-family: Consolas, Menlo, monospace; font-size: 8.5pt; background: ${C.card}; padding: 1px 4px; border-radius: 3px; }
  .mono { font-family: Consolas, Menlo, monospace; font-size: 9pt; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  /* Cover */
  .cover { height: 258mm; display: flex; flex-direction: column; justify-content: space-between; background: ${C.green}; color: #fff; padding: 22mm 18mm; border-radius: 6mm; }
  .cover img { width: 46mm; }
  .cover h1 { font-size: 34pt; line-height: 1.1; margin: 0 0 6mm; color: #fff; }
  .cover .lede { font-size: 13pt; max-width: 130mm; opacity: .9; }
  .cover .stats { display: flex; gap: 8mm; margin-top: 12mm; }
  .cover .stat { border-left: 2px solid rgba(255,255,255,.35); padding-left: 4mm; }
  .cover .stat b { display: block; font-size: 24pt; font-family: Georgia, serif; line-height: 1; }
  .cover .stat span { font-size: 9.5pt; opacity: .8; }
  .cover .foot { font-size: 9pt; opacity: .7; }

  /* Sections */
  .h-section { font-size: 22pt; margin: 0 0 3mm; color: ${C.green}; }
  .lead { font-size: 11.5pt; color: ${C.muted}; margin: 0 0 6mm; max-width: 160mm; }
  .track-card { border: 1px solid ${C.line}; border-radius: 4mm; padding: 5mm 6mm; margin-bottom: 5mm; background: ${C.paper}; page-break-inside: avoid; }
  .track-card h2 { margin: 0 0 1.5mm; font-size: 15pt; }
  .track-card .intro { margin: 0 0 3mm; }
  .track-card table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .track-card th { text-align: left; width: 22mm; color: ${C.muted}; font-weight: 600; vertical-align: top; padding: 1mm 2mm 1mm 0; }
  .track-card td { padding: 1mm 0; vertical-align: top; }

  .tl-track { margin-bottom: 6mm; }
  .tl-name { font-weight: 700; font-size: 10pt; margin-bottom: 2mm; }
  .tl-row { display: flex; flex-wrap: wrap; gap: 2mm; }
  .tl-item { width: 30mm; border: 1px solid ${C.line}; border-radius: 2.5mm; padding: 2mm 2.5mm; font-size: 8pt; position: relative; background: #fff; }
  .tl-dot { width: 2.2mm; height: 2.2mm; border-radius: 50%; position: absolute; top: 2.5mm; right: 2.5mm; }
  .tl-id { font-family: Consolas, monospace; font-weight: 700; }
  .tl-day { color: ${C.muted}; font-size: 7.5pt; }
  .tl-title { line-height: 1.25; margin-top: .5mm; }

  table.index { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
  table.index th { text-align: left; background: ${C.card}; padding: 1.6mm 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: ${C.green}; }
  table.index td { padding: 1.4mm 2mm; border-bottom: 1px solid ${C.line}; vertical-align: top; }
  table.index em { color: ${C.muted}; font-style: normal; font-size: 8pt; }

  /* Email card */
  .email { page-break-before: always; }
  .email-head { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid; padding-bottom: 3mm; margin-bottom: 3mm; }
  .email-head .id { color: #fff; font-family: Consolas, monospace; font-weight: 700; font-size: 13pt; padding: 2mm 3mm; border-radius: 2.5mm; }
  .email-head h2 { margin: 0; font-size: 17pt; line-height: 1.15; }
  .email-head .sub { color: ${C.muted}; font-size: 9.5pt; }
  table.facts { width: 100%; border-collapse: collapse; font-size: 9.2pt; margin-bottom: 4mm; }
  table.facts th { text-align: left; width: 20mm; color: ${C.muted}; font-weight: 600; padding: .8mm 2mm .8mm 0; vertical-align: top; }
  table.facts td { padding: .8mm 0; vertical-align: top; }
  table.facts td.note { color: #7a4b00; }
  .two-col { display: grid; grid-template-columns: 1fr 58mm; gap: 6mm; align-items: start; }
  .copy .meta-line { display: flex; gap: 3mm; font-size: 9.5pt; padding: 1.2mm 0; border-bottom: 1px dashed ${C.line}; }
  .copy .k { color: ${C.muted}; width: 20mm; flex: none; font-weight: 600; }
  .copy .subj { font-weight: 700; }
  .email-body { background: ${C.paper}; border: 1px solid ${C.line}; border-radius: 3.5mm; padding: 5mm 6mm; margin-top: 3mm; }
  .email-body h3 { font-size: 15.5pt; margin: 0 0 3mm; line-height: 1.2; color: ${C.ink}; }
  .email-body p { margin: 0 0 2.6mm; }
  .email-body ul { margin: 0 0 2.6mm; padding-left: 5mm; }
  .email-body li { margin-bottom: 1.2mm; }
  .email-body .ps { color: ${C.muted}; font-size: 9.5pt; margin-top: 3mm; }
  .cta { margin: 4mm 0 1mm; display: flex; align-items: center; gap: 3mm; flex-wrap: wrap; }
  .btn { display: inline-block; background: ${C.green}; color: #fff; border-radius: 999px; padding: 2.4mm 6mm; font-weight: 600; font-size: 10pt; }
  .cta-url { font-family: Consolas, monospace; font-size: 8pt; color: ${C.muted}; }
  .tok { font-family: Consolas, monospace; font-size: 9pt; color: ${C.brand}; background: #e7f1ec; padding: 0 3px; border-radius: 3px; }
  .flag { background: #fff3d6; color: #7a4b00; padding: 0 3px; border-radius: 3px; font-size: 9.5pt; }
  .visual { font-size: 8.8pt; }
  .visual-label { text-transform: uppercase; letter-spacing: .06em; font-size: 7.5pt; color: ${C.muted}; font-weight: 700; margin-bottom: 1.5mm; }
  .thumb { border: 1px solid ${C.line}; border-radius: 3mm; overflow: hidden; background: ${C.card}; display: flex; align-items: center; justify-content: center; min-height: 30mm; max-height: 62mm; }
  .thumb img { max-width: 100%; max-height: 62mm; object-fit: contain; display: block; }
  .thumb.none { color: ${C.muted}; font-style: italic; padding: 8mm; text-align: center; }
  .path { font-family: Consolas, monospace; font-size: 7.5pt; color: ${C.muted}; margin: 1.5mm 0; word-break: break-all; }
  .why { color: ${C.ink}; }
  .alts { margin-top: 2mm; color: ${C.muted}; line-height: 1.9; } .alts code { word-break: break-all; }
  .alts span { font-weight: 600; }
  .variant { page-break-inside: avoid; margin-top: 4mm; padding-top: 3mm; border-top: 1px solid ${C.line}; }
  .variant-tag { display: inline-block; color: #fff; font-size: 8.5pt; font-weight: 700; padding: 1mm 3mm; border-radius: 999px; margin-bottom: 2mm; }
  .variant-intro { color: ${C.muted}; margin: 0; }

  /* Rendered previews */
  .preview { page-break-before: always; }
  .preview-head { font-size: 10pt; color: ${C.muted}; margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1px solid ${C.line}; }
  .preview-head .pid { font-family: Consolas, monospace; font-weight: 700; color: ${C.green}; margin-right: 2mm; }
  .preview-head strong { color: ${C.ink}; font-weight: 600; }
  .shots { display: grid; grid-template-columns: 1fr 52mm; gap: 6mm; align-items: start; }
  .shot { margin: 0; }
  .shot img { display: block; width: 100%; max-height: 238mm; object-fit: contain; object-position: top; border: 1px solid ${C.line}; border-radius: 2mm; background: ${C.card}; }
  .shot.mobile img { border-radius: 5mm; border-width: 2px; }
  .shot figcaption { font-size: 8pt; color: ${C.muted}; margin-top: 1.5mm; text-align: center; }

  .rule { page-break-inside: avoid; margin-bottom: 4mm; }
  .rule h3 { margin: 0 0 1mm; font-size: 12.5pt; }
  .rule p { margin: 0; }
  ol.q { padding-left: 5mm; } ol.q li { margin-bottom: 2mm; }
</style></head><body>

<div class="page"><div class="cover">
  <div>${logo ? `<img src="${logo}" alt="Freeley">` : '<div class="serif" style="font-size:22pt">Freeley</div>'}</div>
  <div>
    <h1>Email Campaign Flow</h1>
    <div class="lede">A ${total}-email, three-track lifecycle: nurture leads with a newsletter-style education sequence, onboard and retain patients, and re-engage the ones who went quiet. Copy is final-draft quality and independent of design; every email lists the site asset it would use.</div>
    <div class="stats">
      <div class="stat"><b>${total}</b><span>emails (+${variantCount} vertical variants)</span></div>
      <div class="stat"><b>3</b><span>tracks: lead · patient · re-engage</span></div>
      <div class="stat"><b>90</b><span>days of coverage per contact</span></div>
    </div>
  </div>
  <div class="foot">Proposal v1 · ${today} · Draft for review — everything here is subject to change.</div>
</div></div>

<div class="page">
  <h1 class="h-section">How the flow is organised</h1>
  <p class="lead">Three tracks, one contact at a time. A person is only ever in one track; purchases and cancellations move them automatically. Transactional emails (order confirmed, shipped, clinician messages, receipts) run separately and are not counted here.</p>
  ${TRACKS.map((t) => `
    <div class="track-card" style="border-left:4px solid ${t.color}">
      <h2 style="color:${t.color}">Track ${t.id} — ${esc(t.name)}</h2>
      <p class="intro">${esc(t.intro)}</p>
      <table>
        <tr><th>Audience</th><td>${esc(t.audience)}</td></tr>
        <tr><th>Cadence</th><td>${esc(t.cadence)}</td></tr>
        <tr><th>Enters when</th><td>${esc(t.entry)}</td></tr>
        <tr><th>Leaves when</th><td>${esc(t.exit)}</td></tr>
      </table>
    </div>`).join('')}
</div>

<div class="page">
  <h1 class="h-section">Timeline at a glance</h1>
  <p class="lead">Day numbers count from the moment the contact enters the track (email captured, or purchase).</p>
  ${renderTimeline()}
</div>

<div class="page">
  <h1 class="h-section">All ${total} emails</h1>
  ${renderIndex()}
</div>

${EMAILS.map((e) => renderEmail(e, TRACKS.find((t) => t.id === e.track))).join('')}

<div class="page" style="page-break-before:always">
  <h1 class="h-section">Rules that apply to every email</h1>
  ${RULES.map((r) => `<div class="rule"><h3>${esc(r.title)}</h3><p>${inline(r.body)}</p></div>`).join('')}
</div>

<div class="page" style="page-break-before:always">
  <h1 class="h-section">What we need from you</h1>
  <p class="lead">Seven decisions. Everything else is ready to build once these are answered.</p>
  <ol class="q">${OPEN_QUESTIONS.map((q) => `<li>${inline(q)}</li>`).join('')}</ol>
</div>

</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await prepareImages();
  const browser = await chromium.launch();
  PREVIEWS = await capturePreviews(browser);
  const html = buildHtml();
  fs.writeFileSync(OUT_HTML, html);
  const page = await browser.newPage();
  await page.goto('file:///' + OUT_HTML.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all(Array.from(document.images).map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  await page.pdf({
    path: OUT_PDF, format: 'A4', printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%; font-size:7.5pt; color:#63665f; padding:0 14mm; display:flex; justify-content:space-between; font-family:Helvetica,Arial,sans-serif;"><span>Freeley — Email Campaign Flow · draft for review</span><span class="pageNumber"></span></div>`
  });
  await browser.close();
  if (!KEEP_HTML) fs.unlinkSync(OUT_HTML);
  if (!KEEP_HTML) fs.rmSync(THUMB_DIR, { recursive: true, force: true });
  const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
  console.log(`[campaign-pdf] wrote ${path.relative(ROOT, OUT_PDF)} (${kb} KB, ${EMAILS.length} emails)`);
})().catch((err) => { console.error(err); process.exit(1); });
