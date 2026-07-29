const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Login first
  await page.goto('https://frontend-production-34b0.up.railway.app/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'C:/Users/hks26/AppData/Local/Temp/verify_01_login.png', fullPage: false });

  // Fill login
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill('test@test.com');
  await passInput.fill('password123');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/hks26/AppData/Local/Temp/verify_02_after_login.png', fullPage: false });
  console.log('Page after login:', page.url());
  await browser.close();
})();
