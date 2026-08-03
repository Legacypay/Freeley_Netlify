import { test, expect } from '@playwright/test';

// .faq-item accordion pattern, toggled by public/style/script.js:
//   click .faq-question -> item.classList.toggle('open')  (and closes any other open item)
// Answer visibility is driven purely by CSS from the 'open' class:
//   - hair-loss / longevity / pricing / sexual-wellness / weight-loss ("wl-page" style):
//     .faq-answer { grid-template-rows: 0fr } -> .faq-item.open .faq-answer { grid-template-rows: 1fr }
//   - index-backup ("homepage" style, public/style/style.css):
//     .faq-answer { display: none } -> .faq-item.open .faq-answer { display: block }
const PAGES = [
  '/hair-loss',
  '/index-backup',
  '/longevity',
  '/pricing',
  '/sexual-wellness',
  '/weight-loss',
];

for (const path of PAGES) {
  test(`FAQ accordion opens and closes on ${path}`, async ({ page }) => {
    await page.goto(path);

    // index-backup ships its first FAQ pre-opened; pick the first item that
    // starts closed so every page runs the same open -> close cycle. Resolve
    // it to a fixed position (.nth) up front — a live `:not(.open)` locator
    // would stop matching its own element the instant it opens.
    const items = page.locator('.faq-item');
    const startIndex = await items.evaluateAll((els) =>
      els.findIndex((el) => !el.classList.contains('open'))
    );
    const item = items.nth(startIndex);
    await expect(item).toBeVisible();

    const question = item.locator('.faq-question');
    const answer = item.locator('.faq-answer');

    await expect(item).not.toHaveClass(/open/);
    await expect(answer).not.toBeVisible();

    await question.click();
    await expect(item).toHaveClass(/open/);
    await expect(answer).toBeVisible();

    await question.click();
    await expect(item).not.toHaveClass(/open/);
    await expect(answer).not.toBeVisible();
  });
}
