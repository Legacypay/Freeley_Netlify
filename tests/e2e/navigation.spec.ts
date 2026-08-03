import { test, expect } from '@playwright/test';

// Scope: Header.astro + Footer.astro on pages that actually import them.
// index.astro and compare.astro render their own inline chrome instead —
// out of scope here by design (see src/components/Header.astro / Footer.astro).
const PAGES = ['/weight-loss', '/pricing', '/about'];

// Mirrors the `nav` array in src/components/Header.astro.
const NAV_LINKS = [
  { label: 'GLP-1 Weight Loss', href: '/weight-loss' },
  { label: 'Hair Loss', href: '/hair-loss' },
  { label: 'Sexual Wellness', href: '/sexual-wellness' },
  { label: 'Longevity', href: '/longevity' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About Us', href: '/about' },
];

// Mirrors the footer link groups in src/components/Footer.astro.
const FOOTER_GROUPS = {
  Treatments: [
    { label: 'GLP-1 Weight Loss', href: '/weight-loss' },
    { label: 'Sexual Wellness', href: '/sexual-wellness' },
    { label: 'Hair Loss', href: '/hair-loss' },
    { label: 'Longevity & Peptides', href: '/longevity' },
  ],
  Company: [
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About Us', href: '/about' },
    { label: 'Partner Pharmacies', href: '/partner-pharmacies' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'HIPAA Notice', href: '/hipaa' },
    { label: 'Telehealth Consent', href: '/telehealth-consent' },
  ],
};

for (const path of PAGES) {
  test.describe(`Header + Footer on ${path}`, () => {
    test(`desktop nav shows all 7 links with correct hrefs`, async ({ page }) => {
      await page.goto(path);
      const nav = page.locator('nav.navbar-nav-custom');
      for (const { label, href } of NAV_LINKS) {
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
      }
    });

    test(`#start-assessment-header opens the quiz modal`, async ({ page }) => {
      await page.goto(path);
      const dialog = page.locator('#quizModal');
      await expect(dialog).not.toBeVisible();
      await page.click('#start-assessment-header');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('open', '');
    });

    test('footer link groups are present with correct hrefs', async ({ page }) => {
      await page.goto(path);
      const footer = page.locator('footer.foot');
      for (const [group, links] of Object.entries(FOOTER_GROUPS)) {
        const col = footer.locator('.foot__col', { has: page.getByRole('heading', { name: group, exact: true }) });
        for (const { label, href } of links) {
          await expect(col.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
        }
      }
    });
  });
}

test.describe('Mobile burger nav (weight-loss)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('burger toggles #siteNavMobile and flips aria-expanded', async ({ page }) => {
    await page.goto('/weight-loss');
    const burger = page.locator('#siteNavBurger');
    const mobileNav = page.locator('#siteNavMobile');

    await expect(page.locator('nav.navbar-nav-custom')).toBeHidden();
    await expect(burger).toBeVisible();
    await expect(mobileNav).toBeHidden();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    await burger.click();
    await expect(mobileNav).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');

    await burger.click();
    await expect(mobileNav).toBeHidden();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  test('mobile nav lists all links plus a real /assessment-quiz CTA link', async ({ page }) => {
    await page.goto('/weight-loss');
    await page.locator('#siteNavBurger').click();
    const mobileNav = page.locator('#siteNavMobile');
    for (const { label, href } of NAV_LINKS) {
      await expect(mobileNav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
    }
    await expect(mobileNav.getByRole('link', { name: /Start Assessment/ })).toHaveAttribute('href', '/assessment-quiz');
  });
});
