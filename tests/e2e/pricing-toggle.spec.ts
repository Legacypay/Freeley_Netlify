import { test, expect } from '@playwright/test';

// pricing.astro — Monthly/Quarterly billing-frequency toggle (`.wl-toggle`, ~line 269).
//
// KNOWN BUG (already diagnosed, out of scope to fix here): clicking "Quarterly"
// only swaps the `active-medication` class between the two pills
// (src/pages/pricing.astro ~line 559-565, the click handler is literally
// commented "visual only, no page state depends on it"). No price on the page
// — not the plan cards' `.wl-plancard__price .amt`, not the comparison table's
// `.price-cell`, not the savings calculator — reacts to it. There is also no
// quarterly price anywhere in the codebase (`Quarterly` elsewhere only means
// "quarterly lab monitoring", not billing).
//
// NEEDS_CLIENT_INPUT: the toggle can't be wired up without a decision — either
// remove it, or get real quarterly pricing to compute against. Until that
// decision lands this stays test.fixme() (never a plain failing assertion),
// so it documents the target behavior without blocking the suite.
test.fixme(
  'clicking Quarterly updates the displayed plan price',
  async ({ page }) => {
    await page.goto('/pricing');

    const firstPlanPrice = page.locator('.wl-plancard__price .amt').first();
    const monthlyPrice = (await firstPlanPrice.textContent())?.trim();

    await page.getByRole('button', { name: 'Quarterly' }).click();

    // Expected once real quarterly pricing exists: the displayed price changes
    // to reflect quarterly billing. Actual today: it stays byte-identical to
    // the Monthly price because nothing on the page listens for the toggle.
    await expect(firstPlanPrice).not.toHaveText(monthlyPrice ?? '');
  }
);
