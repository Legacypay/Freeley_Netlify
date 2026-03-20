/**
 * Freeley Product Configuration
 * 
 * Maps Freeley's product categories to MDI compound/medication IDs.
 * 
 * ⚠️  IMPORTANT: Replace the placeholder UUIDs below with your actual
 *     compound IDs from the MDI Admin Panel after onboarding.
 * 
 *     You'll get these IDs when MDI sets up your partner account and
 *     configures your compounds + pharmacies.
 */

const PRODUCTS = {
  // ── Weight Loss ──────────────────────────────────────────
  'semaglutide': {
    partner_compound_id: 'REPLACE_WITH_SEMAGLUTIDE_COMPOUND_ID',
    name: 'Compounded Semaglutide',
    default_directions: 'Inject subcutaneously once weekly as directed by your provider.',
    default_quantity: 1,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley Weight Loss Program - Compounded Semaglutide',
    disease_id: 'REPLACE_WITH_OBESITY_DISEASE_ID', // ICD E66.9
    category: 'weight-loss'
  },

  'tirzepatide': {
    partner_compound_id: 'REPLACE_WITH_TIRZEPATIDE_COMPOUND_ID',
    name: 'Compounded Tirzepatide',
    default_directions: 'Inject subcutaneously once weekly as directed by your provider.',
    default_quantity: 1,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley Weight Loss Program - Compounded Tirzepatide',
    disease_id: 'REPLACE_WITH_OBESITY_DISEASE_ID', // ICD E66.9
    category: 'weight-loss'
  },

  // ── Sexual Wellness (ED) ────────────────────────────────
  'ed-troche': {
    partner_compound_id: 'REPLACE_WITH_ED_TROCHE_COMPOUND_ID',
    name: '3-in-1 ED Troche (Sildenafil/Tadalafil/Apomorphine)',
    default_directions: 'Dissolve one troche sublingually 30-60 minutes before sexual activity. Do not exceed one dose per 24 hours.',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley ED Program - Compounded Sublingual Troche',
    disease_id: 'REPLACE_WITH_ED_DISEASE_ID', // ICD N52.9
    category: 'sexual-wellness'
  },

  // ── Hair Loss ────────────────────────────────────────────
  'finasteride': {
    partner_compound_id: 'REPLACE_WITH_FINASTERIDE_COMPOUND_ID',
    name: 'Finasteride + Minoxidil (Topical)',
    default_directions: 'Apply topically to affected areas of the scalp once daily.',
    default_quantity: 1,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley Hair Loss Program - Compounded Topical',
    disease_id: 'REPLACE_WITH_ALOPECIA_DISEASE_ID', // ICD L64.9
    category: 'hair-loss'
  },

  // ── Longevity / Peptides ─────────────────────────────────
  'nad-plus': {
    partner_compound_id: 'REPLACE_WITH_NAD_COMPOUND_ID',
    name: 'NAD+ Injection',
    default_directions: 'Inject subcutaneously as directed by your provider.',
    default_quantity: 1,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley Longevity Program - NAD+',
    disease_id: null, // Discuss with MDI — may need wellness-specific ICD
    category: 'longevity'
  },

  'sermorelin': {
    partner_compound_id: 'REPLACE_WITH_SERMORELIN_COMPOUND_ID',
    name: 'Sermorelin',
    default_directions: 'Inject subcutaneously at bedtime as directed by your provider.',
    default_quantity: 1,
    default_days_supply: 30,
    default_refills: 2,
    pharmacy_notes: 'Freeley Longevity Program - Sermorelin',
    disease_id: null,
    category: 'longevity'
  }
};

// ── Pharmacy Configuration ───────────────────────────────────
// Replace with your actual pharmacy IDs from the MDI Admin Panel.
// MDI uses different pharmacy IDs for staging vs production.
const PHARMACIES = {
  // Your 503A compounding pharmacy
  default: parseInt(process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),

  // Optional: different pharmacies per product category
  'weight-loss': parseInt(process.env.MDI_WEIGHTLOSS_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'sexual-wellness': parseInt(process.env.MDI_ED_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'hair-loss': parseInt(process.env.MDI_HAIR_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10),
  'longevity': parseInt(process.env.MDI_LONGEVITY_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10)
};

/**
 * Get the pharmacy ID for a given product.
 */
function getPharmacyId(productKey) {
  const product = PRODUCTS[productKey];
  if (!product) return PHARMACIES.default;
  return PHARMACIES[product.category] || PHARMACIES.default;
}

module.exports = {
  PRODUCTS,
  PHARMACIES,
  getPharmacyId
};
