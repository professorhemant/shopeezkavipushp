const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log('Navigating...');
    await page.goto('https://frontend-production-34b0.up.railway.app/billing/invoices/create', { waitUntil: 'networkidle', timeout: 40000 });
    await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_invoice.png' });
    const headers = await page.evaluate(() => Array.from(document.querySelectorAll('th')).map(e => e.textContent.trim()));
    console.log('Headers:', JSON.stringify(headers));
  } catch(e) { console.error('Error:', e.message); }
  await browser.close();
  console.log('Done');
})();
