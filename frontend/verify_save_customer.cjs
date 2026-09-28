const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  // Step 1: Login
  console.log('Step 1: Login...');
  await page.goto('https://frontend-production-34b0.up.railway.app/login', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="email"], input[type="email"], input[placeholder*="mobile"], input[name="email"]', 'admin@demo.com');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_login.png' });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  const afterLoginUrl = page.url();
  console.log('After login URL:', afterLoginUrl);
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_after_login.png' });
  
  if (afterLoginUrl.includes('login')) {
    console.log('LOGIN FAILED with admin@demo.com / Admin@123');
    await browser.close();
    return;
  }
  
  // Step 2: Navigate to Create Invoice
  console.log('Step 2: Navigate to create invoice...');
  await page.goto('https://frontend-production-34b0.up.railway.app/billing/invoices/create', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_create_invoice.png' });
  
  // Step 3: Type customer name and mobile
  const testName = 'VerifyTest_' + Date.now();
  const testMobile = '9876543210';
  console.log('Step 3: Typing customer name:', testName, 'mobile:', testMobile);
  
  // Find Customer Name input
  const custNameInput = await page.$('input[placeholder="Customer Name"]');
  if (!custNameInput) {
    console.log('ERROR: Customer Name input not found!');
    // list all inputs
    const inputs = await page.$$eval('input', els => els.map(e => ({ placeholder: e.placeholder, type: e.type, name: e.name })));
    console.log('Found inputs:', JSON.stringify(inputs));
    await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_no_input.png' });
    await browser.close();
    return;
  }
  await custNameInput.fill(testName);
  
  const mobileInput = await page.$('input[placeholder="Mobile Number"]');
  if (!mobileInput) {
    console.log('ERROR: Mobile Number input not found!');
    await browser.close();
    return;
  }
  await mobileInput.fill(testMobile);
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_filled.png' });
  
  // Step 4: Click Save Customer Data
  console.log('Step 4: Clicking Save Customer Data...');
  const saveBtn = await page.$('button:text("Save Customer Data")');
  if (!saveBtn) {
    console.log('ERROR: Save Customer Data button not found!');
    const btns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t));
    console.log('Found buttons:', JSON.stringify(btns));
    await browser.close();
    return;
  }
  
  // Intercept API calls
  const apiCalls = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('/customers')) {
      try {
        const body = await resp.json().catch(() => null);
        apiCalls.push({ url: resp.url(), status: resp.status(), body: JSON.stringify(body).slice(0, 200) });
      } catch {}
    }
  });
  
  await saveBtn.click();
  await page.waitForTimeout(2000);
  console.log('API calls after save:', JSON.stringify(apiCalls));
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_after_save.png' });
  
  // Step 5: Navigate to /customers and check
  console.log('Step 5: Navigating to /customers...');
  await page.goto('https://frontend-production-34b0.up.railway.app/customers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Search for the test customer
  const searchBox = await page.$('input[placeholder*="search"], input[placeholder*="Search"]');
  if (searchBox) {
    await searchBox.fill(testName.substring(0, 12));
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: 'C:/Users/hks26/Desktop/verify_customers_page.png' });
  
  const pageText = await page.textContent('body');
  const found = pageText.includes(testName) || pageText.includes('VerifyTest');
  const hasPhone = pageText.includes('9876543210');
  console.log('Customer found on page:', found);
  console.log('Phone found on page:', hasPhone);
  
  await browser.close();
  console.log('DONE');
})();
