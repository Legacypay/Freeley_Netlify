import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

test('no broken internal links or images across the site', async ({ page, request }) => {
  // 22 pages x (nav + lazy-image settle) comfortably clears the 30s default.
  test.setTimeout(120_000);

  // Every page in the inventory is itself checked as a link too (see the
  // request loop below) — that's what actually asserts each one loads.
  const hrefs = new Set<string>(PAGES.map((p) => p.path));
  const brokenImages: string[] = [];

  for (const { name, path } of PAGES) {
    await test.step(`crawl ${name} (${path})`, async () => {
      // domcontentloaded, not networkidle: third-party analytics/pixel beacons
      // (GA4, Whop, Meta) keep connections open and would stall networkidle.
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const pageHrefs = await page.locator('a[href^="/"]').evaluateAll((as) =>
        as.map((a) => a.getAttribute('href') ?? ''),
      );
      for (const href of pageHrefs) {
        const clean = href.split('#')[0].split('?')[0];
        if (clean) hrefs.add(clean);
      }

      // Native <img loading="lazy"> only starts fetching near the viewport —
      // scroll the page so every image has had a chance to load or fail.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const broken = await page.locator('img').evaluateAll((imgs) =>
        (imgs as HTMLImageElement[])
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src),
      );
      brokenImages.push(...broken.map((src) => `${path}: ${src}`));
    });
  }

  expect.soft(brokenImages, 'broken <img> found (naturalWidth === 0)').toEqual([]);

  for (const href of hrefs) {
    const res = await request.get(href);
    expect.soft(res.status(), `link ${href} returned ${res.status()}`).toBeLessThan(400);
  }
});
