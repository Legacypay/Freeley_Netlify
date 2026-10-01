// WebP copies of the heavy public/ rasters the home and weight-loss pages ship
// (Lighthouse 2026-10-01: ~4 MB of PNG on /, 3.6 MB oversized on /weight-loss/).
// The originals stay in place: other pages, emails and the legacy .html files
// still point at them. Re-run after replacing a source image:
//
//   node scripts/optimize-images.mjs
//
// Each entry: source path under public/, and either `width` (one <name>.webp,
// resized down to that width) or `widths` (one <name>-<w>.webp per width, for
// srcset). Widths are ~2x the largest rendered CSS width, never upscaled.
import sharp from 'sharp';
import { statSync } from 'node:fs';

const IMAGES = [
  // Home hero: LCP element. Rendered 356 px on mobile; on desktop object-fit:
  // cover in a ~760 px tall box renders it ~1140 px wide, so keep a full 1536.
  { src: 'assets/home/hero-image.png', widths: [640, 960, 1280, 1536] },
  // Home avatars (CSS backgrounds, ~40 px circles) and stat-card art.
  { src: 'assets/brand/testimonial_1.png', width: 128 },
  { src: 'assets/brand/testimonial_2.png', width: 128 },
  { src: 'assets/brand/testimonial_3.png', width: 128 },
  { src: 'assets/brand/testimonial_4.png', width: 128 },
  { src: 'assets/home/48hr_Door-to-Door_Delivery.png', width: 800 },
  { src: 'assets/home/96_Patient satisfaction.png', width: 900 },
  { src: 'assets/home/24hr.Avg.physician.esponse.png', width: 400 },
  { src: 'assets/home/girl-belly.png', width: 900 },
  { src: 'assets/home/girl-belly-mobile.png', width: 700 },
  { src: 'assets/home/white-ellipse.png', width: 680 },
  { src: 'assets/home/ellipse_35.png', width: 800 },
  // Home "why Freeley" cards and how-it-works steps.
  { src: 'assets/home/Real_Doctors.png', width: 800 },
  { src: 'assets/home/Real_Providers.png', width: 800 },
  { src: 'assets/home/Pharmacy_Grade.png', width: 800 },
  { src: 'assets/howItsWork/Complete_Your_Health_Intake.png', width: 560 },
  { src: 'assets/howItsWork/Physician_Reviews_Your_Profile.png', width: 560 },
  { src: 'assets/howItsWork/Pharmacy Compounds Your Medication.png', width: 560 },
  { src: 'assets/howItsWork/Delivered_to_Your_Door.png', width: 560 },
  { src: 'assets/process-lifestyle.jpg', width: 700 },
  // Weight-loss page.
  { src: 'assets/wl/hero.png', width: 960 },
  { src: 'assets/wl/hero-mob.png', width: 700 },
  { src: 'assets/wl/QuietsThe_FoodNoise_.png', width: 800 },
  { src: 'assets/wl/YouStayFullLonger.png', width: 800 },
  { src: 'assets/wl/ImprovesMetabolicHealth.png', width: 800 },
  { src: 'assets/wl/Here_sWhatHappensNext.jpg', width: 1100 },
  { src: 'assets/wl/why-trust-freeley-lifestyle.jpg', width: 1100 },
  { src: 'assets/physicians/dr-martinez-v2.jpg', width: 800 },
  // /promo-weight-loss (legacy static page in public/): hero video poster (its
  // LCP), the transformation photo and the two vial cards (~430 px wide).
  { src: 'assets/promo/weight-loss-hero.jpg', width: 1280 },
  { src: 'assets/promo/wl-transformation.png', width: 900 },
  { src: 'assets/brand/semag_transparent.png', width: 900 },
  { src: 'assets/brand/tirzz_transparent.png', width: 900 },
];

const kib = (n) => `${Math.round(n / 1024)} KiB`;

for (const img of IMAGES) {
  const src = `public/${img.src}`;
  const base = src.replace(/\.(png|jpe?g)$/i, '');
  const { width: natural } = await sharp(src).metadata();
  const targets = img.widths ? img.widths.map((w) => [w, `${base}-${w}.webp`]) : [[img.width, `${base}.webp`]];
  for (const [w, out] of targets) {
    await sharp(src)
      .resize({ width: Math.min(w, natural), withoutEnlargement: true })
      .webp({ quality: 80, effort: 6, alphaQuality: 90 })
      .toFile(out);
    console.log(`${src} (${kib(statSync(src).size)}) -> ${out} (${kib(statSync(out).size)})`);
  }
}
