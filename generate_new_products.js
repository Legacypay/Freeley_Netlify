const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Please set OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'brand');
const IMAGE_SIZE = '1024x1024';
const IMAGE_QUALITY = 'standard';

const BRAND_STYLE = `Hyperrealistic photograph, completely indistinguishable from a real photo. Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. Soft, natural available lighting, warm neutral tones. True-to-life textures, subtle lens flare. Magazine editorial quality, Kinfolk / Cereal lifestyle magazine aesthetic. NO AI-look, NO garbled logos. The text "Freeley" must be spelled perfectly.`;

const TASKS = [
  {
    name: 'vitalpeptide_topical.png',
    prompt: `An elegant, pristine professional pharmaceutical macro product shot of a premium frosted glass dropper bottle for a hair loss topical solution. The sleek, minimalist label perfectly reads 'Freeley'. Set on a spotless, bright white clinical marble surface with a subtle, soft reflection. No lifestyle elements, pure pharmaceutical product photography. ${BRAND_STYLE}`
  },
  {
    name: 'olympus_vial.png',
    prompt: `A beautiful, hyperrealistic professional pharmaceutical macro product shot of a small, clear glass subcutaneous injection vial with a silver crimp top and an orange flip-off cap, typical of NAD+ therapies. Next to the vial rests a pristine, sterile medical insulin syringe. The label on the vial is sleek, minimalist, and perfectly reads 'Freeley'. Set on a spotless, bright white clinical surface with a soft reflection. ${BRAND_STYLE}`
  },
  {
    name: 'vast_tablet.png',
    prompt: `A highly professional, elegant pharmaceutical product shot of a sleek minimalist branded prescription bottle with small medical tablets resting next to it. The sleek, clinical label perfectly reads 'Freeley'. Soft glowing studio lighting, set on a stark modern white minimal background. ${BRAND_STYLE}`
  }
];

async function generateImage(task) {
  console.log(`\n📸 Generating: ${task.name}...`);
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: task.prompt,
        n: 1,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to generate ${task.name}: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    const imageUrl = data.data[0].url;
    
    console.log(`⬇️ Downloading ${task.name}...`);
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    
    const outputPath = path.join(IMAGES_DIR, task.name);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`✅ Saved ${task.name} to ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error processing ${task.name}:\n`, error);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  for (const task of TASKS) {
    await generateImage(task);
  }
  
  console.log('\n✅ All requested product images have been generated via DALL-E 3!');
}

main();
