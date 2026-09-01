/**
 * Freeley Product Configuration
 *
 * Maps Freeley's product keys to MDI offering/compound IDs.
 *
 * ⚠️ OFFERING CHANGES REQUIRE MDI MEDICAL REVIEW FIRST (2026-08-21 go-live):
 * Any addition or edit to an offering must be submitted to MDI and approved
 * by their medical review (typically 5–7 business days) BEFORE the new
 * offering_id / questionnaire_id is wired in here. Code follows approval,
 * never the other way around. See docs/MDI_GO_LIVE_OPERATIONS.md §5.
 *
 * UPDATED 2026-09-01: MDI re-created every DTP offering on 2026-05-27/28 (the 2026-04-21 UUIDs
 * below were all soft-deleted on 2026-05-28). Offering UUIDs re-synced from GET /v1/partner/offerings
 * (active=true only). Two products have NO active offering anymore — see glutathione-troche and
 * hair-women-under45. NOTE: the MDI_OFFERING_* Netlify env vars set on 2026-04-04 held the
 * original (pre-DTP, now deleted) UUIDs and silently overrode these fallbacks — they were removed
 * from Netlify the same day. Only set one of those env vars with an ACTIVE offering UUID.
 *
 * UPDATED 2026-05-06: MDI rebuilt all offerings as Direct-to-Pharmacy (DTP)
 * compounds tied to Strive Pharmacy on 2026-04-21. All original 4/3/26
 * offerings are now INACTIVE. Semaglutide and Tirzepatide are now dose-tiered.
 *
 * Intake associations from MDI mapping spreadsheet (2026-05-06).
 *     Partner ID: f81508d1-3c53-4849-a636-1e9050a68e00
 *     API Credentials stored in Netlify env vars: MDI_CLIENT_ID, MDI_CLIENT_SECRET
 *
 * UPDATED 2026-05-06: Switched from deprecated /v1/patient/patients endpoint
 * to /v1/partner/tests/vouchers/{partner} (creates patient + encounter in one call).
 * Auth endpoint: POST /v1/partner/auth/token (NOT /oauth/token). Requires scope.
 * Each product now carries its MDI questionnaire_id (intake form UUID).
 */

// ── MDI Questionnaire IDs (from Partner Portal → Questionnaires) ──
// Retrieved via GET /v1/partner/questionnaires on 2026-05-07
const QUESTIONNAIRE_IDS = {
  // Weight Loss
  'PERS-NEW/INITIAL-Semaglutide':      process.env.MDI_QUESTIONNAIRE_SEMA              || 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d',
  'PERS-NEW/INITIAL-Tirzepatide':      process.env.MDI_QUESTIONNAIRE_TIRZ              || '6a2a9f59-da27-495f-8ae6-e1f0203b1693',
  // Longevity
  'NAD+ Injection':                    process.env.MDI_QUESTIONNAIRE_NAD_INJ            || 'f3c247d5-9c9a-473b-a813-46e8d96dcfcc',
  'Sermorelin INJECTION':              process.env.MDI_QUESTIONNAIRE_SERMORELIN_INJ     || '0c7cc2e5-3cab-4d00-861b-a185c8c7534d',
  'Sermorelin Oral':                   process.env.MDI_QUESTIONNAIRE_SERMORELIN_ORAL    || '6c017f64-2003-43f5-a9e2-70edc45a9779',
  'Sermorelin Nasal Spray':            process.env.MDI_QUESTIONNAIRE_SERMORELIN_NASAL   || '15347393-f6ac-4de8-9df9-d17668688334',
  'Glutathione Medical Form':          process.env.MDI_QUESTIONNAIRE_GLUT_TROCHE        || '46b72995-1283-437f-b1c6-88e39bb75769',
  'Glutathione INJECTION INTAKE':      process.env.MDI_QUESTIONNAIRE_GLUT_INJ           || '909332c3-8d98-4d51-83de-6876c2b21e09',
  // Hair Loss
  'Minoxidil/Finasteride/Biotin':      process.env.MDI_QUESTIONNAIRE_HAIR_MEN           || '41b11b51-e34a-44ca-8c5e-ef55143b489b',
  'Minoxidil/Dutasteride':             process.env.MDI_QUESTIONNAIRE_HAIR_WOMEN_45      || '216e49e4-09b5-4cb6-b1c2-93375d75dcac',
  'Min/Spiro/Biotin':                  process.env.MDI_QUESTIONNAIRE_HAIR_WOMEN_U45     || '57cdb9de-d40f-40a6-8eea-603f238fd1e3',
  'GHK-Cu':                           process.env.MDI_QUESTIONNAIRE_GHK_CU             || 'e79bf378-05a9-47e5-bff6-cf92a9199785',
  // Sexual Wellness
  'ED Initial':                        process.env.MDI_QUESTIONNAIRE_ED_INITIAL         || 'd384fb1d-4217-4f87-9877-40c283e34f48',
  'TADALAFIL/OXYTOCIN/PT-141':         process.env.MDI_QUESTIONNAIRE_OLYMPUS            || '0ce92a4d-d479-4e01-82ec-03c364cdad1f',
  'OXYTOCIN/PT-141':                   process.env.MDI_QUESTIONNAIRE_OLYMPUS_NO_TAD     || '38f85c79-7d25-46f4-afd1-eae54d91b446'
};

