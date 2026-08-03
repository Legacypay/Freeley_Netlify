import { test, expect } from '@playwright/test';

// Medication toggle on each vertical page: two/three buttons with
// [data-medication] inside .medication-toggle. Clicking the inactive one
// must update .product-title, .product-current-price, the main product
// image src, and move .active-medication onto the clicked button.
//
// Data below is read directly from each page's source (src/pages/*.astro)
// and its driver script (public/assets/js/*.js) — not guessed. Per-page
// scope note: hair-loss and longevity ship 3 medications, sexual-wellness
// ships 2; every page still gets exactly one toggle test as scoped.

const pages = [
  {
    name: 'weight-loss',
    url: '/weight-loss',
    imgId: '#mainProductImage',
    from: {
      medication: 'semaglutide',
      title: 'Compounded Semaglutide',
      price: '$199*',
      img: '/assets/wl/semag.png',
    },
    to: {
      medication: 'tirzepatide',
      title: 'Compounded Tirzepatide',
      price: '$299*',
      img: '/assets/wl/tirzz.png',
    },
  },
  {
    // FIXED: hl-script.js's hairMedicationData used to ship the identical
    // 5-image array for cedar/ivy/willow, so the lead photo never changed.
    // Cedar now leads with product2.png (its real Finasteride bottle), Willow
    // already led with product1.png (its real Spironolactone bottle), and Ivy
    // — which has no bottle asset for its actual drug (Dutasteride) — now
    // leads with the neutral product3.png instead of colliding with Willow's
    // product1.png.
    name: 'hair-loss',
    url: '/hair-loss',
    imgId: '#mainProductImageHair',
    from: {
      medication: 'cedar',
      title: 'Cedar Hair Growth Tablet',
      price: '$89.00',
      img: '/assets/hl/product2.png',
    },
    to: {
      medication: 'ivy',
      title: 'Ivy Hair Tablet (Women 45+)',
      price: '$89.00',
      img: '/assets/hl/product3.png',
    },
  },
  {
    // FIXED: sw-script.js's swProductData used to ship the identical
    // 5-image array for tadalafil/olympus, so the photo never changed.
    // Olympus now leads with the neutral product5.png instead of
    // duplicating tadalafil's product1.png.
    name: 'sexual-wellness',
    url: '/sexual-wellness',
    imgId: '#mainProductImageSW',
    from: {
      medication: 'tadalafil',
      title: 'Tadalafil',
      price: '$99.00',
      img: '/assets/sw/product1.png',
    },
    to: {
      medication: 'olympus',
      title: 'Olympus',
      price: '$139.00',
      img: '/assets/sw/product5.png',
    },
  },
  {
    name: 'longevity',
    url: '/longevity',
    imgId: '#mainProductImageL',
    from: {
      medication: 'sermorelin',
      title: 'Build Your Peptide Protocol',
      price: '$129',
      img: '/assets/l/sermorelin.jpeg',
    },
    to: {
      medication: 'nad',
      title: 'NAD+ Peptide Therapy',
      price: '$189',
      img: '/assets/l/nad+.png',
    },
  },
];

for (const p of pages) {
  test(`${p.name}: medication toggle updates title, price, image, and active state`, async ({ page }) => {
    await page.goto(p.url);

    const fromBtn = page.locator(`.medication-toggle .btn[data-medication="${p.from.medication}"]`);
    const toBtn = page.locator(`.medication-toggle .btn[data-medication="${p.to.medication}"]`);
    const title = page.locator('.product-title');
    const price = page.locator('.product-current-price');
    const img = page.locator(p.imgId);

    // Initial state, as rendered by the page's init() before any click.
    await expect(fromBtn).toHaveClass(/active-medication/);
    await expect(toBtn).not.toHaveClass(/active-medication/);
    await expect(title).toHaveText(p.from.title);
    await expect(price).toHaveText(p.from.price);
    await expect(img).toHaveAttribute('src', p.from.img);

    await toBtn.click();

    // wl/hl/sw/longevity scripts fade the image out over 200ms before
    // swapping src — wait for the swap instead of asserting immediately.
    await expect(img).toHaveAttribute('src', p.to.img);
    await expect(toBtn).toHaveClass(/active-medication/);
    await expect(fromBtn).not.toHaveClass(/active-medication/);
    await expect(title).toHaveText(p.to.title);
    await expect(price).toHaveText(p.to.price);
  });
}

// hair-loss ships a third option (Willow) that the from/to loop above never
// exercises — this is exactly the pair (Ivy vs. Willow) whose identical
// image arrays let the "photo never changes" bug hide undetected.
test('hair-loss: Willow (third toggle option) shows a different lead image than Ivy', async ({ page }) => {
  await page.goto('/hair-loss');

  const img = page.locator('#mainProductImageHair');
  await page.locator('.medication-toggle .btn[data-medication="ivy"]').click();
  const ivyImg = await img.getAttribute('src');

  await page.locator('.medication-toggle .btn[data-medication="willow"]').click();
  await expect(img).not.toHaveAttribute('src', ivyImg ?? '');
  await expect(page.locator('.product-title')).toHaveText('Willow Hair Tablet (Women Under 45)');
});
