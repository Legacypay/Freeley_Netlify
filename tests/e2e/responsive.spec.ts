import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

// No-horizontal-overflow sweep across the full page inventory (see ./pages),
// run under the "mobile" Playwright project (Pixel 7 viewport — playwright.config.ts
// already scopes that project to this file via testMatch). +1px tolerates
// subpixel rounding, same convention as elsewhere in this suite.
async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `document.documentElement.scrollWidth (${scrollWidth}) overflows window.innerWidth (${innerWidth})`).toBeLessThanOrEqual(innerWidth + 1);
}

// Pages that render Header.astro (grep-verified: `import Header from` in
// src/pages/*.astro). index.astro, compare.astro, waitlist.astro, checkout.astro,
// assessment-quiz.astro and assessment-design-2.astro ship their own inline
// chrome instead and have no #siteNavBurger — same split navigation.spec.ts
// and tracking-pixels.spec.ts already document. The 4 legal pages (privacy,
// terms, hipaa, telehealth-consent) were converted from static public/*.html
// to real Astro routes on 2026-08-03 and now render the shared Header too.
const HEADER_PAGES = new Set([
  'about',
  'blogs',
  'faqs',
  'hair-loss',
  'hipaa',
  'how-it-works',
  'index-backup',
  'longevity',
  'partner-pharmacies',
  'pricing',
  'privacy',
  'quality-trust',
  'sexual-wellness',
  'telehealth-consent',
  'terms',
  'weight-loss',
]);

for (const { name, path } of PAGES) {
  test(`${name} (${path}): no horizontal overflow at mobile viewport`, async ({ page }, testInfo) => {
    // This sweep asserts against the Pixel 7 viewport/UA the "mobile" project
    // provides. playwright.config.ts already scopes "mobile" to this file via
    // testMatch, but "desktop" has no such restriction and would otherwise
    // also pick up this file at its 1280x720 default — skip there instead of
    // producing meaningless (or, for the burger test below, false-failing)
    // results under the wrong viewport.
    test.skip(testInfo.project.name !== 'mobile', 'mobile-viewport sweep — see playwright.config.ts projects');

    // 'load', not 'networkidle': the dev server this suite runs against
    // compiles each route on demand, and 22 pages hitting it in parallel
    // under 'networkidle' regularly starved out to ERR_CONNECTION_REFUSED /
    // 30s timeouts — a test-infra artifact, not a product bug. Layout is
    // CSS-driven and images carry explicit width/height (no post-load shift),
    // so 'load' is enough to assert on scrollWidth.
    await page.goto(path, { waitUntil: 'load' });
    await assertNoHorizontalOverflow(page);
  });

  if (HEADER_PAGES.has(name)) {
    test(`${name} (${path}): burger menu opens the mobile nav`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'mobile-viewport sweep — see playwright.config.ts projects');

      await page.goto(path);
      const burger = page.locator('#siteNavBurger');
      const mobileNav = page.locator('#siteNavMobile');

      await expect(burger).toBeVisible();
      await expect(mobileNav).toBeHidden();

      await burger.click();
      await expect(mobileNav).toBeVisible();
    });
  }
}

// Tablet-width (768px) spot-check. Only one dedicated mobile project exists
// in playwright.config.ts (Pixel 7 / 412px), so this runs under "desktop"
// (Desktop Chrome) resized manually instead of adding a second project.
// 4 representative pages, not the full inventory: a page with Header.astro
// (weight-loss), the standalone prototype homepage with its own chrome
// (home), a form-heavy standalone page (checkout — layout only, the fake
// payment flow itself is out of scope), and a data-dense page (pricing).
const TABLET_PAGES = [
  { name: 'home', path: '/' },
  { name: 'weight-loss', path: '/weight-loss' },
  { name: 'checkout', path: '/checkout' },
  { name: 'pricing', path: '/pricing' },
];

test.describe('tablet width (768px)', () => {
  for (const { name, path } of TABLET_PAGES) {
    test(`${name} (${path}): no horizontal overflow at 768px`, async ({ page }, testInfo) => {
      // Runs on "desktop" (Desktop Chrome) resized down, not "mobile" — the
      // Pixel 7 project already covers 412px; this checks the gap in between.
      test.skip(testInfo.project.name !== 'desktop', 'tablet spot-check — see playwright.config.ts projects');

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(path, { waitUntil: 'load' });
      await assertNoHorizontalOverflow(page);
    });
  }
});
