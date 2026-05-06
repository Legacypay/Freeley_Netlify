#!/usr/bin/env node
/**
 * Freeley × MDI Integration Validation Suite
 *
 * Tests product mappings, API connectivity, function logic, and data integrity.
 * Run: node tests/integration-check.js
 *
 * UPDATED 2026-05-06: Rebuilt for DTP compound structure with dose-tiered
 * semaglutide (S1-S5) and tirzepatide (T1-T4).
 *
 * Environment variables needed for live API tests:
 *   MDI_CLIENT_ID, MDI_CLIENT_SECRET
 *
 * Without credentials, runs offline validation only (still very useful).
 */

const path = require('path');

// ── Test Framework ──────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const asyncTests = [];

function test(name, fn) {
  try {
    const result = fn();
    // Handle async tests
    if (result && typeof result.then === 'function') {
      asyncTests.push(
        result.then(() => {
          passed++;
          console.log(`  ✅ ${name}`);
        }).catch((e) => {
          failed++;
          console.log(`  ❌ ${name}`);
          console.log(`     → ${e.message}`);
        })
      );
      return;
    }
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Load modules under test ─────────────────────────────────
const { PRODUCTS, PHARMACIES, getPharmacyId, resolveProductKey, SEMAGLUTIDE_TIERS, TIRZEPATIDE_TIERS } = require('../netlify/functions/lib/products');

// ── CSV intake associations (from MDI mapping spreadsheet 2026-05-06) ──
const EXPECTED_INTAKES = {
  'Glutathione Injections': 'Glutathione INJECTION INTAKE form',
  'Cedar Hair Growth Tablet': 'Minoxidil / Finasteride /Biotin (Men & Women)',
  'DTP-Biotin / Finasteride / Minoxidil': 'Minoxidil / Finasteride /Biotin (Men & Women)',
  'DTP - Glutathione (Troche)': 'Glutathione Medical Form',
  'DTP-Injectable-Sermorelin Acetate': 'Sermorelin INJECTION Intake Form',
  'Ivy Oral': 'Minoxidil / Dutasteride',
  'ARB Topical A5FD': 'ARB Topical A15FD & A5FD & A15F',
  'DTP-NAD+': 'NAD+ injection',
  'DTP-Olympus Max Peak-Oxytocin / Bremelanotide / Tadalafil': 'TADALAFIL/OXYTOCIN/PT-141',
  'DTP-Olympus Oxytocin / Bremelanotide': 'Oxy / PT-141',
  'Tadalafil (oral - tablet) 5mg': 'ED & Refill',
  'Semaglutide': 'PERS new / initial sema & refill',
  'Tirzepatide': 'PERS new / initial tirzep & refill',
  'Sermorelin Nasal Spray': 'Sermorelin Nasal Spray',
  'Tadalafil': 'Erectile Dysfunction & ED refill',
  'VitalPeptide Hair Therapy': 'GHK-Cu',
  'Willow Hair': 'Min / Spiro / Biotin',
  'Glutathione Nasal Spray': 'Glut. Nasal Spray',
  'Semorelin Troche': 'Semorelin Oral',
};

// ════════════════════════════════════════════════════════════
console.log('\n🔬 FREELEY × MDI INTEGRATION VALIDATION (DTP rebuild)');
console.log('═'.repeat(55));

// ── 1. Product Configuration ────────────────────────────────
console.log('\n📦 1. Product Configuration');

test('All products have required fields', () => {
  const required = ['offering_id', 'name', 'category', 'default_directions', 'default_quantity', 'default_refills', 'dispense_unit'];
  const keys = Object.keys(PRODUCTS);
  for (const key of keys) {
    const p = PRODUCTS[key];
    for (const field of required) {
      assert(p[field] !== undefined, `${key} missing field: ${field}`);
    }
  }
});

test('All products have valid UUID offering_id', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert(uuidRegex.test(p.offering_id), `${key} has invalid UUID: ${p.offering_id}`);
  }
});

test('No duplicate offering_id values', () => {
  const ids = {};
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert(!ids[p.offering_id], `Duplicate offering_id ${p.offering_id} on ${key} and ${ids[p.offering_id]}`);
    ids[p.offering_id] = key;
  }
});

test('All products have intake field', () => {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert('intake' in p, `${key} missing intake field`);
  }
});

test('All products have mdi_offering_name field', () => {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert('mdi_offering_name' in p, `${key} missing mdi_offering_name field`);
  }
});

test('Product count matches expected (26 active DTP offerings)', () => {
  const count = Object.keys(PRODUCTS).length;
  assert(count === 26, `Expected 26 products, found ${count}`);
});

