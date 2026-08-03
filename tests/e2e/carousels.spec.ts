import { test, expect, type Page } from '@playwright/test';

// All Swiper instances load the same swiper@11 UMD bundle from a CDN
// <script> tag and get `new Swiper(selector, {...})`'d with no `navigation`
// option anywhere in the codebase (grepped across src/pages) — there are no
// swiper-button-next/prev arrows on any of these pages. "Clicking next/prev"
// is therefore exercised through the instance API Swiper attaches to the
// container element (`el.swiper`), which is the same mechanism real touch
// drags and pagination clicks drive under the hood.

// This dev box's Sharp binary can't process any <Image>-derived asset, so
// every page in this repo currently logs `_image?href=... 500` (or a
// "MissingSharp" render failure on index-backup.astro specifically) — a
// known dev-only artifact, unrelated to Swiper. Filtered out so a genuine
// script error still fails these tests.
function isKnownDevImageNoise(text: string): boolean {
  return /_image\?href=|MissingSharp|status of (404|500)/i.test(text);
}

function collectUnexpectedErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isKnownDevImageNoise(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function expectInitialized(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toHaveClass(/swiper-initialized/);
}

async function expectSlideNextAdvances(page: Page, selector: string) {
  // Slides use slidesPerView:'auto' — force a narrow viewport so the cards
  // actually overflow and there is somewhere for slideNext() to go,
  // regardless of how many fit at the project's default viewport width.
  await page.setViewportSize({ width: 480, height: 900 });
  // Image-only slides (e.g. .wl-safety-swiper) sit way below the fold and
  // their <img> is loading="lazy" — undecoded, it has no intrinsic size,
  // so auto-width sizing measures 0 until the browser actually loads it
  // near the viewport. Scroll to it first, like a real visitor would.
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.locator(`${selector} .swiper-slide`).first().evaluate((slide) =>
    new Promise<void>((resolve) => {
      const check = () => (slide.getBoundingClientRect().width > 0 ? resolve() : requestAnimationFrame(check));
      check();
    }),
  );
  const { before, after } = await page.locator(selector).first().evaluate((el: any) => {
    // Swiper measured slide widths at the project's default viewport;
    // force it to re-measure against the just-resized viewport before
    // asking whether there's anywhere left to slide to.
    el.swiper.update();
    const start = el.swiper.activeIndex;
    el.swiper.slideNext();
    return { before: start, after: el.swiper.activeIndex };
  });
  expect(after).not.toBe(before);
}

test.describe('how-it-works — safety swiper (.wl-safety-swiper)', () => {
  test('initializes with no unexpected console error', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/how-it-works');
    await expectInitialized(page, '.wl-safety-swiper');
    expect(errors).toEqual([]);
  });

  test('slideNext advances the active slide', async ({ page }) => {
    await page.goto('/how-it-works');
    await expectInitialized(page, '.wl-safety-swiper');
    await expectSlideNextAdvances(page, '.wl-safety-swiper');
  });
});

test.describe('quality-trust — patient results swiper (.everything_managed .swiper)', () => {
  test('initializes with no unexpected console error', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/quality-trust');
    await expectInitialized(page, '.everything_managed .swiper');
    expect(errors).toEqual([]);
  });

  test('slideNext advances the active slide', async ({ page }) => {
    await page.goto('/quality-trust');
    await expectInitialized(page, '.everything_managed .swiper');
    await expectSlideNextAdvances(page, '.everything_managed .swiper');
  });
});

test.describe('index-backup — patient results swiper (.patient-results .swiper)', () => {
  test('initializes with no unexpected console error', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/index-backup');
    await expectInitialized(page, '.patient-results .swiper');
    expect(errors).toEqual([]);
  });

  test('slideNext advances the active slide', async ({ page }) => {
    await page.goto('/index-backup');
    await expectInitialized(page, '.patient-results .swiper');
    await expectSlideNextAdvances(page, '.patient-results .swiper');
  });
});

// This is the before/after transformation carousel — each slide shows a
// before/after image pair inline (class swiper_before_after transformation-
// slider). There is no separate drag-handle comparison widget on this page;
// the "before/after slider" in scope and this Swiper instance are the same
// element.
test.describe('index-backup — before/after transformation swiper (.transformation-slider.swiper)', () => {
  test('initializes with no unexpected console error', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/index-backup');
    await expectInitialized(page, '.transformation-slider.swiper');
    expect(errors).toEqual([]);
  });

  test('slideNext advances the active slide', async ({ page }) => {
    await page.goto('/index-backup');
    await expectInitialized(page, '.transformation-slider.swiper');
    await expectSlideNextAdvances(page, '.transformation-slider.swiper');
  });
});

// .brand--grid--hero--2 sits inside `<div class="featured-wrap block
// md:hidden">` — it's a mobile-only trust-logo strip, invisible at desktop
// widths by design. It needs a sub-md viewport to be present at all.
test.describe('index-backup — mobile trust-logo swiper (.brand--grid--hero--2.swiper)', () => {
  test('initializes with no unexpected console error on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = collectUnexpectedErrors(page);
    await page.goto('/index-backup');
    await expectInitialized(page, '.brand--grid--hero--2.swiper');
    expect(errors).toEqual([]);
  });

  test('slideNext advances the active slide', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index-backup');
    await expectInitialized(page, '.brand--grid--hero--2.swiper');
    const { before, after } = await page.locator('.brand--grid--hero--2.swiper').first().evaluate((el: any) => {
      el.swiper.update();
      const start = el.swiper.activeIndex;
      el.swiper.slideNext();
      return { before: start, after: el.swiper.activeIndex };
    });
    expect(after).not.toBe(before);
  });
});

// partner-pharmacies.astro and blogs.astro both run:
//   new Swiper('.everything_managed .swiper', {...})
//   new Swiper('.transformation-slider.swiper', {...})
// (byte-for-byte the same init block as quality-trust/index-backup) but
// neither page has ANY element matching those selectors anywhere in its
// markup (confirmed by reading the full source and by
// `document.querySelectorAll('.swiper').length === 0` live on both pages).
// The calls are silent no-ops — Swiper doesn't throw when its selector
// matches nothing, it just never initializes. The dead init calls (and the
// CDN script tag that only existed to support them) have been removed from
// both pages, so these selectors correctly match zero elements with no
// console errors.
test.describe('partner-pharmacies — carousel markup does not exist', () => {
  test('everything_managed swiper never initializes (no matching markup on page)', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/partner-pharmacies');
    await expect(page.locator('.everything_managed .swiper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('transformation-slider swiper never initializes (no matching markup on page)', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/partner-pharmacies');
    await expect(page.locator('.transformation-slider.swiper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('blogs — carousel markup does not exist', () => {
  test('everything_managed swiper never initializes (no matching markup on page)', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/blogs');
    await expect(page.locator('.everything_managed .swiper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('transformation-slider swiper never initializes (no matching markup on page)', async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    await page.goto('/blogs');
    await expect(page.locator('.transformation-slider.swiper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
