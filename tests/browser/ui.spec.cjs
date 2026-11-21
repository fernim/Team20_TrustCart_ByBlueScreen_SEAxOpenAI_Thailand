const { test, expect } = require('@playwright/test');

test('shopper search, language, sort, cart, and native keyboard dialog', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search').fill('headphones');
  await page.locator('#search').press('Enter');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.locator('#language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.product-card .product-open').click();
  await expect(page.locator('#product-dialog')).toBeVisible();
  await page.locator('#quantity').fill('2');
  await page.locator('#add-to-cart').click();
  await expect(page.locator('#cart-count')).toHaveText('2');
  // Wait for focus to return to the product opener before moving to the cart.
  await expect(page.locator('.product-card .product-open')).toBeFocused();
  await page.locator('#open-cart').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cart-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cart-dialog')).not.toBeVisible();
  await expect(page.locator('#open-cart')).toBeFocused();
  await page.locator('#open-cart').click();
  await page.locator('[data-remove]').click();
  await expect(page.locator('.cart-item')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#clear-filters').click();
  await page.locator('#sort').selectOption('price-low');
  // Seller listings from the end-to-end scenario have no price yet.
  await expect(page.locator('.product-card .price').filter({ hasText: /^฿/ }).first()).toHaveText('฿49');
});

test('closing the product dialog preserves focus moved to the cart', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search').fill('headphones');
  await page.locator('#search').press('Enter');
  await page.locator('.product-card .product-open').click();
  await expect(page.locator('#product-dialog')).toBeVisible();

  const keptFocus = await page.locator('#add-to-cart').evaluate((button) => new Promise((resolve) => {
    const dialog = document.querySelector('#product-dialog');
    const cart = document.querySelector('#open-cart');
    dialog.addEventListener('close', () => resolve(document.activeElement === cart), { once: true });
    button.click();
    cart.focus();
  }));
  expect(keptFocus).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#cart-dialog')).toBeVisible();
});

test('seller creates, corrects, and reloads a listing; reviewer reads its audit', async ({ page }) => {
  await page.goto('/seller');
  const title = `Browser listing ${test.info().project.name}`;
  await page.locator('#listing-title').fill(title);
  await page.locator('#listing-description').fill('guaranteed for everyone');
  await page.locator('#submit-listing').click();
  await expect(page.locator('#seller-result')).toContainText('DENIED');
  await expect(page.locator('#seller-result code')).toHaveCount(0);
  await page.locator('#listing-description').fill('Sample product description. \u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c\u0e40\u0e2a\u0e23\u0e34\u0e21\u0e2d\u0e32\u0e2b\u0e32\u0e23');
  await expect(page.locator('#seller-result')).toBeEmpty();
  await page.locator('#submit-listing').click();
  await expect(page.locator('#seller-result')).toContainText('APPROVED');
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('trustcart-demo-reports'))[0]);
  await page.reload();
  await page.locator('.seller-product-row').filter({ hasText: title }).click();
  await expect(page.locator('#listing-title')).toHaveValue(title);
  await expect(page.locator('#seller-result')).toContainText('APPROVED');
  await page.goto(`/reviewer?id=${saved.id}`);
  await expect(page.locator('#reviewer-report')).toContainText(saved.id);
  await expect(page.locator('.reviewer-trace')).toBeVisible();
  const hashes = page.locator('.reviewer-trace details').first();
  await hashes.locator('summary').click();
  await expect(hashes.locator('code').last()).toBeVisible();
  await page.goto('/');
  const card = page.locator(`[data-product="${saved.productId}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.product-verified')).toBeVisible();
  await card.locator('.product-verified').click();
  await expect(page.locator('#product-status-dialog')).toBeVisible();
});

test('seller saves drafts and handles the native unsaved-change confirmation', async ({ page }) => {
  await page.goto('/seller');
  await page.locator('#listing-title').fill('Unsaved browser draft');
  await page.locator('#save-draft').click();
  await page.reload();
  await expect(page.locator('#listing-title')).toHaveValue('Unsaved browser draft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#new-product').click();
  await expect(page.locator('#listing-title')).toHaveValue('Unsaved browser draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#new-product').click();
  await expect(page.locator('#listing-title')).not.toHaveValue('Unsaved browser draft');
});

test('all pages load local styles, navigate, and fit the viewport', async ({ page }) => {
  for (const route of ['/', '/seller', '/reviewer']) {
    await page.goto(route);
    await expect(page.locator('.demo-views [aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main');
    await expect(page.locator('#main')).toBeAttached();
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
      stylesLoaded: [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => !!link.sheet) }));
    expect(layout.stylesLoaded).toBe(true);
    expect(layout.content).toBeLessThanOrEqual(layout.width + 1);
    const target = route === '/seller' ? '/reviewer' : '/seller';
    await page.locator(`.demo-views a[href="${target}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
  }
});

