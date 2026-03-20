/**
 * Generate professional physician headshot images via DALL-E 3.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node generate-physician-images.js
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=sk-xxx node generate-physician-images.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'physicians');
const IMAGE_SIZE = '1024x1024';
const IMAGE_QUALITY = 'hd';

const BRAND_STYLE = `Professional headshot portrait photography. 
Clean, warm studio lighting with soft shadows. 
Neutral cream/beige background with subtle gradient. 
Sharp focus on face, shallow depth of field. 
Premium corporate portrait style like McKinsey or Mayo Clinic website.
No text, no logos, no watermarks. Photorealistic.`;

const PHYSICIANS = [
  {
    filename: 'dr-martinez.jpg',
    prompt: `Professional headshot portrait of a Latina female physician in her mid-40s. 
She has warm brown skin, dark hair pulled back neatly, and a confident, approachable smile. 
Wearing a pristine white lab coat over a sage green silk blouse, with a stethoscope draped around her neck. 
${BRAND_STYLE}`
  },
  {
    filename: 'dr-chen.jpg',
    prompt: `Professional headshot portrait of an Asian-American male physician in his late 30s. 
He has a clean-shaven face, modern professional appearance, with short dark hair neatly styled. 
Wearing a navy blue suit jacket over a crisp white dress shirt with no tie, open collar. 
Warm, trustworthy expression with a subtle confident smile. 
${BRAND_STYLE}`
  }
];

async function generateImage(physician) {
  console.log(`\n🎨 Generating: ${physician.filename}...`);
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: physician.prompt,
      n: 1,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      response_format: 'b64_json'
    })
  });

  const data = await response.json();

  if (!data.data || !data.data[0] || !data.data[0].b64_json) {
    throw new Error(JSON.stringify(data.error || 'Unknown DALL-E error'));
  }

  const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
  const filepath = path.join(IMAGES_DIR, physician.filename);

  fs.writeFileSync(filepath, imageBuffer);

  const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Saved: assets/physicians/${physician.filename} (${sizeMB} MB)`);
  return filepath;
}

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log(`\n👨‍⚕️ Generating ${PHYSICIANS.length} physician headshots via DALL-E 3 (HD quality)`);
  console.log(`   Estimated cost: ~$${(PHYSICIANS.length * 0.08).toFixed(2)}\n`);
  console.log('─'.repeat(60));

  let success = 0;

  for (let i = 0; i < PHYSICIANS.length; i++) {
    if (i > 0) {
      console.log('   ⏳ Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));
    }
    
    try {
      await generateImage(PHYSICIANS[i]);
      success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! ${success}/${PHYSICIANS.length} images generated.`);
  console.log(`\nImages saved to: assets/physicians/`);
  console.log(`\nThe physicians page will automatically show these images.`);
  console.log(`Run: git add -A && git commit -m "add physician headshots" && git push`);
}

run();
