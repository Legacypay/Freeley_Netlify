import { test, expect } from '@playwright/test';

// Real HTTP calls to the actual submitQuiz.js Netlify Function, running under
// `netlify dev` with the site's real MDI credentials injected (see
// playwright.functions.config.ts). Every voucher created here hits the real
// MDI API but MUST come back demo:true — see docs/MDI_TESTING.md.
//
// NOTE ON SCOPE: as of 2026-08-25, no page under src/ or public/ actually calls
// this endpoint — QuizModal.astro's funnel (public/quiz-scripts/asw.js) redirects
// to /checkout, and checkout.astro's processPayment() is a fully fake, client-only
// flow (see tests/e2e/checkout-and-waitlist.spec.ts) with zero backend calls.
// So this suite tests the backend contract directly, not a browser journey —
// there is currently no live page path that reaches MDI to test through the UI.

const FN = '/.netlify/functions/submitQuiz';

function testPatient(overrides: { product?: string; dose?: number; patient?: Record<string, unknown> } = {}) {
  const { patient, ...rest } = overrides;
  return {
    product: 'semaglutide-s1', // not on regulatory hold, has a questionnaire_id (lib/products.js)
    ...rest,
    patient: {
      first_name: 'Playwright',
      last_name: 'MDITest',
      email: `mdi-test-${Date.now()}@example.com`,
      ...patient,
    },
  };
}

test.describe('submitQuiz → MDI voucher creation (real API, safe-by-default test mode)', () => {
  test('OPTIONS preflight returns 204', async ({ request }) => {
    const res = await request.fetch(FN, { method: 'OPTIONS' });
    expect(res.status()).toBe(204);
  });

  test('GET is rejected with 405', async ({ request }) => {
    const res = await request.get(FN);
    expect(res.status()).toBe(405);
  });

  test('missing patient data is rejected with 400', async ({ request }) => {
    const res = await request.post(FN, { data: { product: 'semaglutide-s1' } });
    expect(res.status()).toBe(400);
  });

  test('unknown product key is rejected with 400', async ({ request }) => {
    const res = await request.post(FN, { data: testPatient({ product: 'not-a-real-product' }) });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid product/i);
  });

  test(
    'a valid submission creates a REAL MDI voucher that MDI echoes back as demo:true (no patient/case created, not billable)',
    async ({ request }) => {
      const email = `mdi-test-${Date.now()}@example.com`;
      const res = await request.post(FN, { data: testPatient({ patient: { email } }) });

      expect(res.status(), await res.text()).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.voucher_id, 'MDI must return a voucher id (partner_voucher_id per docs)').toBeTruthy();
      expect(body.onboarding_url, 'MDI must return an onboarding_url').toContain('token=');

      // The two properties this whole test suite exists to prove:
      expect(body.is_test, 'submitQuiz must classify this order as TEST — MDI_ALLOW_LIVE_ORDERS is not set').toBe(true);
      expect(
        body.demo,
        'MDI must echo demo:true — if this is false/undefined, MDI silently ignored our demo flag and the ' +
          'voucher may be a REAL, billable encounter. Stop and investigate before creating more test orders.'
      ).toBe(true);
    }
  );

  test('a second valid submission with a different product/dose (tirzepatide) also comes back demo:true', async ({ request }) => {
    const res = await request.post(FN, {
      data: testPatient({ product: 'tirzepatide', dose: 4, patient: { email: `mdi-test-tirz-${Date.now()}@example.com` } }),
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.product).toBe('tirzepatide-t2'); // dose 4 → T2 per lib/products.js TIRZEPATIDE_TIERS
    expect(body.is_test).toBe(true);
    expect(body.demo).toBe(true);
  });
});
