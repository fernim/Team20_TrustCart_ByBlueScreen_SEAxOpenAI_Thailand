const {test,expect}=require('@playwright/test');
async function login(page,role='reviewer'){
 await page.goto('/login');await page.locator('#username').selectOption(role);await page.locator('#password').fill(process.env['TRUSTCART_'+role.toUpperCase()+'_PASSWORD']);await page.locator('button[type=submit]').click();await expect(page).toHaveURL(role==='reviewer'?/\/(agency|reviewer)$/:/\/seller$/);
}
test('Agency dashboard filters, languages and mobile layout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);await page.goto('/agency');await expect(page.locator('#queue-loading')).toBeHidden();
 await page.locator('#agency-language').selectOption('en');await expect(page.locator('h1')).toHaveText('Marketplace verification');
 await page.locator('[data-marketplace="lazada"]').click();await expect(page.locator('#queue-empty')).toBeVisible();await expect(page.locator('#queue-empty')).toContainText('No Lazada submissions');
 await page.locator('[data-queue="completed"]').click();await expect(page).toHaveURL(/work_queue=completed/);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('[data-marketplace="lazada"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#clear-filters').click();await expect(page.locator('[data-queue="all"]')).toHaveAttribute('aria-current','page');
 await page.locator('#agency-language').selectOption('th');await expect(page.locator('h1')).toContainText('การตรวจสอบ');
 await page.locator('#agency-language').focus();await expect(page.locator('#agency-language')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('agency-dashboard.png'),fullPage:true});expect(errors).toEqual([]);
});
