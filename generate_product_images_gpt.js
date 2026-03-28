const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Please run with: OPENAI_API_KEY=sk-xxx node generate_product_images_gpt.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'brand');

const BRAND_STYLE = `Hyperrealistic photograph, completely indistinguishable from a real photo. Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. Soft, natural available lighting, warm neutral tones. True-to-life textures, subtle lens flare. Magazine editorial quality, Kinfolk / Cereal lifestyle magazine aesthetic. NO AI-look, NO garbled logos.`;

const TASKS = [
  {
    name: 'freeley_hair_topical.png',
    prompt: `An elegant, pristine professional pharmaceutical macro product shot of a premium frosted glass dropper bottle for a hair loss topical solution. The sleek, minimalist label reads 'Freeley'. Set on a spotless, bright white clinical marble surface with a subtle, soft reflection. No lifestyle elements, pure pharmaceutical product photography. ${BRAND_STYLE}`
  },
  {
    name: 'freeley_longevity_vial.png',
    prompt: `A beautiful, hyperrealistic professional pharmaceutical macro product shot of a small, clear glass subcutaneous injection vial with a silver crimp top and an orange flip-off cap, typical of NAD+ therapies. Next to the vial rests a pristine, sterile medical insulin syringe. The label on the vial is sleek, minimalist, and perfectly reads 'Freeley'. Set on a spotless, bright white clinical surface with a soft reflection. ${BRAND_STYLE}`
  },
  {
    name: 'freeley_ed_troche.png',
    prompt: `A highly professional, elegant pharmaceutical product shot of a sleek minimalist branded prescription tablet resting gracefully. The label nearby and the ambiance scream 'Freeley'. Soft glowing studio lighting, set on a stark modern white minimal background. ${BRAND_STYLE}`
  }
];

async function generateImage(task) {
  console.log(`\n📸 Generating using gpt-1.5: ${task.name}...`);
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1', // Changing to match the regenerate-blog-images script format
        prompt: task.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to generate ${task.name}: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    const imageUrl = data.data[0].url || data.data[0].b64_json;
    
    if (data.data[0].b64_json) {
      console.log(`⬇️ Saving base64 for ${task.name}...`);
      const buffer = Buffer.from(data.data[0].b64_json, 'base64');
      fs.writeFileSync(path.join(IMAGES_DIR, task.name), buffer);
    } else {
      console.log(`⬇️ Downloading ${task.name}...`);
      const imgResponse = await fetch(imageUrl);
      const buffer = await imgResponse.arrayBuffer();
      fs.writeFileSync(path.join(IMAGES_DIR, task.name), Buffer.from(buffer));
    }
    
    console.log(`✅ Saved ${task.name}`);
  } catch (error) {
    console.error(`❌ Error processing ${task.name}:\n`, error);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  for (const task of TASKS) {
    await generateImage(task);
  }
  console.log('\n✅ All requested product images have been processed with gpt-1.5!');
}

main();
