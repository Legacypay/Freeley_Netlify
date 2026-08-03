import { test, expect } from '@playwright/test';

// Site-wide tracking script PRESENCE on page load: GA4, Clarity (via
// analytics.js), Whop pixel, and first-touch attribution capture
// (attribution.js). Both scripts are injected via astro.config.mjs
// `head-inline` on every Astro page (see LOAD_TRACKING_SCRIPTS /
// WHOP_PIXEL there) — this only spot-checks 3 representative pages, not
// all 18. SUBMIT-time conversion events (sign_up/Lead) are covered by
// checkout-and-waitlist.spec.ts, not here.
//
// analytics.js self-gates on paths containing 'quiz', 'checkout', or 'hub'
// (HIPAA compliance) — none of the pages below hit that gate.
const PAGES = ['/weight-loss', '/', '/waitlist'];

for (const path of PAGES) {
  test.describe(`tracking scripts on ${path}`, () => {
    test('analytics.js, attribution.js, GA4 and Whop pixel all load', async ({ page }) => {
      const [analyticsRes, attributionRes, gtagReq, whopReq] = await Promise.all([
        page.waitForResponse((res) => res.url().endsWith('/analytics.js')),
        page.waitForResponse((res) => res.url().endsWith('/attribution.js')),
        page.waitForRequest((req) => req.url().includes('googletagmanager.com/gtag/js')),
        page.waitForRequest((req) => req.url().includes('t.whop.tw')),
        page.goto(path),
      ]);

      expect(analyticsRes.status()).toBe(200);
      expect(attributionRes.status()).toBe(200);
      expect(gtagReq.url()).toContain('googletagmanager.com/gtag/js');
      expect(whopReq.url()).toContain('t.whop.tw');
    });

    test('window.FreeleyAttribution is defined and .get() returns an object', async ({ page }) => {
      await page.goto(path);
      // attribution.js delays its capture() by setTimeout(50) after
      // DOMContentLoaded so analytics.js can populate _ga/_fbp cookies first.
      await page.waitForFunction(() => typeof (window as any).FreeleyAttribution?.get === 'function');

      const result = await page.evaluate(() => (window as any).FreeleyAttribution.get());

      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('landing_path');
      expect(result).toHaveProperty('source_class');
    });
  });
}
