import { chromium } from '@playwright/test';

const targetHost = process.env.SMOKE_TARGET_HOST || 'https://www.projtrack.codes';
const expectedApiHost = process.env.SMOKE_EXPECTED_API_HOST || 'https://api.projtrack.codes';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const routes = [
  { name: 'Admin Login', path: '/admin/login', expectedText: 'Admin Portal Login' },
  { name: 'Student Login', path: '/student/login', expectedText: 'Student Portal Login' },
  { name: 'Teacher Login', path: '/teacher/login', expectedText: 'Teacher Portal Login' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let overallPassed = true;

  console.log(`Starting post-deploy smoke tests against target host: ${targetHost}`);

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    for (const route of routes) {
      const url = `${targetHost}${route.path}`;
      console.log(`Checking ${route.name} at ${url} (${viewport.name} ${viewport.width}x${viewport.height})...`);

      let fatalError = null;
      const failedAssets = [];

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
        const failedUrl = request.url();
        console.log(`  [REQUEST FAILED] ${failedUrl} - ${request.failure()?.errorText || 'unknown error'}`);
        failedAssets.push(failedUrl);
      });

      page.on('response', response => {
        const responseUrl = response.url();
        const status = response.status();
        if (status >= 400) {
          if (responseUrl.includes('/branding')) {
            console.log(`  [INFO] Resource /branding returned status ${status} (Non-blocking: branding settings may not be seeded).`);
          } else {
            console.log(`  [HTTP ERROR] ${responseUrl} - Status: ${status}`);
            failedAssets.push(responseUrl);
          }
        }
      });

      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
        const content = await page.textContent('body');
        const includesText = content?.includes(route.expectedText) || content?.includes('Sign In');
        if (!includesText) fatalError = `Expected text "${route.expectedText}" was not rendered.`;

        const overflow = await page.evaluate(() => ({
          documentScrollWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
        }));
        if (overflow.documentScrollWidth > overflow.documentClientWidth + 1 || overflow.bodyScrollWidth > overflow.bodyClientWidth + 1) {
          fatalError = `Document-level horizontal overflow at ${viewport.width}x${viewport.height}.`;
        }

        if (fatalError) {
          console.log(`  Status: FAILED - ${fatalError}`);
          overallPassed = false;
        } else if (failedAssets.length > 0) {
          console.log(`  Status: FAILED due to failed network requests: ${failedAssets.join(', ')}`);
          overallPassed = false;
        } else {
          console.log('  Status: SUCCESS');
        }
      } catch (error) {
        console.error('  Navigation failed:', error);
        overallPassed = false;
      }

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');
    }

    await context.close();
  }

  console.log('Testing frontend-to-backend API destination integration...');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
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
    await page.fill('#admin-identifier', 'smoke-test-hardener@example.com');
    await page.fill('#admin-password', 'invalidpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    if (!apiDestinationUrl) {
      console.log('  Status: FAILED - No POST request was intercepted for /auth/login.');
      overallPassed = false;
    } else if (!apiDestinationUrl.startsWith(expectedApiHost)) {
      console.log(`  Status: FAILED - API request target ${apiDestinationUrl} does not match expected API host ${expectedApiHost}.`);
      overallPassed = false;
    } else {
      console.log(`  POST request was sent to API: ${apiDestinationUrl}`);
      console.log(`  Response Status: ${apiResponseStatus}`);
      console.log('  Status: SUCCESS');
    }
  } catch (error) {
    console.error('  API validation failed:', error);
    overallPassed = false;
  }

  await context.close();
  await browser.close();

  if (!overallPassed) {
    console.error('Post-deploy smoke test failed.');
    process.exit(1);
  }
  console.log('All post-deploy smoke tests completed successfully.');
})();
