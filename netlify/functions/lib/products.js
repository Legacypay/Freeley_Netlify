/**
 * Freeley Product Configuration
 *
 * Maps Freeley's product keys to MDI offering/compound IDs.
 *
 * Offering UUIDs were extracted from the MDI Partner Portal on 2026-04-04.
 * All 21 offerings are currently IN REVIEW (submitted 2025-04-03).
 * UUIDs are loaded from Netlify env vars with hardcoded fallbacks.
 *     Partner ID: f81508d1-3c53-4849-a636-1e9050a68e00
 *     API Credentials stored in Netlify env vars: MDI_CLIENT_ID, MDI_CLIENT_SECRET
 */

const PRODUCTS = {

  // ── Weight Loss ─────────────────────────────────────────────
  'tirzepatide': {
    offering_id: process.env.MDI_OFFERING_TIRZEPATIDE || '6831f8a2-fb27-49c5-b0bc-59651481796f',
    name: 'Tirzepatide/Glycine/B12',
    formula: '10 mg/mL',
    default_directions: 'Inject 50 units (5mg) subcutaneously once a week for 4 weeks',
    default_quantity: 6,
    default_days_supply: 90,
    default_refills: 3,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9' // Obesity, unspecified
  },

  'semaglutide': {
    offering_id: process.env.MDI_OFFERING_SEMAGLUTIDE || '50a46778-befa-4e04-894e-4397885883e0',
    name: 'Semaglutide/Glycine/B12',
    formula: '5/5/1 mg/mL',
    default_directions: 'Inject 4 units (0.04 mL) subcutaneously weekly for 4 weeks, then titrate: 8 units wks 5-8, 18 units wks 9-12, 30 units wks 13-16, 44 units wk 16+',
    default_quantity: 2,
    default_days_supply: 30,
    default_refills: 3,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  // ── Longevity / Cellular Health ──────────────────────────────
  'nad-plus': {
    offering_id: process.env.MDI_OFFERING_NAD_PLUS || '10ca4e0f-e69d-49cc-bf91-373a722b93eb',
    name: 'NAD+',
    formula: '200 mg/mL',
    default_directions: 'Inject 25 units (50 mg) subcutaneously weekly for 2 weeks, then increase by 25 units every 2 weeks',
    default_quantity: 10,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'nad-plus-tablet': {
    offering_id: process.env.MDI_OFFERING_NAD_PLUS_TABLET || '34fa8d35-b171-4015-98b3-25432afded7e',
    name: 'NAD+ (Sublingual Tablet)',
    formula: '200 mg',
    default_directions: 'Dissolve one-fourth to one tablet sublingually or buccally daily in the morning on an empty stomach',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'sermorelin-injectable': {
    offering_id: process.env.MDI_OFFERING_SERMORELIN_INJ || '41211889-d9ae-466a-9904-47b577df43c8',
    name: 'Sermorelin Acetate (Injectable)',
    formula: '1 mg/mL',
    default_directions: 'Inject 15 to 30 units (0.15 to 0.3 mL) subcutaneously nightly on an empty stomach 5 out of 7 days per week',
    default_quantity: 9,
    default_days_supply: 90,
    default_refills: 3,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'sermorelin-troche': {
    offering_id: process.env.MDI_OFFERING_SERMORELIN_TROCHE || 'c6546c6a-048a-425b-a08e-d3eaadf6aabf',
    name: 'Sermorelin Acetate (Troche)',
    formula: '600 mcg',
    default_directions: 'Dissolve one troche buccally nightly on an empty stomach 5 out of 7 days per week',
    default_quantity: 30,
    default_days_supply: 42,
    default_refills: 3,
    dispense_unit: 'Troche',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'sermorelin-nasal': {
    offering_id: process.env.MDI_OFFERING_SERMORELIN_NASAL || '785deeb3-b537-4729-a866-72f94c99f538',
    name: 'Sermorelin (Nasal Spray)',
    formula: '1000 mcg/mL',
    default_directions: 'Instill up to 3 sprays nasally at bedtime on an empty stomach 5 out of 7 days per week',
    default_quantity: 1,
    default_days_supply: 35,
    default_refills: 3,
    dispense_unit: 'Unspecified',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  // ── Longevity / Detox ───────────────────────────────────────
  'glutathione-troche': {
    offering_id: process.env.MDI_OFFERING_GLUT_TROCHE || 'f19be6d3-0b9b-422f-930b-e1a72902762c',
    name: 'Glutathione (Troche)',
    formula: '250 mg',
    default_directions: 'Dissolve one troche under the tongue daily in the morning, separated 15 minutes from food or drink',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Troche',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'glutathione-nasal': {
    offering_id: process.env.MDI_OFFERING_GLUT_NASAL || 'a164ec04-00ee-49b5-9356-5735958a082c',
    name: 'Glutathione (Nasal Spray)',
    formula: '100 mg/mL',
    default_directions: 'Instill one spray in each nostril one to two times daily',
    default_quantity: 1,
    default_days_supply: 35,
    default_refills: 11,
    dispense_unit: 'Unspecified',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'glutathione-injectable': {
    offering_id: process.env.MDI_OFFERING_GLUT_INJ || 'fde930ec-269d-411f-9140-d5d9c95b8cff',
    name: 'Glutathione (Injectable - 503B)',
    formula: '200 mg/mL',
    default_directions: 'Inject 200 mg (1 mL) intramuscularly or subcutaneously one to two times weekly OR 100 mg (0.5 mL) IM or SC every other day',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  // ── Hair Loss ────────────────────────────────────────────────
  'hair-men': {
    offering_id: process.env.MDI_OFFERING_HAIR_MEN || '99261220-0ac4-4833-8cca-ff9a59275953',
    name: 'Cedar Hair Growth Tablet',
    formula: 'Biotin 5 mg / Finasteride 1 mg / Minoxidil 2.5 mg',
    default_directions: 'Take one tablet by mouth one time daily with or without food',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L64.9' // Androgenic alopecia, unspecified
  },

  'hair-women-45plus': {
    offering_id: process.env.MDI_OFFERING_HAIR_WOMEN_45 || '0e57a467-2e15-4425-a037-c3d95a4fa45e',
    name: 'Ivy Hair Tablet (Women 45+)',
    formula: 'Minoxidil 1 mg / Dutasteride 0.4 mg with Biotin',
    default_directions: 'Take one tablet by mouth one time daily with or without food',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L65.9'
  },

  'hair-women-under45': {
    offering_id: process.env.MDI_OFFERING_HAIR_WOMEN_U45 || '33d4987c-4fa8-458f-92ca-a883bccad1a1',
    name: 'Willow Hair Tablet (Women <45)',
    formula: 'Minoxidil 1 mg / Spironolactone 60 mg with Biotin',
    default_directions: 'Take one tablet by mouth one time daily with or without food',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L65.9'
  },

  'hair-topical': {
    offering_id: process.env.MDI_OFFERING_HAIR_TOPICAL || '0e1e36e3-e390-49e8-9e45-77e39c7231ff',
    name: 'VitalPeptide Hair Therapy (GHK-Cu Topical)',
    formula: 'GHK-Cu 0.5-3%',
    default_directions: 'Apply 1 mL (15-20 drops) to affected scalp areas once daily. Massage into scalp, leave on 4-6 hours before washing.',
    default_quantity: 50,
    default_days_supply: 35,
    default_refills: 11,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L65.9'
  },

  // ── Sexual Wellness ──────────────────────────────────────────
  'tadalafil-daily': {
    offering_id: process.env.MDI_OFFERING_TADALAFIL_DAILY || '260b11b6-3636-4100-a736-526c8a6cd58b',
    name: 'Tadalafil (Daily Use)',
    formula: '5 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue daily',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9' // Erectile dysfunction, unspecified
  },

  'tadalafil-prn': {
    offering_id: process.env.MDI_OFFERING_TADALAFIL_PRN || 'fdc23a4c-2e06-4e24-a58e-2ea49e802400',
    name: 'Tadalafil (As Needed)',
    formula: '20 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue at least 30 minutes before sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  },

  'olympus-peak': {
    offering_id: process.env.MDI_OFFERING_OLYMPUS_PEAK || 'ec11e954-f9c3-4e36-9f14-9d88bfc1606f',
    name: 'Olympus Peak (Oxytocin/Bremelanotide/Tadalafil)',
    formula: 'Oxytocin 20 IU / Bremelanotide 1 mg / Tadalafil 20 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  },

  'olympus-max': {
    offering_id: process.env.MDI_OFFERING_OLYMPUS_MAX || 'd723393e-0521-4cfd-a033-7803b4d479f4',
    name: 'Olympus Max Peak (Oxytocin/Bremelanotide/Tadalafil)',
    formula: 'Oxytocin 40 IU / Bremelanotide 2 mg / Tadalafil 20 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  },

  'olympus': {
    offering_id: process.env.MDI_OFFERING_OLYMPUS || '313a25f4-05b7-48f1-b677-65ec816e3d8e',
    name: 'Olympus (Oxytocin/Bremelanotide - No Tadalafil)',
    formula: 'Oxytocin 20 IU / Bremelanotide 1 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'F52.0' // Hypoactive sexual desire disorder
  },

  'olympus-plus': {
    offering_id: process.env.MDI_OFFERING_OLYMPUS_PLUS || 'ee7aaa6b-fd3f-4e54-978f-f84d3c22573d',
    name: 'Olympus+ (Oxytocin/Bremelanotide/Tadalafil Low Dose)',
    formula: 'Oxytocin 20 IU / Bremelanotide 1 mg / Tadalafil 5 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  },

  'vast': {
    offering_id: process.env.MDI_OFFERING_VAST || '90bb95bb-c6b6-43ab-ab84-3cca9caf2fd4',
    name: 'Vast (Apomorphine/Tadalafil/Vardenafil)',
    formula: 'Apomorphine 3 mg / Tadalafil 20 mg / Vardenafil 15 mg',
    default_directions: 'Dissolve 1/2 to 1 full tablet sublingually or buccally 30-60 minutes prior to sexual activity. Do not exceed one dose in 48 hours.',
    default_quantity: 4,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  }
};

// ── Pharmacy Configuration ───────────────────────────────────
// Strive Pharmacy is used for all Freeley offerings.
// Replace MDI_STRIVE_PHARMACY_ID with the integer ID shown in the MDI portal
// under Settings → Pharmacies after onboarding is approved.
const PHARMACIES = {
  default:          parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'weight-loss':    parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'longevity':      parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'hair-loss':      parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'sexual-wellness': parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10)
};

function getPharmacyId(productKey) {
  const product = PRODUCTS[productKey];
  if (!product) return PHARMACIES.default;
  return PHARMACIES[product.category] || PHARMACIES.default;
}

module.exports = { PRODUCTS, PHARMACIES, getPharmacyId };