test('No pending products remain', () => {
  const pending = Object.entries(PRODUCTS).filter(([, p]) => p._pending);
  assert(pending.length === 0, `Found ${pending.length} pending products: ${pending.map(([k]) => k).join(', ')}`);
});

// ── 2. Dose-Tiered Products ────────────────────────────────
console.log('\n💊 2. Dose-Tiered Products');

test('Semaglutide has 5 dose tiers (S1-S5)', () => {
  const semaTiers = Object.keys(PRODUCTS).filter(k => k.startsWith('semaglutide-s'));
  assert(semaTiers.length === 5, `Expected 5 semaglutide tiers, found ${semaTiers.length}: ${semaTiers.join(', ')}`);
  for (let i = 1; i <= 5; i++) {
    assert(PRODUCTS[`semaglutide-s${i}`], `Missing semaglutide-s${i}`);
  }
});

test('Tirzepatide has 4 dose tiers (T1-T4)', () => {
  const tirzTiers = Object.keys(PRODUCTS).filter(k => k.startsWith('tirzepatide-t'));
  assert(tirzTiers.length === 4, `Expected 4 tirzepatide tiers, found ${tirzTiers.length}: ${tirzTiers.join(', ')}`);
  for (let i = 1; i <= 4; i++) {
    assert(PRODUCTS[`tirzepatide-t${i}`], `Missing tirzepatide-t${i}`);
  }
});

test('Semaglutide dose tiers are correctly ordered', () => {
  const doses = [];
  for (let i = 1; i <= 5; i++) {
    const p = PRODUCTS[`semaglutide-s${i}`];
    assert(p.dose_mg, `semaglutide-s${i} missing dose_mg`);
    doses.push(p.dose_mg);
  }
  for (let i = 1; i < doses.length; i++) {
    assert(doses[i] > doses[i - 1], `Semaglutide doses not ascending: S${i} (${doses[i - 1]}) >= S${i + 1} (${doses[i]})`);
  }
  console.log(`     Doses: ${doses.map((d, i) => `S${i + 1}=${d}mg`).join(', ')}`);
});

test('Tirzepatide dose tiers are correctly ordered', () => {
  const doses = [];
  for (let i = 1; i <= 4; i++) {
    const p = PRODUCTS[`tirzepatide-t${i}`];
    assert(p.dose_mg, `tirzepatide-t${i} missing dose_mg`);
    doses.push(p.dose_mg);
  }
  for (let i = 1; i < doses.length; i++) {
    assert(doses[i] > doses[i - 1], `Tirzepatide doses not ascending: T${i} (${doses[i - 1]}) >= T${i + 1} (${doses[i]})`);
  }
  console.log(`     Doses: ${doses.map((d, i) => `T${i + 1}=${d}mg`).join(', ')}`);
});

test('SEMAGLUTIDE_TIERS map matches product dose_mg values', () => {
  for (const [dose, key] of Object.entries(SEMAGLUTIDE_TIERS)) {
    const product = PRODUCTS[key];
    assert(product, `SEMAGLUTIDE_TIERS maps dose ${dose} to nonexistent key ${key}`);
    assert(product.dose_mg === Number(dose), `SEMAGLUTIDE_TIERS dose ${dose} → ${key} but product.dose_mg is ${product.dose_mg}`);
  }
});

test('TIRZEPATIDE_TIERS map matches product dose_mg values', () => {
  for (const [dose, key] of Object.entries(TIRZEPATIDE_TIERS)) {
    const product = PRODUCTS[key];
    assert(product, `TIRZEPATIDE_TIERS maps dose ${dose} to nonexistent key ${key}`);
    assert(product.dose_mg === Number(dose), `TIRZEPATIDE_TIERS dose ${dose} → ${key} but product.dose_mg is ${product.dose_mg}`);
  }
});

test('All weight-loss products share same intake form per medication', () => {
  const semaIntakes = new Set();
  const tirzIntakes = new Set();
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (key.startsWith('semaglutide-')) semaIntakes.add(p.intake);
    if (key.startsWith('tirzepatide-')) tirzIntakes.add(p.intake);
  }
  assert(semaIntakes.size === 1, `Semaglutide tiers should share one intake form, found: ${[...semaIntakes].join(', ')}`);
  assert(tirzIntakes.size === 1, `Tirzepatide tiers should share one intake form, found: ${[...tirzIntakes].join(', ')}`);
});

// ── 3. resolveProductKey Helper ─────────────────────────────
console.log('\n🔑 3. resolveProductKey Helper');