test('TrustCart branding and distinct marketplace hero are visible', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toContainText('TrustCart');
  await expect(page.locator('.trustcart-hero')).toBeVisible();
  await expect(page.locator('.brand-showcase')).not.toBeVisible();
  await expect(page.locator('.hero-banner img')).not.toBeVisible();
});

test('reference homepage brands and popular products retain working navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#brand-shops .brand-shop')).toHaveCount(8);
  await expect(page.locator('#popular-products .popular-product')).toHaveCount(6);
  await expect(page.locator('footer .demo-views a[href="/seller"]')).toHaveCount(1);
  await expect(page.locator('#brand-shops .product-verified')).toHaveCount(0);
  await page.locator('#popular-products .popular-product').first().click();
  await expect(page.locator('#product-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#popular-title')).toHaveText('Popular products');
  await expect(page.locator('.brand-showcase')).not.toBeVisible();
  const images = await page.locator('#brand-shops img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
  expect(images).toBe(true);
});

test('product detail gallery, stock controls and verified badge survive the Shopee-style layout', async ({ page, request }) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const images = [1, 2].map(index => 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, `../../frontend/assets/category-${index}.webp`)).toString('base64'));
  const listing = {title:`Detail layout ${test.info().project.name}`,description:'Product description\nSecond line. \u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c\u0e40\u0e2a\u0e23\u0e34\u0e21\u0e2d\u0e32\u0e2b\u0e32\u0e23',category:'supplement',registration_reference:'DEMO-001',product_name:'Demo Supplement',license_holder:'Demo Brand',price:'249.50',stock:3,images};
  const response = await request.post('/v1/products', {data:listing});
  expect(response.status()).toBe(201);
  const product = await response.json();
  await page.goto('/');
  await page.locator('#search').fill(listing.title);
  await page.locator('#search').press('Enter');
  await page.locator(`[data-product="${product.id}"] .product-open`).click();
  const detail = page.locator('#product-dialog');
  await expect(detail.locator('.product-purchase .detail-price')).toHaveText('฿249.5');
  await expect(detail.locator('.product-description-section')).toContainText('Second line.');
  await detail.locator('.product-thumbnails button').last().click();
  await expect(detail.locator('#gallery-position')).toHaveText('2 / 2');
  await expect(detail.locator('.product-gallery > img')).toHaveAttribute('src', images[1]);
  await detail.locator('#increase-quantity').click();
  await detail.locator('#increase-quantity').click();
  await expect(detail.locator('#quantity')).toHaveValue('3');
  await expect(detail.locator('#increase-quantity')).toBeDisabled();
  await detail.locator('#decrease-quantity').click();
  await expect(detail.locator('#quantity')).toHaveValue('2');
  await detail.locator('.product-verified').click();
  await expect(page.locator('#product-status-dialog')).toBeVisible();
  await expect(page.locator('#product-status-dialog')).not.toContainText('R-01');
  await page.keyboard.press('Escape');
  await expect(detail).toBeVisible();
  const bounds = await detail.evaluate(dialog => ({width:dialog.clientWidth, content:dialog.scrollWidth}));
  expect(bounds.content).toBeLessThanOrEqual(bounds.width + 1);
  await detail.locator('#add-to-cart').click();
  await expect(page.locator('#cart-count')).toHaveText('2');
  await page.locator(`[data-product="${product.id}"] .product-open`).click();
  await detail.locator('#detail-view-cart').click();
  await expect(page.locator('#cart-dialog')).toBeVisible();
  await expect(detail).not.toBeVisible();
  await page.keyboard.press('Escape');
  const edited = await request.put(`/v1/products/${product.id}`, {data:{...listing, expected_version:1, stock:0, description:'guaranteed for everyone'}});
  expect(edited.status()).toBe(200);
  await page.reload();
  await page.locator('#search').fill(listing.title);
  await page.locator('#search').press('Enter');
  await page.locator(`[data-product="${product.id}"] .product-open`).click();
  await expect(detail.locator('.product-verified')).toHaveCount(0);
  await expect(detail.locator('#add-to-cart')).toBeDisabled();
  await expect(detail.locator('#increase-quantity')).toBeDisabled();
});
