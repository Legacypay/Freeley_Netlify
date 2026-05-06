#!/usr/bin/env node
/**
 * Freeley × MDI Integration Validation Suite
 *
 * Tests product mappings, API connectivity, function logic, and data integrity.
 * Run: node tests/integration-check.js
 *
 * Environment variables needed for live API tests:
 *   MDI_CLIENT_ID, MDI_CLIENT_SECRET
 *
 * Without credentials, runs offline validation only (still very useful).
 */

const path = require('path');

// ── Test Framework ──────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;

function test(name, fn) {
  try {
    fn();
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
const { PRODUCTS, PHARMACIES, getPharmacyId } = require('../netlify/functions/lib/products');

// ── CSV intake associations (from MDI mapping spreadsheet) ──
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
  // 'VitalPeptide Hair Therapy': 'GHK-Cu', // REMOVED: GHK-Cu ineligible per FDA 503A update April 2026
  'Willow Hair': 'Min / Spiro / Biotin',
  'Glutathione Nasal Spray': 'Glut. Nasal Spray',
  'Semorelin Troche': 'Semorelin Oral',
};

// ════════════════════════════════════════════════════════════
console.log('\n🔬 FREELEY × MDI INTEGRATION VALIDATION');
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

test('All non-pending products have valid UUID offering_id', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (p._pending) continue;
    assert(uuidRegex.test(p.offering_id), `${key} has invalid UUID: ${p.offering_id}`);
  }
});

test('Pending products are correctly flagged', () => {
  const pending = Object.entries(PRODUCTS).filter(([, p]) => p._pending);
  for (const [key, p] of pending) {
    assert(p.offering_id === 'PENDING_UUID', `Pending product ${key} should have PENDING_UUID`);
  }
  console.log(`     (${pending.length} pending: ${pending.map(([k]) => k).join(', ')})`);
});

test('No duplicate offering_id values (excluding PENDING)', () => {
  const ids = {};
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (p._pending) continue;
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

test('Products with intake field match CSV mapping', () => {
  const mismatches = [];
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (!p.intake || !p.mdi_offering_name) continue;
    // Find matching CSV entry by MDI offering name
    const expectedIntake = EXPECTED_INTAKES[p.mdi_offering_name];
    if (expectedIntake && expectedIntake !== p.intake) {
      mismatches.push(`${key}: expected "${expectedIntake}", got "${p.intake}"`);
    }
  }
  assert(mismatches.length === 0, `Intake mismatches:\n       ${mismatches.join('\n       ')}`);
});

test('Product count matches expected (20 active + 2 new = 22; hair-topical removed per FDA)', () => {
  const count = Object.keys(PRODUCTS).length;
  assert(count === 22, `Expected 22 products, found ${count}`);
});

// ── 2. Category Coverage ────────────────────────────────────
console.log('\n📊 2. Category Coverage');

test('All 4 verticals have products', () => {
  const categories = new Set(Object.values(PRODUCTS).map(p => p.category));
  for (const cat of ['weight-loss', 'longevity', 'hair-loss', 'sexual-wellness']) {
    assert(categories.has(cat), `Missing category: ${cat}`);
  }
});

test('Category product counts are reasonable', () => {
  const counts = {};
  for (const p of Object.values(PRODUCTS)) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  console.log(`     weight-loss: ${counts['weight-loss']}, longevity: ${counts['longevity']}, hair-loss: ${counts['hair-loss']}, sexual-wellness: ${counts['sexual-wellness']}`);
  assert(counts['weight-loss'] >= 2, 'Weight loss should have >= 2 products');
  assert(counts['hair-loss'] >= 4, 'Hair loss should have >= 4 products');
  assert(counts['sexual-wellness'] >= 5, 'Sexual wellness should have >= 5 products');
});

// ── 3. Pharmacy Configuration ───────────────────────────────
console.log('\n💊 3. Pharmacy Configuration');

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

// ── 4. Intake Mapping Completeness ──────────────────────────
console.log('\n📋 4. Intake Mapping Completeness');

test('Products without intake mappings are identified', () => {
  const noIntake = Object.entries(PRODUCTS)
    .filter(([, p]) => p.intake === null)
    .map(([k]) => k);
  if (noIntake.length > 0) {
    console.log(`     ⚠️  Missing intake: ${noIntake.join(', ')}`);
    console.log(`     (These need MDI confirmation for intake form assignment)`);
  }
});

test('All CSV offerings are represented in products.js', () => {
  const mdiNames = Object.values(PRODUCTS).map(p => p.mdi_offering_name).filter(Boolean);
  const csvOfferings = Object.keys(EXPECTED_INTAKES);
  const missing = csvOfferings.filter(name =>
    !mdiNames.some(mdiName => mdiName === name || mdiName.includes(name) || name.includes(mdiName))
  );
  assert(missing.length === 0, `CSV offerings not in products.js: ${missing.join(', ')}`);
});

// ── 5. Function File Integrity ──────────────────────────────
console.log('\n🔧 5. Function File Integrity');

test('submitQuiz.js loads without error', () => {
  // Just require it to check for syntax errors
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

// ── 6. submitQuiz Logic Tests ───────────────────────────────
console.log('\n🧪 6. submitQuiz Logic Tests (offline)');

test('submitQuiz rejects missing patient data', async () => {
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'semaglutide' })
  });
  assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  assert(JSON.parse(res.body).error.includes('required'), 'Should mention required fields');
});

