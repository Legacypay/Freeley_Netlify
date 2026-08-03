import { test, expect, type Page } from '@playwright/test';

// src/components/QuizModal.astro — the shared assessment-quiz funnel used by
// all 9 vertical pages (weight-loss, hair-loss, sexual-wellness, longevity,
// pricing, etc). Exercised here via weight-loss.astro as a representative
// entry point: it's the same <dialog id="quizModal"> + public/quiz-scripts/asw.js
// on every page that imports the component, so nothing here is weight-loss
// specific except the page URL and step-1 option label.
//
// The modal fetches /assessment-quiz's markup on first open, clones
// `.quiz-popup` into `.qm__frame`, and injects asw.js once (see QuizModal.astro's
// `runQuiz()`). Every subsequent open reuses that cached template and calls
// `window.initFreeleyQuiz()` directly instead of re-adding the <script> tag —
// that's the fix for the double-click-binding bug this file regression-tests.

async function openQuizModal(page: Page) {
  await page.getByRole('button', { name: 'Start Assessment' }).click();
  const dialog = page.locator('#quizModal');
  await expect(dialog).toBeVisible();
  // Step 0 (hero) is injected async after fetch('/assessment-quiz') resolves;
  // its "Start" button only exists once runQuiz() has cloned the template in.
  await expect(dialog.locator('.quiz-step[data-step="0"] .quiz-start-btn')).toBeVisible();
  return dialog;
}

test.describe('Quiz assessment funnel (QuizModal.astro)', () => {
  test('opens from the header CTA and reaches step 1 (goal selection)', async ({ page }) => {
    await page.goto('/weight-loss');
    const dialog = await openQuizModal(page);

    await dialog.locator('.quiz-step[data-step="0"] .quiz-start-btn').click();

    const step1 = dialog.locator('.quiz-step[data-step="1"]');
    await expect(step1).toHaveClass(/active/);

    const goal = step1.locator('.option--item[data-product="weight loss"]');
    await goal.click();
    await expect(goal).toHaveClass(/active/);

    await step1.locator('.quiz-btn-primary').click();
    await expect(dialog.locator('.quiz-step[data-step="2"]')).toHaveClass(/active/);
  });

  test('opens from an a[href^="/assessment-quiz"] link', async ({ page }) => {
    await page.goto('/weight-loss');
    // "Check if I qualify" mid-page CTA — a real <a href="/assessment-quiz">
    // link, intercepted by QuizModal's click handler (progressive enhancement).
    // Not `.first()`: the first DOM match is the mobile nav's
    // `.navbar-mobile-cta`, `display: none` at desktop widths (style.css,
    // `.navbar-mobile { display: none !important }` above 1024px).
    await page.getByRole('link', { name: 'Check if I qualify' }).click();
    await expect(page.locator('#quizModal')).toBeVisible();
  });

  test('step 2 rejects an invalid email and accepts a valid one, then fires the save_funnel_lead RPC', async ({ page }) => {
    await page.goto('/weight-loss');
    const dialog = await openQuizModal(page);

    await dialog.locator('.quiz-step[data-step="0"] .quiz-start-btn').click();
    await dialog.locator('.quiz-step[data-step="1"] .option--item[data-product="weight loss"]').click();
    await dialog.locator('.quiz-step[data-step="1"] .quiz-btn-primary').click();

    const step2 = dialog.locator('.quiz-step[data-step="2"]');
    await expect(step2).toHaveClass(/active/);

    const email = step2.locator('#email');
    const phone = step2.locator('#phoneInput');
    const consent = step2.locator('#consent-check-step2');
    const continueBtn = step2.locator('.quiz-btn-primary');
    const error = step2.locator('#step2Error');

    // Invalid email: validateStep2AndGo() shows #step2Error and stays on step 2.
    await email.fill('not-an-email');
    await phone.fill('5551234567');
    await consent.check();
    await continueBtn.click();
    await expect(error).toHaveClass(/show/);
    await expect(step2).toHaveClass(/active/);

    // Valid email fixes it up and fires the real Supabase RPC on Continue.
    await email.fill('quiz-funnel-test@example.com');

    const rpcRequest = page.waitForRequest((req) =>
      req.url().includes('/rest/v1/rpc/save_funnel_lead')
    );
    await continueBtn.click();
    const request = await rpcRequest;
    const response = await request.response();
    expect([200, 204]).toContain(response?.status());

    await expect(dialog.locator('.quiz-step[data-step="3"]')).toHaveClass(/active/);
  });

  test('reopening the modal does not throw and does not double-select a multi-select option on one click', async ({ page }) => {
    await page.goto('/weight-loss');

    // First open/close.
    let dialog = await openQuizModal(page);
    await dialog.locator('.qm__close').click();
    await expect(dialog).not.toBeVisible();

    // Error listeners attach only after the first open/close: the page's own
    // hero/waitlist images 500 on astro dev's on-demand image endpoint
    // (unrelated, dev-server-only, see freeley-waitlist-gate memory) and would
    // otherwise be misattributed to the reopen this test actually cares about.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Reopen — QuizModal.astro's runQuiz() now takes the `window.initFreeleyQuiz`
    // branch (already-loaded asw.js) instead of re-injecting the <script> tag.
    dialog = await openQuizModal(page);
    await dialog.locator('.quiz-step[data-step="0"] .quiz-start-btn').click();

    const step1 = dialog.locator('.quiz-step[data-step="1"]');
    const goal = step1.locator('.option--item[data-product="weight loss"]');

    // Regression: a single click used to fire two bound listeners and toggle
    // .active on then back off, silently canceling the selection.
    await goal.click();
    await expect(goal).toHaveClass(/active/);
    await expect(step1.locator('.option--item.active')).toHaveCount(1);

    expect(errors, `console/page errors after reopen: ${errors.join('\n')}`).toHaveLength(0);
  });
});