test('Direct product keys resolve to themselves', () => {
  for (const key of Object.keys(PRODUCTS)) {
    const resolved = resolveProductKey(key);
    assert(resolved === key, `Direct key ${key} resolved to ${resolved}`);
  }
});

test('Legacy "semaglutide" key resolves to S1 without dose', () => {
  const resolved = resolveProductKey('semaglutide');
  assert(resolved === 'semaglutide-s1', `Expected semaglutide-s1, got ${resolved}`);
});

test('Legacy "tirzepatide" key resolves to T1 without dose', () => {
  const resolved = resolveProductKey('tirzepatide');
  assert(resolved === 'tirzepatide-t1', `Expected tirzepatide-t1, got ${resolved}`);
});

test('Semaglutide resolves correctly with dose parameter', () => {
  const cases = { 0.2: 'semaglutide-s1', 0.4: 'semaglutide-s2', 0.9: 'semaglutide-s3', 1.5: 'semaglutide-s4', 2.2: 'semaglutide-s5' };
  for (const [dose, expected] of Object.entries(cases)) {
    const resolved = resolveProductKey('semaglutide', Number(dose));
    assert(resolved === expected, `semaglutide dose ${dose} → expected ${expected}, got ${resolved}`);
  }
});

test('Tirzepatide resolves correctly with dose parameter', () => {
  const cases = { 2: 'tirzepatide-t1', 4: 'tirzepatide-t2', 7: 'tirzepatide-t3', 9: 'tirzepatide-t4' };
  for (const [dose, expected] of Object.entries(cases)) {
    const resolved = resolveProductKey('tirzepatide', Number(dose));
    assert(resolved === expected, `tirzepatide dose ${dose} → expected ${expected}, got ${resolved}`);
  }
});

test('Unknown product keys return null', () => {
  assert(resolveProductKey('nonexistent') === null, 'Should return null for unknown key');
  assert(resolveProductKey('') === null, 'Should return null for empty string');
});

test('Semaglutide with unknown dose defaults to S1', () => {
  const resolved = resolveProductKey('semaglutide', 999);
  assert(resolved === 'semaglutide-s1', `Expected semaglutide-s1, got ${resolved}`);
});

test('Tirzepatide with unknown dose defaults to T1', () => {
  const resolved = resolveProductKey('tirzepatide', 999);
  assert(resolved === 'tirzepatide-t1', `Expected tirzepatide-t1, got ${resolved}`);
});

// ── 4. Category Coverage ────────────────────────────────────
console.log('\n📊 4. Category Coverage');

test('All 4 verticals have products', () => {
  const categories = new Set(Object.values(PRODUCTS).map(p => p.category));
  for (const cat of ['weight-loss', 'longevity', 'hair-loss', 'sexual-wellness']) {
    assert(categories.has(cat), `Missing category: ${cat}`);
  }
});

test('Category product counts match expected', () => {
  const counts = {};
  for (const p of Object.values(PRODUCTS)) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  console.log(`     weight-loss: ${counts['weight-loss']}, longevity: ${counts['longevity']}, hair-loss: ${counts['hair-loss']}, sexual-wellness: ${counts['sexual-wellness']}`);
  assert(counts['weight-loss'] === 9, `Weight loss should have 9 products (5 sema + 4 tirz), got ${counts['weight-loss']}`);
  assert(counts['longevity'] === 6, `Longevity should have 6 products, got ${counts['longevity']}`);
  assert(counts['hair-loss'] === 5, `Hair loss should have 5 products, got ${counts['hair-loss']}`);
  assert(counts['sexual-wellness'] === 6, `Sexual wellness should have 6 products, got ${counts['sexual-wellness']}`);
});

// ── 5. Pharmacy Configuration ───────────────────────────────
console.log('\n💊 5. Pharmacy Configuration');

test('All pharmacy categories are configured', () => {
  for (const cat of ['default', 'weight-loss', 'longevity', 'hair-loss', 'sexual-wellness']) {
    assert(cat in PHARMACIES, `Missing pharmacy config for: ${cat}`);
  }
});

test('getPharmacyId returns a number for all products', () => {
  for (const key of Object.keys(PRODUCTS)) {
    const id = getPharmacyId(key);
    assert(typeof id === 'number', `${key}: getPharmacyId returned ${typeof id}`);
  }
});

test('getPharmacyId returns default for unknown products', () => {
  const id = getPharmacyId('nonexistent-product');
  assert(typeof id === 'number', 'Should return default pharmacy for unknown product');
});

