import { test, expect } from '@playwright/test';

// Scope: src/pages/checkout.astro form flow + src/pages/waitlist.astro signup.
//
// Explicitly out of scope (per task brief, do not touch/fix, only flag if relevant):
// - checkout.astro's processPayment() is a known fake ~2s setTimeout with zero
//   Stripe/Authorize.Net network call. We assert that fact (no processor
//   network traffic) rather than try to make it real.
// - pricing.astro's Monthly/Quarterly toggle is known-broken; not touched here.
// - netlify.toml's coming-soon catch-all gate is a launch config decision, not
//   exercised by these tests (it doesn't run in `astro dev` anyway).

test.describe('Checkout — fake payment flow (checkout.astro)', () => {
  async function fillValidCheckoutForm(page: import('@playwright/test').Page) {
    await page.fill('#pt-first-name', 'Jane');
    await page.fill('#pt-last-name', 'Doe');
    await page.fill('#pt-dob', '1990-01-01');
    await page.selectOption('#pt-gender', '2');
    await page.fill('#pt-address', '123 Main St');
    await page.fill('#pt-city', 'Miami');
    await page.fill('#pt-state', 'FL');
    await page.fill('#pt-zip', '33101');
    await page.fill('#pt-email', 'jane.doe@example.com');
    await page.fill('#pt-phone', '5551234567');
    await page.fill('#an-card-name', 'Jane Doe');
    await page.fill('#an-card-number', '4111111111111111');
    await page.fill('#an-exp', '1230');
    await page.fill('#an-cvc', '123');
    await page.fill('#an-zip', '33101');
  }

  test('checkout button stays disabled until the consent checkbox is checked', async ({ page }) => {
    await page.goto('/checkout');
    const btn = page.locator('#checkout-btn');
    await expect(btn).toBeDisabled();

    await page.check('#consent-check');
    await expect(btn).toBeEnabled();

    await page.uncheck('#consent-check');
    await expect(btn).toBeDisabled();
  });

  test('submitting a filled, consented form shows the fake processing spinner, then redirects — and no real payment-processor network call is ever made', async ({ page }) => {
    await page.goto('/checkout');
    await fillValidCheckoutForm(page);
    await page.check('#consent-check');

    const requestsDuringSubmit: string[] = [];
    page.on('request', (req) => requestsDuringSubmit.push(req.url()));

    await page.click('#checkout-btn');

    // Fake "processing" UI state (processPayment's ~2s setTimeout).
    const spinner = page.locator('#checkout-spinner');
    await expect(spinner).toBeVisible();
    await expect(spinner).toContainText('Processing your payment');
    await expect(page.locator('#checkout-btn')).toBeDisabled();

    // No error banner while "processing".
    await expect(page.locator('#payment-errors')).toBeHidden();

    // The fake flow redirects home with a client-fabricated transaction id —
    // there is no real Stripe/Authorize.Net call anywhere in this journey,
    // despite the page displaying Authorize.Net branding, "256-bit SSL",
    // "HIPAA compliant" and "PCI Level 1" badges next to the card fields.
    await page.waitForURL(/[?&]payment=success/, { timeout: 5000 });

    const processorCalls = requestsDuringSubmit.filter((u) =>
      /stripe\.com|authorize\.net|anet\.com/i.test(u),
    );
    expect(processorCalls).toEqual([]);

    // The "pi" in the URL and the sessionStorage receipt are both just
    // `TXN-${Date.now()}`, generated entirely client-side — not an id issued
    // by any payment gateway.
    const url = new URL(page.url());
    const pi = url.searchParams.get('pi');
    expect(pi).toMatch(/^TXN-\d+$/);

    const stored = await page.evaluate(() => sessionStorage.getItem('freeley_transaction'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).transactionId).toBe(pi);

    // The homepage must acknowledge the purchase instead of rendering as if
    // nothing happened.
    const banner = page.locator('#order-confirmation');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(pi as string);
  });

  test('submitting with required fields empty blocks the fake payment instead of proceeding', async ({ page }) => {
    await page.goto('/checkout');
    await page.check('#consent-check');
    await page.click('#checkout-btn');

    const errorBox = page.locator('#patient-info-error');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('Please fill in all required fields');

    // Should not have entered the fake "processing" state.
    await expect(page.locator('#checkout-spinner')).toBeHidden();
    expect(page.url()).toContain('/checkout');
  });
});

test.describe('Waitlist — signup form (waitlist.astro)', () => {
  test('valid email joins the waitlist: RPC succeeds, data-joined flips, success message shows, and GA4/Whop conversion pixels attempt to fire', async ({ page }) => {
    await page.goto('/waitlist');

    const email = `e2e-${Date.now()}@example.com`;
    await page.fill('#email', email);

    const rpcResponse = page.waitForResponse(
      (res) => res.url().includes('/rest/v1/rpc/join_waitlist'),
      { timeout: 10000 },
    );
    // GA4 is live (analytics.js) and fires `gtag('event','sign_up', ...)` on
    // successful join; the Whop pixel fires `whop.track('lead')`. Meta Pixel
    // uses a placeholder id in analytics.js, so fbq is never installed —
    // intentionally not asserted here.
    const gaRequest = page.waitForRequest(
      (req) => /google-analytics\.com|analytics\.google\.com/.test(req.url()),
      { timeout: 10000 },
    );
    const whopRequest = page.waitForRequest(
      (req) => req.url().includes('t.whop.tw'),
      { timeout: 10000 },
    );

    await page.click('#submit-btn');

    const [rpc] = await Promise.all([rpcResponse, gaRequest, whopRequest]);
    expect(rpc.ok()).toBeTruthy();

    await expect(page.locator('body')).toHaveAttribute('data-joined', 'true');
    await expect(page.locator('.success h2')).toHaveText("You're on the list.");
    await expect(page.locator('#waitlist-form')).toBeHidden();
  });

  test('invalid email is rejected client-side and never joins', async ({ page }) => {
    await page.goto('/waitlist');
    await page.fill('#email', 'not-an-email');
    await page.click('#submit-btn');

    const msg = page.locator('#msg');
    await expect(msg).toHaveText('Please enter a valid email address.');
    await expect(page.locator('body')).not.toHaveAttribute('data-joined', 'true');
  });
});
