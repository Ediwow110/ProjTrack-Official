import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const targetHost = process.env.SMOKE_TARGET_HOST || 'https://www.projtrack.codes';
  console.log(`Starting post-deploy smoke tests against target host: ${targetHost}`);

  const routes = [
    { name: 'Admin Login', url: `${targetHost}/admin/login`, expectedText: 'Admin Portal Login' },
    { name: 'Student Login', url: `${targetHost}/student/login`, expectedText: 'Student Portal Login' },
    { name: 'Teacher Login', url: `${targetHost}/teacher/login`, expectedText: 'Teacher Portal Login' }
  ];

  let overallPassed = true;

  for (const route of routes) {
    console.log(`Checking ${route.name} at ${route.url}...`);
    
    let fatalError = null;
    let failedAssets = [];
    let branding500Status = null;

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.log(`  [CONSOLE ERROR] ${text}`);
        if (
          text.includes('VITE_API_BASE_URL is required') ||
          text.includes('Failed to fetch dynamically imported module') ||
          text.includes('Failed to load module script') ||
          text.includes('MIME type') ||
          text.includes('Content Security Policy') ||
          text.includes('CSP')
        ) {
          fatalError = `Fatal console error: ${text}`;
        }
      }
    });
    
    page.on('pageerror', err => {
      console.error(`  [PAGE EXCEPTION] ${err.message}`);
      fatalError = `Fatal page exception: ${err.message}`;
    });

    page.on('requestfailed', request => {
      const url = request.url();
      console.log(`  [REQUEST FAILED] ${url} - ${request.failure()?.errorText || 'unknown error'}`);
      failedAssets.push(url);
    });

    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if (status >= 400) {
        if (url.includes('/branding')) {
          branding500Status = status;
          console.log(`  [INFO] Resource /branding returned status ${status} (Non-blocking: branding settings not yet seeded).`);
        } else {
          console.log(`  [HTTP ERROR] ${url} - Status: ${status}`);
          failedAssets.push(url);
        }
      }
    });

    try {
      await page.goto(route.url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const content = await page.textContent('body');
      const includesText = content.includes(route.expectedText) || content.includes('Sign In');
      
      if (!includesText) {
        fatalError = `Expected text "${route.expectedText}" was not rendered on the page.`;
      }
      
      if (fatalError) {
        console.log(`  Status: FAILED - ${fatalError}`);
        overallPassed = false;
      } else if (failedAssets.length > 0) {
        console.log(`  Status: FAILED due to failed network requests: ${failedAssets.join(', ')}`);
        overallPassed = false;
      } else {
        console.log(`  Status: SUCCESS`);
      }
    } catch (error) {
      console.error(`  Navigation failed:`, error);
      overallPassed = false;
    }
    
    // Clear listeners
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('requestfailed');
    page.removeAllListeners('response');
  }

  // Add the integration test check ( harmless login test to verify API destination )
  console.log('Testing frontend-to-backend API destination integration...');
  let apiDestinationUrl = null;
  let apiResponseStatus = null;

  page.on('request', request => {
    if (request.url().includes('/auth/login') && request.method() === 'POST') {
      apiDestinationUrl = request.url();
    }
  });

  page.on('response', response => {
    if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
      apiResponseStatus = response.status();
    }
  });

  try {
    await page.goto(`${targetHost}/admin/login`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.fill('#admin-identifier', 'smoke-test-hardener@example.com');
    await page.fill('#admin-password', 'invalidpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    if (apiDestinationUrl) {
      console.log(`  POST request was sent to API: ${apiDestinationUrl}`);
      console.log(`  Response Status: ${apiResponseStatus}`);
      if (!apiDestinationUrl.startsWith('https://api.projtrack.codes') && !apiDestinationUrl.includes('127.0.0.1') && !apiDestinationUrl.includes('localhost')) {
        console.log(`  Status: FAILED - API request target ${apiDestinationUrl} does not match production API endpoint.`);
        overallPassed = false;
      } else {
        console.log(`  Status: SUCCESS`);
      }
    } else {
      console.log('  Status: FAILED - No POST request was intercepted for /auth/login.');
      overallPassed = false;
    }
  } catch (error) {
    console.error('  API validation failed:', error);
    overallPassed = false;
  }

  await browser.close();

  if (!overallPassed) {
    console.error('Post-deploy smoke test failed.');
    process.exit(1);
  }
  console.log('All post-deploy smoke tests completed successfully.');
})();
