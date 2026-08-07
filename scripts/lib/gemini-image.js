/**
 * Shared Gemini 2.5 Flash Image ("nano banana") call, used by both
 * scripts/generate-images.js (flat edits/creates) and
 * scripts/generate-cutout-images.js (transparent chroma-key cutouts).
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY. Run with: GEMINI_API_KEY=xxx node <script> <manifest.json>');
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash-image';
const MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

async function generateImage(prompt, sourceImage) {
  const parts = [{ text: prompt }];
  if (sourceImage) {
    parts.push({ inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.buffer.toString('base64') } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    }
  );

  const data = await response.json();
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    throw new Error(JSON.stringify(data.error || data || 'No image returned'));
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

module.exports = { generateImage, MIME_TYPES, MODEL };
