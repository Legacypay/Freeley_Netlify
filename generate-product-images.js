const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Please run with: OPENAI_API_KEY=sk-xxx node generate-product-images.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'brand');
const IMAGE_SIZE = '1024x1024';
const IMAGE_QUALITY = 'standard';

const BRAND_STYLE = `Hyperrealistic photograph, completely indistinguishable from a real photo. Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. Soft, natural available lighting, warm neutral tones. True-to-life textures, subtle lens flare, film grain at ISO 400. Magazine editorial quality, Kinfolk / Cereal lifestyle magazine aesthetic. NO AI-look, NO text or lettering, NO garbled logos.`;

const TASKS = [
  {
    name: 'ed_fireworks.png',
    prompt: `An elegant, moody conceptual photograph of a discreet, luxury medical sublingual troche medication dissolving and magically transforming into very subtle, elegant, low-light celebratory fireworks/sparks falling quietly in the background. ${BRAND_STYLE}`
  },
  {
    name: 'ed_brain.png',
    prompt: `A beautiful and conceptual hyperrealistic photograph of a subtly glowing human brain rendered as soft, elegant neural pathways with warm golden light, symbolizing that 'great sex starts with the brain'. Moody atmosphere. ${BRAND_STYLE}`
  },
  {
    name: 'loving_couple.png',
    prompt: `An attractive, happy, authentic couple in their 30s or 40s intimately and lovingly embracing each other in a cozy, softly lit bedroom. Genuine emotion, candid moment. Natural window light. ${BRAND_STYLE}`
  },
  {
    name: 'hair_loss_kit.png',
    prompt: `A small, elegant monthly kit package for hair loss treatment, featuring a sleek, minimalist amber glass dropper bottle and a few soft gel capsules resting softly on a luxurious dark marble surface. Clean, premium telehealth branding. ${BRAND_STYLE}`
  },
  {
    name: 'weight_loss_kit.png',
    prompt: `A modern, minimal, high-end glass medical injection pen and a small amber compounding vial on a clean, soft white ceramic surface. Premium telehealth weight loss branding. Medical but highly aesthetic. ${BRAND_STYLE}`
  },
  {
    name: 'longevity_kit.png',
    prompt: `Sleek amber glass peptide vials and a modern wellness supplement bottle arranged on a dark slate background. Premium, science-backed longevity and anti-aging branding. Deep, rich, moody lighting. ${BRAND_STYLE}`
  }
];

async function generateImage(task) {
  console.log(`\\n📸 Generating: ${task.name}...`);
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
    console.error(`❌ Error processing ${task.name}:\\n`, error);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  for (const task of TASKS) {
    await generateImage(task);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\\n✅ All product/hero images have been generated!');
}

main();
