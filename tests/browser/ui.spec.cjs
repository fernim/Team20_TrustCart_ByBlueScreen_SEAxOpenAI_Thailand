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
  // Native dialog close restores focus asynchronously before the next action.
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

test('seller creates, corrects, and reloads a listing; reviewer reads its audit', async ({ page }) => {
  await page.goto('/seller');
  const title = `Browser listing ${test.info().project.name}`;
  await page.locator('#listing-title').fill(title);
  await page.locator('#listing-description').fill('guaranteed for everyone');
  await page.locator('#submit-listing').click();
  await expect(page.locator('#seller-result')).toContainText('DENIED');
  await expect(page.locator('#seller-result code')).toHaveCount(0);
  await page.locator('#listing-description').fill('Sample product description.');
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
