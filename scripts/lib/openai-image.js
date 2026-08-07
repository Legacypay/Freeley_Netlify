/**
 * Shared OpenAI gpt-image-1 call — same interface as ./gemini-image.js
 * (generateImage(prompt, sourceImage) -> Buffer) so it's a drop-in swap
 * for scripts/generate-images.js and scripts/generate-cutout-images.js.
 *
 * Generation: POST /v1/images/generations (JSON body).
 * Editing (sourceImage provided): POST /v1/images/edits (multipart/
 * form-data) — Node's native fetch + FormData + Blob build the multipart
 * body and set the boundary header automatically, no extra dependency.
 */

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=xxx node <script> <manifest.json>');
  process.exit(1);
}

const MODEL = 'gpt-image-1';
const MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

async function generateImage(prompt, sourceImage) {
  let response;

  if (sourceImage) {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', prompt);
    form.append('image', new Blob([sourceImage.buffer], { type: sourceImage.mimeType }), 'image.png');
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size: 'auto' }),
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
