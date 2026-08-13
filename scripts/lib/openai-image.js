/**
 * Shared OpenAI GPT Image call — same interface as ./gemini-image.js
 * (generateImage(prompt, sourceImage, opts) -> Buffer) so it's a drop-in
 * swap for scripts/generate-images.js and scripts/generate-cutout-images.js.
 *
 * Generation: POST /v1/images/generations (JSON body).
 * Editing (sourceImage provided): POST /v1/images/edits (multipart/
 * form-data) — Node's native fetch + FormData + Blob build the multipart
 * body and set the boundary header automatically, no extra dependency.
 *
 * MODEL is pinned to gpt-image-1.5, NOT the newer gpt-image-2 (confirmed
 * 2026-08-12) — gpt-image-2 dropped `background: "transparent"` entirely
 * (only "opaque"/"auto" are valid; a transparent request errors outright),
 * which breaks every cutout-style product shot this file generates. 1.5 is
 * the newest model that still supports it — same request shape as the
 * gpt-image-1 this replaced (background/output_format/size params unchanged),
 * so this was a one-line swap. Re-check before ever bumping past 1.5.
 *
 * opts.transparent: the model defaults to an opaque (usually white) fill
 * even when the source image is a transparent PNG and the prompt asks it to
 * keep the background as-is — real alpha transparency only comes through
 * if you explicitly request it via the `background` param (honored for
 * png/webp output only, hence `output_format` pinned to png alongside it).
 * Opt-in, NOT the default: generate-cutout-images.js deliberately wants an
 * OPAQUE green-screen backdrop to chroma-key against, so it must keep
 * omitting opts — only callers generating cutout-style product/object shots
 * (e.g. generate-images.js manifest entries with `"transparent": true`)
 * should pass opts.transparent.
 *
 * opts.model: per-call override of the pinned MODEL constant above. Only
 * meaningful when opts.transparent is NOT set — full-bleed lifestyle/scene
 * shots with a baked-in background don't hit the gpt-image-2 limitation
 * this file is otherwise pinned against, so a caller generating that kind
 * of image (not a cutout) can opt into the newer model without moving the
 * pin for every other caller.
 */

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=xxx node <script> <manifest.json>');
  process.exit(1);
}

const MODEL = 'gpt-image-1.5';
const MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

async function generateImage(prompt, sourceImage, opts = {}) {
  let response;
  const model = opts.model || MODEL;

  if (sourceImage) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    // opts.size ('1024x1024' etc): without it, edits inherit the source
    // image's aspect — a portrait source makes the model compose portrait,
    // and the caller's square cover-resize then crops the sides off (badges
    // at the frame edge get cut). Square manifests should pass it.
    if (opts.size) form.append('size', opts.size);
    if (opts.transparent) {
      form.append('background', 'transparent');
      form.append('output_format', 'png');
    }
    form.append('image', new Blob([sourceImage.buffer], { type: sourceImage.mimeType }), 'image.png');
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    const body = { model, prompt, size: opts.size || 'auto' };
    if (opts.transparent) {
      body.background = 'transparent';
      body.output_format = 'png';
    }
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error(JSON.stringify(data.error || data || 'No image returned'));
  }

  return Buffer.from(b64, 'base64');
}

module.exports = { generateImage, MIME_TYPES, MODEL };