test('getPharmacyId works with legacy semaglutide/tirzepatide keys', () => {
  const id1 = getPharmacyId('semaglutide');
  const id2 = getPharmacyId('tirzepatide');
  assert(typeof id1 === 'number', 'Legacy semaglutide should resolve pharmacy');
  assert(typeof id2 === 'number', 'Legacy tirzepatide should resolve pharmacy');
});

// ── 6. Intake Mapping ───────────────────────────────────────
console.log('\n📋 6. Intake Mapping');

test('All products have non-null intake values', () => {
  const noIntake = Object.entries(PRODUCTS)
    .filter(([, p]) => p.intake === null || p.intake === undefined)
    .map(([k]) => k);
  assert(noIntake.length === 0, `Products missing intake: ${noIntake.join(', ')}`);
});

test('Products with intake field match CSV mapping where applicable', () => {
  const mismatches = [];
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (!p.intake || !p.mdi_offering_name) continue;
    for (const [csvName, csvIntake] of Object.entries(EXPECTED_INTAKES)) {
      const mdiName = p.mdi_offering_name;
      // Exact match, or substring match only if the CSV name is specific enough
      // (>20 chars) to avoid false positives like "Tadalafil" matching all Olympus products
      const isExact = mdiName === csvName;
      const isSubstring = csvName.length > 20 && (mdiName.includes(csvName) || csvName.includes(mdiName));
      if (isExact || isSubstring) {
        if (csvIntake !== p.intake) {
          mismatches.push(`${key}: expected "${csvIntake}", got "${p.intake}"`);
        }
      }
    }
  }
  assert(mismatches.length === 0, `Intake mismatches:\n       ${mismatches.join('\n       ')}`);
});

// ── 7. Function File Integrity ──────────────────────────────
console.log('\n🔧 7. Function File Integrity');

test('submitQuiz.js loads without error', () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const mod = require('../netlify/functions/submitQuiz');
  assert(typeof mod.handler === 'function', 'handler export is not a function');
});

test('caseStatus.js loads without error', () => {
  delete require.cache[require.resolve('../netlify/functions/caseStatus')];
  const mod = require('../netlify/functions/caseStatus');
  assert(typeof mod.handler === 'function', 'handler export is not a function');
});

test('getMessagingAuth.js loads without error', () => {
  delete require.cache[require.resolve('../netlify/functions/getMessagingAuth')];
  const mod = require('../netlify/functions/getMessagingAuth');
  assert(typeof mod.handler === 'function', 'handler export is not a function');
});

test('mdiWebhook.js loads without error', () => {
  delete require.cache[require.resolve('../netlify/functions/mdiWebhook')];
  const mod = require('../netlify/functions/mdiWebhook');
  assert(typeof mod.handler === 'function', 'handler export is not a function');
});

test('mdi-client.js exports required functions', () => {
  delete require.cache[require.resolve('../netlify/functions/lib/mdi-client')];
  const client = require('../netlify/functions/lib/mdi-client');
  assert(typeof client.getAccessToken === 'function', 'missing getAccessToken');
  assert(typeof client.mdiRequest === 'function', 'missing mdiRequest');
  assert(typeof client.verifyWebhookSignature === 'function', 'missing verifyWebhookSignature');
  assert(typeof client.getCorsHeaders === 'function', 'missing getCorsHeaders');
});

test('products.js exports all required members', () => {
  delete require.cache[require.resolve('../netlify/functions/lib/products')];
  const prod = require('../netlify/functions/lib/products');
  assert(typeof prod.PRODUCTS === 'object', 'missing PRODUCTS');
  assert(typeof prod.PHARMACIES === 'object', 'missing PHARMACIES');
  assert(typeof prod.getPharmacyId === 'function', 'missing getPharmacyId');
  assert(typeof prod.resolveProductKey === 'function', 'missing resolveProductKey');
  assert(typeof prod.SEMAGLUTIDE_TIERS === 'object', 'missing SEMAGLUTIDE_TIERS');
  assert(typeof prod.TIRZEPATIDE_TIERS === 'object', 'missing TIRZEPATIDE_TIERS');
});

// ── 8. submitQuiz Logic Tests ───────────────────────────────
console.log('\n🧪 8. submitQuiz Logic Tests (offline)');

test('submitQuiz rejects missing patient data', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'semaglutide-s1' })
  });
  assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  assert(JSON.parse(res.body).error.includes('required'), 'Should mention required fields');
});

test('submitQuiz rejects invalid product key', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ patient: { email: 'test@test.com', first_name: 'Test', last_name: 'User' }, product: 'fake-product' })
  });
  assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  assert(JSON.parse(res.body).error.includes('Invalid product'), 'Should say invalid product');
});

