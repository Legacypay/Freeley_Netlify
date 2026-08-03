import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

// Loads every page in the inventory and fails if the browser logs a
// console.error or an uncaught page error. console.warn is deliberately
// NOT captured — Swiper's own "not enough slides for loop mode" warning is
// known, harmless noise and must not fail this suite.

for (const { name, path } of PAGES) {
  test(`no console errors on ${name} (${path})`, async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto(path, { waitUntil: 'load' });
    // Pages with the Tawk chat widget (about, pricing, how-it-works, blogs,
    // faqs, quality-trust, partner-pharmacies, index-backup) keep a
    // long-poll connection open and can sit below full network-idle
    // indefinitely — bound the wait instead of hanging the whole suite on a
    // third-party widget that will never go fully quiet.
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    expect(errors, `console/page errors on ${path}:\n${errors.join('\n')}`).toEqual([]);
  });
}