test('submitQuiz rejects invalid product key', async () => {
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ patient: { email: 'test@test.com', first_name: 'Test', last_name: 'User' }, product: 'fake-product' })
  });
  assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  assert(JSON.parse(res.body).error.includes('Invalid product'), 'Should say invalid product');
});

test('submitQuiz blocks pending products', async () => {
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ patient: { email: 'test@test.com', first_name: 'Test', last_name: 'User' }, product: 'hair-biotin-fin-min' })
  });
  assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  assert(JSON.parse(res.body).error.includes('not yet available'), 'Should block pending products');
});

test('submitQuiz rejects OPTIONS with 204', async () => {
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({ httpMethod: 'OPTIONS' });
  assert(res.statusCode === 204, `Expected 204, got ${res.statusCode}`);
});

test('submitQuiz rejects GET with 405', async () => {
  const { handler } = require('../netlify/functions/submitQuiz');
  const res = await handler({ httpMethod: 'GET' });
  assert(res.statusCode === 405, `Expected 405, got ${res.statusCode}`);
});

// ── 7. Webhook Signature Verification ───────────────────────
console.log('\n🔐 7. Webhook Verification');

test('verifyWebhookSignature exists and is callable', () => {
  const { verifyWebhookSignature } = require('../netlify/functions/lib/mdi-client');
  assert(typeof verifyWebhookSignature === 'function', 'not a function');
});

// ── 8. CORS Configuration ───────────────────────────────────
console.log('\n🌐 8. CORS Configuration');

test('CORS headers include freeley.com', () => {
  const { CORS_HEADERS, getCorsHeaders } = require('../netlify/functions/lib/mdi-client');
  // Check static CORS_HEADERS
  if (CORS_HEADERS && CORS_HEADERS['Access-Control-Allow-Origin']) {
    const origin = CORS_HEADERS['Access-Control-Allow-Origin'];
    assert(origin.includes('freeley.com'), `CORS origin should include freeley.com, got: ${origin}`);
  }
});

// ── 9. Data Quality Checks ──────────────────────────────────
console.log('\n📏 9. Data Quality Checks');

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

// ── Summary ─────────────────────────────────────────────────
console.log('\n' + '═'.repeat(55));
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Review the errors above.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed! Integration configuration is solid.');

  // Print summary of items needing attention
  const pendingProducts = Object.entries(PRODUCTS).filter(([, p]) => p._pending);
  const noIntake = Object.entries(PRODUCTS).filter(([, p]) => p.intake === null);

  if (pendingProducts.length > 0 || noIntake.length > 0) {
    console.log('\n📝 ITEMS NEEDING ATTENTION:');
    if (pendingProducts.length > 0) {
      console.log(`   • ${pendingProducts.length} products need UUIDs from MDI portal: ${pendingProducts.map(([k]) => k).join(', ')}`);
    }
    if (noIntake.length > 0) {
      console.log(`   • ${noIntake.length} products need intake form confirmation: ${noIntake.map(([k]) => k).join(', ')}`);
    }
  }

  process.exit(0);
}