const PRODUCTS = {

  // ── Weight Loss: Semaglutide (5 dose tiers) ────────────────
  'semaglutide-s1': {
    offering_id: process.env.MDI_OFFERING_SEMA_S1 || 'ca2635ad-0532-465f-8741-36c3938a76ff',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Semaglutide'],
    name: 'Semaglutide/Glycine/B12 (0.2mg)',
    mdi_offering_name: 'DTP-S1-Semaglutide 5mg/Glycine 5mg/B12 1mg/mL (0.2mg)',
    intake: 'PERS new / initial sema & refill',
    formula: '5mg/5mg/1mg/mL',
    dose_tier: 'S1',
    dose_mg: 0.2,
    default_directions: 'Inject 4 units (0.04 mL) subcutaneously once weekly',
    default_quantity: 0.5,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'semaglutide-s2': {
    offering_id: process.env.MDI_OFFERING_SEMA_S2 || 'b07b20b7-eb03-4782-9891-6adb4fd4f431',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Semaglutide'],
    name: 'Semaglutide/Glycine/B12 (0.4mg)',
    mdi_offering_name: 'DTP-S2-Semaglutide 5mg/Glycine 5mg/B12 1mg/mL (0.4mg)',
    intake: 'PERS new / initial sema & refill',
    formula: '5mg/5mg/1mg/mL',
    dose_tier: 'S2',
    dose_mg: 0.4,
    default_directions: 'Inject 8 units (0.08 mL) subcutaneously once weekly',
    default_quantity: 0.5,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'semaglutide-s3': {
    offering_id: process.env.MDI_OFFERING_SEMA_S3 || '513aadc1-c464-42df-82cc-22daaf382273',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Semaglutide'],
    name: 'Semaglutide/Glycine/B12 (0.9mg)',
    mdi_offering_name: 'DTP-S3-Semaglutide 5mg/Glycine 5mg/B12 1mg/mL (0.9mg)',
    intake: 'PERS new / initial sema & refill',
    formula: '5mg/5mg/1mg/mL',
    dose_tier: 'S3',
    dose_mg: 0.9,
    default_directions: 'Inject 18 units (0.18 mL) subcutaneously once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'semaglutide-s4': {
    offering_id: process.env.MDI_OFFERING_SEMA_S4 || '2e17c3ce-a892-4405-83d3-a943c7d2870f',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Semaglutide'],
    name: 'Semaglutide/Glycine/B12 (1.5mg)',
    mdi_offering_name: 'DTP-S4-Semaglutide 5mg/Glycine 5mg/B12 1mg/mL (1.5mg)',
    intake: 'PERS new / initial sema & refill',
    formula: '5mg/5mg/1mg/mL',
    dose_tier: 'S4',
    dose_mg: 1.5,
    default_directions: 'Inject 30 units (0.3 mL) subcutaneously once weekly',
    default_quantity: 2.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'semaglutide-s5': {
    offering_id: process.env.MDI_OFFERING_SEMA_S5 || '832e5ec2-48bc-4559-837e-3f20f16d2354',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Semaglutide'],
    name: 'Semaglutide/Glycine/B12 (2.2mg)',
    mdi_offering_name: 'DTP-S5-Semaglutide 5mg/Glycine 5mg/B12 1mg/mL (2.2mg)',
    intake: 'PERS new / initial sema & refill',
    formula: '5mg/5mg/1mg/mL',
    dose_tier: 'S5',
    dose_mg: 2.2,
    default_directions: 'Inject 44 units (0.44 mL) subcutaneously once weekly',
    default_quantity: 2.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  // ── Weight Loss: Tirzepatide (6 dose tiers) ────────────────
  'tirzepatide-t1': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T1 || '6cdf60f0-a0f6-4b49-af38-c016b01eab0c',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (2mg)',
    mdi_offering_name: 'DTP- T1 (2mg)Tirzepatide 10mg/Glycine 5mg/B12 500mcg/mL 1mL vial',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T1',
    dose_mg: 2,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'tirzepatide-t2': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T2 || '04cf6d56-59db-4182-b487-fd8ba30ca1e9',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (4mg)',
    mdi_offering_name: 'DTP-T2, (4mg) Tirzepatide/Glycine/B12 10mg/5mg/500mcg/ml 2mL Vial',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T2',
    dose_mg: 4,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'tirzepatide-t3': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T3 || '3c50f30e-fda5-4380-9397-6ab3d86a2bb4',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (7mg)',
    mdi_offering_name: 'DTP- T3, (7mg) Tirzepatide/Glycine/B12 10mg + 5mg + 500mcg/ml 3ml (vial)',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T3',
    dose_mg: 7,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'tirzepatide-t4': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T4 || '80dee8f3-5aed-47ee-9a7d-6421ca2da4fb',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (9mg)',
    mdi_offering_name: 'DTP-T4, (9mg) Tirzepatide/Glycine/B12 10mg/5mg/500mcg/ml 4mL Vial',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T4',
    dose_mg: 9,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'tirzepatide-t5': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T5 || '750dc838-110d-4e19-888a-5ad2243e8eea',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (12mg)',
    mdi_offering_name: 'DTP-T5, (12mg)INJ Tirzepatide/Glycine/B12 10mg/5mg/500mcg/ml 3mL Vial',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T5',
    dose_mg: 12,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  'tirzepatide-t6': {
    offering_id: process.env.MDI_OFFERING_TIRZ_T6 || '1b02d8b9-94ef-40e0-956e-09ebe5890e1e',
    questionnaire_id: QUESTIONNAIRE_IDS['PERS-NEW/INITIAL-Tirzepatide'],
    name: 'Tirzepatide/Glycine/B12 (14mg)',
    mdi_offering_name: 'DTP-T6, (14mg) INJ Tirzepatide/Glycine/B12 10mg/5mg/500mcg/ml 3mL Vial',
    intake: 'PERS new / initial tirzep & refill',
    formula: '10mg/5mg/500mcg/mL',
    dose_tier: 'T6',
    dose_mg: 14,
    default_directions: 'Inject as directed by your provider once weekly',
    default_quantity: 1.0,
    default_days_supply: 30,
    default_refills: 0,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'weight-loss',
    icd10: 'E66.9'
  },

  // ── Longevity / Cellular Health ──────────────────────────────
  'nad-plus': {
    offering_id: process.env.MDI_OFFERING_NAD_PLUS || '4f422913-713e-486b-87cd-de816b52c395',
    questionnaire_id: QUESTIONNAIRE_IDS['NAD+ Injection'],
    name: 'NAD+',
    mdi_offering_name: 'DTP-NAD+',
    intake: 'NAD+ injection',
    formula: '200 mg/mL',
    default_directions: 'Inject 25 units (50 mg) subcutaneously weekly for 2 weeks, then increase by 25 units every 2 weeks',
    default_quantity: 10,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  // NOTE: NAD+ Sublingual Tablet not in new DTP offerings — confirm with MDI if discontinued

  'sermorelin-injectable': {
    offering_id: process.env.MDI_OFFERING_SERMORELIN_INJ || '550a9bc4-262b-4fd0-8268-45893c9cabba',
    questionnaire_id: QUESTIONNAIRE_IDS['Sermorelin INJECTION'],
    name: 'Sermorelin Acetate (Injectable)',
    mdi_offering_name: 'DTP-Injectable-Sermorelin Acetate 1 MG/ML 9ML VIAL',
    intake: 'Sermorelin INJECTION Intake Form',
    formula: '1 MG/ML 9ML VIAL',
    default_directions: 'Inject 15 to 30 units (0.15 to 0.3 mL) subcutaneously nightly on an empty stomach 5 out of 7 days per week',
    default_quantity: 1,
    default_days_supply: 90,
    default_refills: 3,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  'sermorelin-troche': {
    offering_id: process.env.MDI_OFFERING_SERMORELIN_TROCHE || 'ac4f703d-8f10-4166-b598-2ef1d78185e1',
    questionnaire_id: QUESTIONNAIRE_IDS['Sermorelin Oral'],
    name: 'Sermorelin Acetate (Troche)',
    mdi_offering_name: 'DTP-Sermorelin Acetate (Troche) 600mcg',
    intake: 'Semorelin Oral',
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
    offering_id: process.env.MDI_OFFERING_SERMORELIN_NASAL || 'd7a5f026-3612-45bc-940c-45fa7035ed56',
    questionnaire_id: QUESTIONNAIRE_IDS['Sermorelin Nasal Spray'],
    name: 'Sermorelin (Nasal Spray)',
    mdi_offering_name: 'DTP-Sermorelin (Nasal Spray) 1000 mcg/mL',
    intake: 'Sermorelin Nasal Spray',
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
    // ⚠️ 2026-09-01: MDI deleted every Glutathione Troche offering (72125ba1… on 2026-05-28) and
    // the 'Glutathione medical form' questionnaire has NO offering attached. A case can still be
    // created from the questionnaire (physician adds the product), but nothing is pre-attached.
    // Ask MDI to re-activate / attach the DTP troche offering, then put its UUID here.
    offering_id: process.env.MDI_OFFERING_GLUT_TROCHE || null,
    offering_unavailable_reason: 'No active Glutathione Troche offering in MDI (deleted 2026-05-28)',
    questionnaire_id: QUESTIONNAIRE_IDS['Glutathione Medical Form'],
    name: 'Glutathione (Troche)',
    mdi_offering_name: 'DTP - Glutathione (Troche) 250 mg',
    intake: 'Glutathione Medical Form',
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

  // NOTE: Glutathione Nasal Spray not in new DTP offerings — confirm with MDI if discontinued

  'glutathione-injectable': {
    offering_id: process.env.MDI_OFFERING_GLUT_INJ || '241b8f33-95cb-435c-a216-fced87e1e523',
    questionnaire_id: QUESTIONNAIRE_IDS['Glutathione INJECTION INTAKE'],
    name: 'Glutathione (Injectable) 90-day',
    mdi_offering_name: 'DTP - 90d, Glutathione (Injectable) 200mg/mL',
    intake: 'Glutathione INJECTION INTAKE form',
    formula: '200 mg/mL',
    default_directions: 'Inject 200 mg (1 mL) intramuscularly or subcutaneously one to two times weekly OR 100 mg (0.5 mL) IM or SC every other day',
    default_quantity: 30,
    default_days_supply: 90,
    default_refills: 3,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'longevity',
    icd10: null
  },

  // ── Hair Loss ────────────────────────────────────────────────
  'hair-men': {
    offering_id: process.env.MDI_OFFERING_HAIR_MEN || 'a107b534-04e3-4281-9659-3f47a3c0483c',
    questionnaire_id: QUESTIONNAIRE_IDS['Minoxidil/Finasteride/Biotin'],
    name: 'Cedar Hair Growth Tablet',
    mdi_offering_name: 'DTP-Cedar Hair Growth Tablet',
    intake: 'Minoxidil / Finasteride /Biotin (Men & Women)',
    formula: 'Biotin 5 mg / Finasteride 1 mg / Minoxidil 2.5 mg',
    default_directions: 'Take one tablet by mouth one time daily with or without food',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L64.9'
  },

  'hair-biotin-fin-min': {
    offering_id: process.env.MDI_OFFERING_HAIR_BIOTIN_FIN_MIN || '312e12b4-a240-4726-8125-ebbb09b05a9f',
    questionnaire_id: QUESTIONNAIRE_IDS['Minoxidil/Finasteride/Biotin'],
    name: 'Biotin 5 mg / Finasteride 1 mg / Minoxidil 2.5 mg',
    mdi_offering_name: 'DTP-Biotin 5 mg / Finasteride 1 mg / Minoxidil 2.5 mg',
    intake: 'Minoxidil / Finasteride /Biotin (Men & Women)',
    formula: 'Biotin 5 mg / Finasteride 1 mg / Minoxidil 2.5 mg',
    default_directions: 'Take one tablet by mouth one time daily with or without food',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L64.9'
  },

  'hair-women-45plus': {
    offering_id: process.env.MDI_OFFERING_HAIR_WOMEN_45 || '9d9a1d25-dd5d-4922-a120-c09cbfbd53a1',
    questionnaire_id: QUESTIONNAIRE_IDS['Minoxidil/Dutasteride'],
    name: 'Ivy Hair Tablet (Women 45+)',
    mdi_offering_name: 'DTP- Ivy Hair Tablet (Women 45+)-Minoxidil 1 mg / Dutasteride 0.4 mg with Biotin',
    intake: 'Minoxidil / Dutasteride',
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
    // ⚠️ 2026-09-01: MDI deleted both Willow offerings (33d4987c… and 6cdd8faa… on 2026-05-28) and
    // the 'Min/Spiro/Biotin (WOMEN)' questionnaire has NO offering attached. The case is still
    // created from the questionnaire so the physician reviews it, but no product is pre-attached.
    // Ask MDI to re-activate / attach the DTP Willow offering, then put its UUID here.
    offering_id: process.env.MDI_OFFERING_HAIR_WOMEN_U45 || null,
    offering_unavailable_reason: 'No active Willow offering in MDI (deleted 2026-05-28)',
    questionnaire_id: QUESTIONNAIRE_IDS['Min/Spiro/Biotin'],
    name: 'Willow Hair Tablet (Women <45)',
    mdi_offering_name: 'DTP- Willow Hair Tablet Minoxidil 1 mg / Spironolactone 60 mg with Biotin (Women less than 45)',
    intake: 'Min / Spiro / Biotin',
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
    offering_id: process.env.MDI_OFFERING_HAIR_TOPICAL || '4e7eb943-e710-4bd6-8777-0eac4aa26a7f',
    questionnaire_id: QUESTIONNAIRE_IDS['GHK-Cu'],
    name: 'VitalPeptide Hair Therapy (GHK-Cu 3%)',
    mdi_offering_name: 'DTP- VitalPeptide Hair Therapy -GHK-Cu-3%',
    intake: 'GHK-Cu',
    formula: 'GHK-Cu 3%',
    default_directions: 'Apply 1 mL (15-20 drops) to affected scalp areas once daily. Massage into scalp, leave on 4-6 hours before washing.',
    default_quantity: 50,
    default_days_supply: 35,
    default_refills: 11,
    dispense_unit: 'Milliliter',
    pharmacy: 'Strive Pharmacy',
    category: 'hair-loss',
    icd10: 'L65.9',
    // HOLD: GHK-Cu cannot be marketed until cleared by FDA per LegitScript
    // healthcare merchant certification compliance. Removed from website.
    // MDI has it as a DTP offering but we block submissions until FDA clears it.
    _hold: true,
    _hold_reason: 'GHK-Cu pending FDA clearance — LegitScript compliance hold'
  },

  // ── Sexual Wellness ──────────────────────────────────────────
  'tadalafil-daily': {
    offering_id: process.env.MDI_OFFERING_TADALAFIL_DAILY || '79dabb66-0870-4b28-92ac-b5f8c0a1be80',
    questionnaire_id: QUESTIONNAIRE_IDS['ED Initial'],
    name: 'Tadalafil (Daily Use)',
    mdi_offering_name: 'DTP Tadalafil 5 mg Sublingual Flex Dose',
    intake: 'ED & Refill',
    formula: '5 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue daily',
    default_quantity: 30,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  },

  'tadalafil-prn': {
    offering_id: process.env.MDI_OFFERING_TADALAFIL_PRN || '5550c2e3-8fd1-46ee-bdd3-5025a6f16015',
    questionnaire_id: QUESTIONNAIRE_IDS['ED Initial'],
    name: 'Tadalafil (As Needed)',
    mdi_offering_name: 'DTP - Tadalafil 20mg',
    intake: 'Erectile Dysfunction & ED refill',
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
    offering_id: process.env.MDI_OFFERING_OLYMPUS_PEAK || 'f69710e9-4992-400e-8823-53a052226ab1',
    questionnaire_id: QUESTIONNAIRE_IDS['TADALAFIL/OXYTOCIN/PT-141'],
    name: 'Olympus Peak (Oxytocin/Bremelanotide/Tadalafil)',
    mdi_offering_name: 'DTP-Olympus Peak Oxytocin -20 IU / Bremelanotide 1 mg / Tadalafil 20 mg',
    intake: 'TADALAFIL/OXYTOCIN/PT-141',
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
    offering_id: process.env.MDI_OFFERING_OLYMPUS_MAX || 'cb66152f-6344-49e4-bb53-4dd70235b584',
    questionnaire_id: QUESTIONNAIRE_IDS['TADALAFIL/OXYTOCIN/PT-141'],
    name: 'Olympus Max Peak (Oxytocin/Bremelanotide/Tadalafil)',
    mdi_offering_name: 'DTP-Olympus Max Peak-Oxytocin 40 IU / Bremelanotide 2 mg / Tadalafil 20 mg',
    intake: 'TADALAFIL/OXYTOCIN/PT-141',
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
    offering_id: process.env.MDI_OFFERING_OLYMPUS || 'e657028f-73b6-4e88-9d03-03ecc5e0c3fc',
    questionnaire_id: QUESTIONNAIRE_IDS['OXYTOCIN/PT-141'],
    name: 'Olympus (Oxytocin/Bremelanotide - No Tadalafil)',
    mdi_offering_name: 'DTP-Olympus Oxytocin- 20 IU / Bremelanotide 1 mg',
    intake: 'Oxy / PT-141',
    formula: 'Oxytocin 20 IU / Bremelanotide 1 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'F52.0'
  },

  'olympus-plus': {
    offering_id: process.env.MDI_OFFERING_OLYMPUS_PLUS || '216d4a5f-1d6f-49b6-b38c-06ef1c5fa6df',
    questionnaire_id: QUESTIONNAIRE_IDS['TADALAFIL/OXYTOCIN/PT-141'],
    name: 'Olympus Plus (Oxytocin/Bremelanotide/Tadalafil Low Dose)',
    mdi_offering_name: 'DTP-Olympus Plus Oxytocin 20 IU / Bremelanotide 1 mg / Tadalafil 5 mg',
    intake: 'TADALAFIL/OXYTOCIN/PT-141',
    formula: 'Oxytocin 20 IU / Bremelanotide 1 mg / Tadalafil 5 mg',
    default_directions: 'Dissolve 1/4 to 1 sublingual flex-dose tablet under the tongue 30 minutes prior to sexual activity',
    default_quantity: 8,
    default_days_supply: 30,
    default_refills: 11,
    dispense_unit: 'Tablet',
    pharmacy: 'Strive Pharmacy',
    category: 'sexual-wellness',
    icd10: 'N52.9'
  }

  // ── Discontinued / Not in new DTP offerings ─────────────────
  // The following were in the original 4/3/26 offerings but have NO active DTP replacement:
  //   - NAD+ (Sublingual Tablet) — old UUID: 34fa8d35-b171-4015-98b3-25432afded7e
  //   - Glutathione (Nasal Spray) — old UUID: a164ec04-00ee-49b5-9356-5735958a082c
  //   - Vast (Apomorphine/Tadalafil/Vardenafil) — old UUID: 90bb95bb-c6b6-43ab-ab84-3cca9caf2fd4
  //   - ARB Topical A5FD — never had a UUID
  // Confirm with MDI (Erica/Ray Ann) if these will be added as DTP offerings
};

// ── Dose Tier Lookup Helpers ────────────────────────────────
// Maps generic product key + dose to the correct tiered offering
const SEMAGLUTIDE_TIERS = {
  0.2:  'semaglutide-s1',
  0.4:  'semaglutide-s2',
  0.9:  'semaglutide-s3',
  1.5:  'semaglutide-s4',
  2.2:  'semaglutide-s5'
};

const TIRZEPATIDE_TIERS = {
  2:  'tirzepatide-t1',
  4:  'tirzepatide-t2',
  7:  'tirzepatide-t3',
  9:  'tirzepatide-t4',
  12: 'tirzepatide-t5',
  14: 'tirzepatide-t6'
};

// ── Vertical-key resolution helpers ──────────────────────────
// The checkout/quiz flow sends coarse treatment keys ('weight-loss',
// 'hair-loss', 'longevity', 'sexual-wellness' — pricing.json's vocabulary)
// plus whatever clinical context it has. These map that onto a specific
// PRODUCTS key so MDI gets a real offering/questionnaire.

/** Whole years between dateOfBirth and today; null when missing/unparseable. */
function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Female only when we can positively tell. checkout.astro's `pt-gender` select
 * uses "1"=Male, "2"=Female, "9"=Prefer not to say; the quiz stores free text
 * ("Male"/"Female"/"Woman"). Anything else falls through to male.
 */
function isDeclaredMale(sex) {
  if (sex == null) return false;
  const s = String(sex).trim().toLowerCase();
  return s.startsWith('m') || s === '1';
}

// Compound aliases that are not themselves PRODUCTS keys.
const LONGEVITY_COMPOUND_ALIASES = {
  'nad': 'nad-plus',
  'nad+': 'nad-plus',
  'sermorelin': 'sermorelin-injectable',
  'sermorelin-oral': 'sermorelin-troche',
  'glutathione': 'glutathione-troche'
};

/**
 * Resolve a product key, handling legacy single-key lookups for dose-tiered products
 * and the coarse per-vertical keys the checkout sends.
 *
 * Second argument accepts either a bare dose (legacy call sites) or a context
 * object { dose, compound, sex, dateOfBirth }.
 */
function resolveProductKey(productKey, ctxOrDose) {
  const ctx = (ctxOrDose && typeof ctxOrDose === 'object') ? ctxOrDose : { dose: ctxOrDose };
  const dose = ctx.dose;
  const compound = ctx.compound == null ? '' : String(ctx.compound).trim().toLowerCase();

  // Direct match — return as-is
  if (PRODUCTS[productKey]) return productKey;

  // Legacy 'semaglutide' key → resolve to tier by dose or default to S1
  if (productKey === 'semaglutide') {
    if (dose && SEMAGLUTIDE_TIERS[dose]) return SEMAGLUTIDE_TIERS[dose];
    return 'semaglutide-s1'; // Default starting dose
  }

  // Legacy 'tirzepatide' key → resolve to tier by dose or default to T1
  if (productKey === 'tirzepatide') {
    if (dose && TIRZEPATIDE_TIERS[dose]) return TIRZEPATIDE_TIERS[dose];
    return 'tirzepatide-t1'; // Default starting dose
  }

  // ── Vertical: weight loss → the compound's dose tier ──
  if (productKey === 'weight-loss') {
    const molecule = (compound === 'tirzepatide' || compound === 'tirz') ? 'tirzepatide' : 'semaglutide';
    return resolveProductKey(molecule, { dose });
  }

  // ── Vertical: hair loss → Cedar (men) / Ivy (women 45+) / Willow (women <45) ──
  // Never resolves to 'hair-topical' (_hold: GHK-Cu FDA/LegitScript) or
  // 'hair-biotin-fin-min' (near-duplicate of hair-men, not in the live branding).
  if (productKey === 'hair-loss') {
    // Cedar (hair-men) contains finasteride — teratogenic, contraindicated for
    // anyone who could be a woman of childbearing age. Only route there on an
    // EXPLICIT male declaration. "Prefer not to say" (checkout's <select>
    // value "9"), a missing field, or any other unrecognized value is treated
    // the same conservative way as an unknown age below — safety-first
    // default, not a guess. MDI's physician still reviews before prescribing.
    if (isDeclaredMale(ctx.sex)) return 'hair-men';
    const age = computeAge(ctx.dateOfBirth);
    // Age unknown → the 45+ formula, the conservative default (no spironolactone).
    return age != null && age < 45 ? 'hair-women-under45' : 'hair-women-45plus';
  }

  // ── Vertical: longevity ──
  if (productKey === 'longevity') {
    if (PRODUCTS[compound] && PRODUCTS[compound].category === 'longevity') return compound;
    if (LONGEVITY_COMPOUND_ALIASES[compound]) return LONGEVITY_COMPOUND_ALIASES[compound];
    // ASSUMPTION(business): checkout has no longevity compound picker yet, so the
    // compound is usually missing and only the standard/premium plan tier is known.
    // Mapping premium → NAD+ and standard/missing → injectable Sermorelin.
    // CLIENT TO CONFIRM which offering an un-specified longevity order should create.
    return compound === 'premium' ? 'nad-plus' : 'sermorelin-injectable';
  }

  // ── Vertical: sexual wellness / ED ──
  if (productKey === 'sexual-wellness' || productKey === 'ed') {
    if (PRODUCTS[compound] && PRODUCTS[compound].category === 'sexual-wellness') return compound;
    // ASSUMPTION(business): mirrors create-authnet-transaction.js's premiumCompounds
    // split (olympus/olympus-plus/olympus-peak/olympus-max are the premium tier).
    // Premium → Olympus, standard/missing → daily Tadalafil.
    // CLIENT TO CONFIRM the intended default for an un-specified ED order.
    return compound === 'premium' ? 'olympus' : 'tadalafil-daily';
  }

  return null; // Unknown product
}

// ── Pharmacy Configuration ───────────────────────────────────
// Strive Pharmacy is now directly linked to all DTP offerings in the MDI portal.
// DTP offerings carry their pharmacy inside MDI, so no pharmacy_id is sent on the
// voucher. `parseInt` of a non-numeric placeholder used to yield NaN — normalise to 0.
const _pharmacyId = (() => { const n = parseInt(process.env.MDI_STRIVE_PHARMACY_ID || process.env.MDI_DEFAULT_PHARMACY_ID || '0', 10); return Number.isFinite(n) ? n : 0; })();
const PHARMACIES = {
  default:          _pharmacyId,
  'weight-loss':    _pharmacyId,
  'longevity':      _pharmacyId,
  'hair-loss':      _pharmacyId,
  'sexual-wellness': _pharmacyId
};

function getPharmacyId(productKey) {
  const resolved = resolveProductKey(productKey);
  const product = PRODUCTS[resolved || productKey];
  if (!product) return PHARMACIES.default;
  return PHARMACIES[product.category] || PHARMACIES.default;
}

module.exports = { PRODUCTS, PHARMACIES, QUESTIONNAIRE_IDS, getPharmacyId, resolveProductKey, computeAge, SEMAGLUTIDE_TIERS, TIRZEPATIDE_TIERS };
