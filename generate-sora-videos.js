/**
 * Sora Video Generation Pipeline for Freeley
 * 
 * Generates hyperrealistic video clips for website hero sections, 
 * product reveals, social media, and promo landing pages.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node generate-sora-videos.js
 * 
 * Options:
 *   --scene=<name>     Generate a specific scene (e.g. --scene=hero-weight-loss)
 *   --all              Generate all scenes
 *   --list             List available scenes
 *   --status=<id>      Check status of a generation job
 *   --resolution=720   Set resolution (720 or 1080, default: 720)
 *   --duration=5       Set duration in seconds (5-20, default: 10)
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=sk-xxx node generate-sora-videos.js');
  process.exit(1);
}

const VIDEOS_DIR = path.join(__dirname, 'assets', 'videos');
const JOBS_FILE = path.join(VIDEOS_DIR, 'jobs.json');

// ─────────────────────────────────────────────────────────
// HYPERREALISTIC PROMPT ENGINEERING
// All prompts are engineered for maximum photorealism.
// The style directive is appended to every scene prompt.
// ─────────────────────────────────────────────────────────

const HYPERREAL_STYLE = `Shot on ARRI ALEXA Mini LF with Cooke S7/i Full Frame Plus 65mm lens. 
Natural available light with subtle fill. Shallow depth of field, f/1.4 bokeh. 
True-to-life skin textures with visible pores, fine lines, and natural micro-imperfections. 
No artificial smoothing, no airbrushing, no uncanny valley effects.
Color graded in DaVinci Resolve with a clean, modern LUT — warm highlights, neutral midtones, slightly cool shadows. 
Subtle film grain at ISO 800. Natural motion blur. 
This must look like it was captured by a professional cinematographer on set, 
completely indistinguishable from real 4K footage.`;

const SCENES = {
  // ── HERO SECTIONS ──
  'hero-weight-loss': {
    filename: 'hero-weight-loss.mp4',
    prompt: `Slow cinematic tracking shot of a real woman in her mid-30s with a healthy, toned physique, 
walking through a sunlit modern kitchen. She picks up a glass of water from a marble countertop 
and takes a sip, smiling naturally. She wears a fitted sage green top and black joggers. 
Warm morning sunlight streams through floor-to-ceiling windows, casting soft shadows. 
Camera slowly dollies left to right at waist height. ${HYPERREAL_STYLE}`,
    category: 'hero',
    page: 'weight-loss'
  },

  'hero-hair-loss': {
    filename: 'hero-hair-loss.mp4',
    prompt: `Close-up cinematic shot of a confident man in his early 30s running his hand through thick, 
healthy dark hair while looking in a bathroom mirror. Modern minimalist bathroom with matte black fixtures, 
white marble vanity, and soft warm overhead lighting. Camera slowly pushes in from medium to close-up. 
His expression is calm and self-assured. Visible skin texture, natural stubble on jawline, 
real hair movement with individual strands catching the light. ${HYPERREAL_STYLE}`,
    category: 'hero',
    page: 'hair-loss'
  },

  'hero-sexual-wellness': {
    filename: 'hero-sexual-wellness.mp4',
    prompt: `Intimate cinematic shot of a real couple in their late 30s sitting close together on a modern linen sofa. 
The man has his arm around the woman, and they share a genuine, warm laugh. 
Lifestyle setting: modern living room with floor-to-ceiling windows, late afternoon golden hour light. 
Shot at eye level with a slight rack focus from the couple to foreground flowers and back. 
Natural body language, authentic chemistry. No posing. ${HYPERREAL_STYLE}`,
    category: 'hero',
    page: 'sexual-wellness'
  },

  'hero-longevity': {
    filename: 'hero-longevity.mp4',
    prompt: `Wide cinematic shot of an athletic man in his 50s doing a focused stretching routine 
on a rooftop terrace at dawn. City skyline in the soft background. He wears a fitted charcoal moisture-wicking shirt. 
Golden sunrise light catches his face. Camera slowly cranes up from ground level. 
Visible sweat droplets on skin, natural breathing, real muscle definition. 
Birds in the distant sky. Peaceful, powerful energy. ${HYPERREAL_STYLE}`,
    category: 'hero',
    page: 'longevity'
  },

  // ── PRODUCT REVEALS ──
  'product-semaglutide': {
    filename: 'product-semaglutide.mp4',
    prompt: `Ultra close-up tabletop product shot of a medical-grade glass injection vial with clear liquid, 
sitting on a white marble surface. A single drop of liquid catches the light on the needle tip. 
Soft directional studio lighting from the left with a subtle warm gradient background fading from cream to white. 
Extremely shallow depth of field — the vial label is sharp, background completely dissolved. 
Slow subtle camera drift to the right. No branding or text visible on vial. 
Pharmaceutical product photography quality, indistinguishable from a real commercial shoot. ${HYPERREAL_STYLE}`,
    category: 'product',
    page: 'weight-loss'
  },

  'product-hair-treatment': {
    filename: 'product-hair-treatment.mp4',
    prompt: `Cinematic tabletop shot of a premium amber dropper bottle on a matte black surface. 
A single golden drop falls from the glass dropper in slow motion, catching studio light. 
Minimalist setting with a fresh sprig of rosemary and a small natural linen cloth beside it. 
Soft warm back-light creates a halo effect around the bottle. 
Camera slowly pushes in. Every surface texture visible — glass reflections, liquid viscosity. 
Completely indistinguishable from a real luxury skincare commercial. ${HYPERREAL_STYLE}`,
    category: 'product',
    page: 'hair-loss'
  },

  // ── SOCIAL MEDIA / PROMO ──
  'promo-testimonial-weight': {
    filename: 'promo-testimonial-weight.mp4',
    prompt: `Medium shot of a real woman in her early 40s, standing in her kitchen, speaking directly to camera. 
She has a warm, genuine smile and gestures naturally while talking. She wears a casual white t-shirt. 
Behind her is a modern kitchen with plants and natural light. 
Filmed handheld with subtle natural camera movement, like an iPhone 15 Pro shot at 4K. 
Her eyes are slightly wet with happy emotion. Completely authentic, like a real patient testimonial video. 
No makeup artist look — natural, relatable beauty. ${HYPERREAL_STYLE}`,
    category: 'social',
    page: 'promo-weight-loss'
  },

  'promo-doctor-consult': {
    filename: 'promo-doctor-consult.mp4',
    prompt: `Over-the-shoulder shot of a real female physician in a white lab coat, 
conducting a video consultation on a MacBook Pro. On the laptop screen, a patient is visible. 
The doctor nods and writes notes on a tablet. Clean, modern medical office setting with 
warm wood desk, small potted plant, and diplomas blurred on the wall behind her. 
Natural office lighting from a window to the left. Camera static with slight handheld breathe. 
This should look like a behind-the-scenes shot from a real telehealth session. ${HYPERREAL_STYLE}`,
    category: 'social',
    page: 'how-it-works'
  },

  // ── HOMEPAGE ──
  'hero-homepage': {
    filename: 'hero-homepage.mp4',
    prompt: `Smooth cinematic tracking shot moving through a premium, sunlit modern home. 
We follow a discreet medical package being placed on a doorstep by a delivery person's hand. 
Cut to: a real man in his 30s opening the package at his kitchen island, revealing a clean white box 
with medication inside. He reads the included card, nods with quiet satisfaction. 
Warm natural light throughout. Every surface texture is photorealistic — cardboard fiber, 
skin pores, fabric weave on his henley shirt. Documentary-style. ${HYPERREAL_STYLE}`,
    category: 'hero',
    page: 'homepage'
  }
};

// ─────────────────────────────────────────────────────────
// API INTERFACE
// ─────────────────────────────────────────────────────────

async function createVideoJob(scene, resolution = '1280x720', duration = 10) {
  const size = resolution === '1080' || resolution === '1920x1080' ? '1920x1080' : '1280x720';
  
  console.log(`\n🎬 Creating Sora generation job: ${scene.filename}`);
  console.log(`   Resolution: ${size} | Duration: ${duration}s`);
  console.log(`   Estimated cost: ~$${(duration * (size === '1920x1080' ? 0.50 : 0.10)).toFixed(2)}`);

  // Sora 2 accepts seconds as string: '4', '8', or '12'
  const validSeconds = [4, 8, 12];
  const snappedDuration = validSeconds.reduce((a, b) => Math.abs(b - duration) < Math.abs(a - duration) ? b : a);

  const response = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'sora-2',
      prompt: scene.prompt,
      size: size,
      seconds: String(snappedDuration)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }

  return data;
}

async function checkJobStatus(jobId) {
  const response = await fetch(`https://api.openai.com/v1/videos/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return response.json();
}

async function downloadVideo(videoId, filename) {
  const filepath = path.join(VIDEOS_DIR, filename);
  // Sora uses GET /v1/videos/{id}/content to stream the raw MP4 binary
  const response = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Downloaded: assets/videos/${filename} (${sizeMB} MB)`);
  return filepath;
}

async function pollUntilComplete(jobId, maxWaitMinutes = 15) {
  const startTime = Date.now();
  const maxWait = maxWaitMinutes * 60 * 1000;
  let lastStatus = '';

  while (Date.now() - startTime < maxWait) {
    const status = await checkJobStatus(jobId);
    
    if (status.status !== lastStatus) {
      console.log(`   📡 Status: ${status.status}`);
      lastStatus = status.status;
    }

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed') {
      throw new Error(`Generation failed: ${JSON.stringify(status.error || 'Unknown error')}`);
    }

    // Wait 10 seconds between polls
    await new Promise(r => setTimeout(r, 10000));
  }

  throw new Error(`Timed out after ${maxWaitMinutes} minutes`);
}

// ─────────────────────────────────────────────────────────
// JOB TRACKING
// ─────────────────────────────────────────────────────────

function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  }
  return {};
}

function saveJob(sceneName, jobData) {
  const jobs = loadJobs();
  jobs[sceneName] = {
    ...jobData,
    sceneName,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// ─────────────────────────────────────────────────────────
// CLI COMMANDS
// ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, val] = arg.substring(2).split('=');
    flags[key] = val || true;
  }
});

async function run() {
  // Ensure output directory
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }

  // ── LIST ──
  if (flags.list) {
    console.log('\n🎬 Available Sora Video Scenes:\n');
    console.log('─'.repeat(70));
    Object.entries(SCENES).forEach(([name, scene]) => {
      console.log(`  ${name.padEnd(30)} [${scene.category}] → ${scene.page}`);
    });
    console.log('\n─'.repeat(70));
    console.log(`\n  Total: ${Object.keys(SCENES).length} scenes`);
    console.log(`  Usage: node generate-sora-videos.js --scene=hero-weight-loss`);
    console.log(`         node generate-sora-videos.js --all --resolution=720 --duration=10\n`);
    return;
  }

  // ── STATUS CHECK ──
  if (flags.status) {
    console.log(`\n📡 Checking job status: ${flags.status}`);
    const status = await checkJobStatus(flags.status);
    console.log(JSON.stringify(status, null, 2));

    if (status.status === 'completed') {
      const jobs = loadJobs();
      const job = Object.values(jobs).find(j => j.id === flags.status);
      if (job && SCENES[job.sceneName]) {
        await downloadVideo(flags.status, SCENES[job.sceneName].filename);
      } else {
        // Fallback: download with job ID as filename
        await downloadVideo(flags.status, `${flags.status}.mp4`);
      }
    }
    return;
  }

  // ── GENERATE ──
  const resolution = flags.resolution || '720';
  const duration = parseInt(flags.duration || '10', 10);
  
  let scenesToGenerate = [];

  if (flags.all) {
    scenesToGenerate = Object.entries(SCENES);
  } else if (flags.scene) {
    if (!SCENES[flags.scene]) {
      console.error(`❌ Unknown scene: "${flags.scene}". Use --list to see available scenes.`);
      process.exit(1);
    }
    scenesToGenerate = [[flags.scene, SCENES[flags.scene]]];
  } else {
    console.log('\n🎬 Freeley Sora Video Pipeline');
    console.log('─'.repeat(50));
    console.log('  --list              List all available scenes');
    console.log('  --scene=<name>      Generate a specific scene');
    console.log('  --all               Generate all scenes');
    console.log('  --status=<id>       Check a job status');
    console.log('  --resolution=720    Set resolution (720/1080)');
    console.log('  --duration=10       Duration in seconds (5-20)');
    console.log('─'.repeat(50));
    return;
  }

  const costPerSecond = resolution === '1080' ? 0.50 : 0.10;
  const totalCost = scenesToGenerate.length * duration * costPerSecond;

  console.log(`\n🎬 Generating ${scenesToGenerate.length} video(s) via Sora 2`);
  console.log(`   Resolution: ${resolution === '1080' ? '1920x1080' : '1280x720'}`);
  console.log(`   Duration: ${duration}s each`);
  console.log(`   Estimated cost: ~$${totalCost.toFixed(2)}`);
  console.log('─'.repeat(60));

  for (const [name, scene] of scenesToGenerate) {
    try {
      const job = await createVideoJob(scene, resolution, duration);
      saveJob(name, job);
      console.log(`   🆔 Job ID: ${job.id}`);

      // Poll for completion
      console.log('   ⏳ Waiting for generation...');
      const result = await pollUntilComplete(job.id);

      // Download the completed video via /v1/videos/{id}/content
      await downloadVideo(job.id, scene.filename);

      // Rate limit between scenes
      if (scenesToGenerate.length > 1) {
        console.log('   ⏳ Waiting 5s before next scene...');
        await new Promise(r => setTimeout(r, 5000));
      }

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      saveJob(name, { error: error.message, status: 'failed' });
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! Videos saved to: assets/videos/`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review videos in assets/videos/`);
  console.log(`  2. Run: git add -A && git commit -m "add sora videos" && git push`);
}

run();
