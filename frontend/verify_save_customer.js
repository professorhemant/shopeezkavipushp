const { chromium } = require('playwright');

(async () => {
  let browser;
  let page;
  
  try {
    // Try with existing Chrome user data to reuse session
    browser = await chromium.launchPersistentContext(
      'C:/Users/hks26/AppData/Local/Google/Chrome/User Data/Default',
      {
        headless: false,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions']
      }
    );
    const pages = browser.pages();
    page = pages[0] || await browser.newPage();
  } catch(e) {
    console.log('Chrome profile launch failed:', e.message);
    // Try bundled chromium
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
  }
  
  console.log('Navigating to create invoice page...');
  await page.goto('https://frontend-production-34b0.up.railway.app/billing/invoices/create', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const url = page.url();
  console.log('Current URL:', url);
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_step1.png' });
  console.log('Screenshot saved: verify_step1.png');
  
  await browser.close();
})();