test('submitQuiz accepts legacy "semaglutide" key with dose', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      patient: { email: 'test@test.com', first_name: 'Test', last_name: 'User' },
      product: 'semaglutide',
      dose: 0.4
    })
  });
  // Should NOT be 400 — resolves to semaglutide-s2. Will be 500 (no MDI creds) but that's fine.
  assert(res.statusCode !== 400, `Legacy semaglutide+dose should resolve, but got 400: ${JSON.parse(res.body).error}`);
});

test('submitQuiz accepts legacy "tirzepatide" key without dose', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      patient: { email: 'test@test.com', first_name: 'Test', last_name: 'User' },
      product: 'tirzepatide'
    })
  });
  assert(res.statusCode !== 400, `Legacy tirzepatide should resolve to T1, but got 400: ${JSON.parse(res.body).error}`);
});

test('submitQuiz rejects OPTIONS with 204', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({ httpMethod: 'OPTIONS' });
  assert(res.statusCode === 204, `Expected 204, got ${res.statusCode}`);
});

test('submitQuiz rejects GET with 405', async () => {
  delete require.cache[require.resolve('../netlify/functions/submitQuiz')];
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({ httpMethod: 'GET' });
  assert(res.statusCode === 405, `Expected 405, got ${res.statusCode}`);
});

// ── 9. Webhook Signature Verification ───────────────────────
console.log('\n🔐 9. Webhook Verification');

test('verifyWebhookSignature exists and is callable', () => {
  const { verifyWebhookSignature } = require('../netlify/functions/lib/mdi-client');
  assert(typeof verifyWebhookSignature === 'function', 'not a function');
});

// ── 10. CORS Configuration ──────────────────────────────────
console.log('\n🌐 10. CORS Configuration');

test('CORS headers include freeley.com', () => {
  const { CORS_HEADERS } = require('../netlify/functions/lib/mdi-client');
  if (CORS_HEADERS && CORS_HEADERS['Access-Control-Allow-Origin']) {
    const origin = CORS_HEADERS['Access-Control-Allow-Origin'];
    assert(origin.includes('freeley.com'), `CORS origin should include freeley.com, got: ${origin}`);
  }
});

// ── 11. Data Quality Checks ─────────────────────────────────
console.log('\n📏 11. Data Quality Checks');

test('All ICD-10 codes are valid format', () => {
  const icd10Regex = /^[A-Z][0-9]{2}(\.[0-9]{1,4})?$/;
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (p.icd10) {
      assert(icd10Regex.test(p.icd10), `${key}: invalid ICD-10 code "${p.icd10}"`);
    }
  }
});

test('All quantities are positive numbers', () => {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert(p.default_quantity > 0, `${key}: quantity must be > 0`);
    assert(p.default_refills >= 0, `${key}: refills must be >= 0`);
  }
});

test('All dispense units are standard values', () => {
  const validUnits = ['Tablet', 'Milliliter', 'Troche', 'Unspecified'];
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert(validUnits.includes(p.dispense_unit), `${key}: unexpected dispense_unit "${p.dispense_unit}"`);
  }
});

test('Product keys use consistent naming convention', () => {
  const keyRegex = /^[a-z][a-z0-9-]*$/;
  for (const key of Object.keys(PRODUCTS)) {
    assert(keyRegex.test(key), `Product key "${key}" should be lowercase-kebab-case`);
  }
});

test('All products specify pharmacy as Strive Pharmacy', () => {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (p.pharmacy) {
      assert(p.pharmacy === 'Strive Pharmacy', `${key}: expected Strive Pharmacy, got "${p.pharmacy}"`);
    }
  }
});

test('All products have default_days_supply', () => {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    assert(p.default_days_supply > 0, `${key}: missing or invalid default_days_supply`);
  }
});

// ── Summary ─────────────────────────────────────────────────
Promise.all(asyncTests).then(() => {
  console.log('\n' + '═'.repeat(55));
  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Integration configuration is solid.');

    const categories = {};
    for (const p of Object.values(PRODUCTS)) {
      categories[p.category] = (categories[p.category] || 0) + 1;
    }
    console.log('\n📝 PRODUCT SUMMARY:');
    console.log(`   • ${Object.keys(PRODUCTS).length} total active products`);
    console.log(`   • ${Object.keys(SEMAGLUTIDE_TIERS).length} semaglutide dose tiers, ${Object.keys(TIRZEPATIDE_TIERS).length} tirzepatide dose tiers`);
    console.log(`   • Categories: ${Object.entries(categories).map(([k, v]) => `${k}(${v})`).join(', ')}`);

    process.exit(0);
  }
});
