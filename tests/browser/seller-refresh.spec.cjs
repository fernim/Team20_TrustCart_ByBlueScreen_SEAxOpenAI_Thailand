const { test, expect } = require('@playwright/test');

test('seller only refreshes products on explicit request and preserves unsaved edits', async ({ page }) => {
 let reads=0;
 page.on('request',request=>{if(new URL(request.url()).pathname==='/v1/seller/products'&&request.method()==='GET')reads++;});
 await page.clock.install();
 await page.goto('/login');await page.locator('#username').selectOption('seller1');await page.locator('button[type=submit]').click();await expect(page).toHaveURL(/\/seller$/);
 await expect(page.locator('#submit-listing')).toBeEnabled();await expect(page.locator('#plan-status')).not.toHaveText('');
 await page.locator('#listing-title').fill('Unsaved seller draft');
 await page.clock.fastForward(16000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('#listing-title')).toBeEnabled();await expect(page.locator('#listing-title')).toBeFocused();expect(reads).toBe(1);
 const user=await(await page.request.get('/v1/auth/me')).json();
 const title='Externally saved product '+Date.now();
 const created=await page.request.post('/v1/seller/products',{headers:{'X-CSRF-Token':user.csrf_token},data:{title,price:'129',stock:2}});expect(created.status()).toBe(201);
 await page.locator('#refresh-seller-products').click();await expect(page.locator('#seller-product-list')).toContainText(title);await expect(page.locator('#refresh-seller-products')).toBeEnabled();expect(reads).toBe(2);
 await expect(page.locator('#listing-title')).toHaveValue('Unsaved seller draft');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('seller-refresh.png'),fullPage:true});
});
