const fs = require('fs');
const path = require('path');

const apiKey = process.env.RUNWAY_API_KEY;
if (!apiKey) {
  console.error('❌ Missing RUNWAY_API_KEY. Run with: RUNWAY_API_KEY=key_xxx node generate-runway-videos.js');
  process.exit(1);
}

const VIDEOS_DIR = path.join(__dirname, 'assets', 'videos');
const JOBS_FILE = path.join(VIDEOS_DIR, 'runway_jobs.json');

// ─────────────────────────────────────────────────────────
// HYPERREALISTIC PROMPT ENGINEERING for RUNWAY GEN-3
// Gen-3 Alpha is very sensitive to precise camera motion 
// and photorealistic terms.
// ─────────────────────────────────────────────────────────

const RUNWAY_STYLE = `Hyperrealistic 4k video, cinematic shot, ARRI ALEXA Mini LF, Cooke S7/i 65mm lens. Natural soft lighting, highly detailed skin textures, accurate reflections. Photorealistic, indistinguishable from reality. Smooth slow camera motion. No morphing, no artifacts.`;

const SCENES = {
  // ── HERO SECTIONS ──
  'hero-weight-loss': {
    filename: 'hero-weight-loss.mp4',
    prompt: `Slow cinematic tracking shot. A healthy, toned woman in her 30s walking through a sunlit modern kitchen, drinking taking a sip from a glass of water, smiling naturally. Warm morning sunlight, soft shadows. ${RUNWAY_STYLE}`,
    category: 'hero'
  },
  'hero-hair-loss': {
    filename: 'hero-hair-loss.mp4',
    prompt: `Close-up cinematic shot. A confident man in his 30s running his hand through thick, healthy dark hair while looking in a bathroom mirror. Minimalist bathroom, soft warm lighting. ${RUNWAY_STYLE}`,
    category: 'hero'
  },
  'hero-sexual-wellness': {
    filename: 'hero-sexual-wellness.mp4',
    prompt: `Medium shot. A real couple in their late 30s sitting close together on a modern sofa, laughing genuinely. Warm afternoon lighting from window. Authentic natural chemistry. ${RUNWAY_STYLE}`,
    category: 'hero'
  },
  'hero-longevity': {
    filename: 'hero-longevity.mp4',
    prompt: `Wide cinematic shot. An athletic man in his 50s doing stretching on a rooftop terrace at dawn. Golden sunrise light catching his face. Smooth vertical crane shot up. ${RUNWAY_STYLE}`,
    category: 'hero'
  },
  
  // ── PRODUCT REVEALS ──
  'product-semaglutide': {
    filename: 'product-semaglutide.mp4',
    prompt: `Ultra close-up macro shot. A medical glass injection vial on a white marble surface. A single drop of clear liquid catches the studio lighting. Shallow depth of field. Slow camera drift right. ${RUNWAY_STYLE}`,
    category: 'product'
  },
  'product-hair-treatment': {
    filename: 'product-hair-treatment.mp4',
    prompt: `Cinematic macro shot. A premium amber dropper bottle on a matte black surface. A golden drop falls from the glass dropper in slow motion. Soft warm back-light. ${RUNWAY_STYLE}`,
    category: 'product'
  }
};

// ─────────────────────────────────────────────────────────
// RUNWAY API INTERFACE
// ─────────────────────────────────────────────────────────

async function createVideoTask(scene) {
  console.log(`\n🎬 Creating Runway Gen-3 task: ${scene.filename}`);

  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-09-13'
    },
    body: JSON.stringify({
      promptText: scene.prompt,
      model: 'gen3a_turbo', 
      promptImage: null, 
      watermark: false,
      duration: 5,
      ratio: "16:9"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data; // Returns { id: 'task_xxx' }
}

async function checkTaskStatus(taskId) {
  const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-09-13'
    }
  });
  return response.json(); // { id, status, createdAt, output: [url] }
}

async function downloadVideo(url, filename) {
  const filepath = path.join(VIDEOS_DIR, filename);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Downloaded: assets/videos/${filename} (${sizeMB} MB)`);
  return filepath;
}

// ... basic polling logic ...
async function pollUntilComplete(taskId, maxWaitMinutes = 15) {
  const startTime = Date.now();
  const maxWait = maxWaitMinutes * 60 * 1000;
  let lastStatus = '';

  while (Date.now() - startTime < maxWait) {
    const task = await checkTaskStatus(taskId);
    if (task.status !== lastStatus) {
      console.log(`   📡 Status: ${task.status}`);
      lastStatus = task.status;
    }

    if (task.status === 'SUCCEEDED') {
      return task;
    }

    if (task.status === 'FAILED') {
      throw new Error(`Task failed: ${JSON.stringify(task.failure || 'Unknown error')}`);
    }

    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`Timed out after ${maxWaitMinutes} minutes`);
}

async function run() {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const targetScene = args.find(a => a.startsWith('--scene='))?.split('=')[1];
  const generateAll = args.includes('--all');

  let scenesToGenerate = [];
  if (generateAll) {
    scenesToGenerate = Object.entries(SCENES);
  } else if (targetScene && SCENES[targetScene]) {
    scenesToGenerate = [[targetScene, SCENES[targetScene]]];
  } else {
    console.log('🎬 Runway Video Generator');
    console.log('Usage: RUNWAY_API_KEY=key_xxx node generate-runway-videos.js --scene=hero-weight-loss');
    console.log('       RUNWAY_API_KEY=key_xxx node generate-runway-videos.js --all');
    return;
  }

  for (const [name, scene] of scenesToGenerate) {
    try {
      const task = await createVideoTask(scene);
      console.log(`   🆔 Task ID: ${task.id}`);
      console.log('   ⏳ Waiting for generation (typically 1-3 minutes)...');
      
      const result = await pollUntilComplete(task.id);
      
      if (result.status === 'SUCCEEDED' && result.output && result.output.length > 0) {
        await downloadVideo(result.output[0], scene.filename);
      }
    } catch (err) {
      console.error(`   ❌ Failed:`, err.message);
    }
  }
  console.log('\\n🎉 Done! Videos saved to assets/videos/');
}

run();
