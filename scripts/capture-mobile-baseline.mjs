#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.env.BASELINE_FRONTEND_URL || process.env.SMOKE_TARGET_HOST;
const outputDir = process.env.BASELINE_OUTPUT_DIR || 'docs/frontend-mobile-readiness/evidence/baseline';

if (!baseUrl) {
  console.error('[baseline] Set BASELINE_FRONTEND_URL or SMOKE_TARGET_HOST before capturing deployed screenshots.');
  process.exit(1);
}

const routes = [
  '/student/dashboard',
  '/student/subjects',
  '/student/submissions',
  '/student/submit',
  '/teacher/dashboard',
  '/teacher/submissions',
  '/admin/dashboard',
  '/admin/users',
  '/admin/students',
  '/admin/settings',
];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  note: 'Screenshots require a valid authenticated session. If routes redirect to login, Phase 0 remains incomplete.',
  screenshots: [],
};

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const route of routes) {
    const safeName = `${route.replace(/^\//, '').replace(/\//g, '-')}-${viewport.width}x${viewport.height}.png`;
    const url = new URL(route, baseUrl).toString();
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 }).catch((error) => {
      console.error(`[baseline] Navigation failed for ${url}: ${error.message}`);
    });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const path = join(outputDir, safeName);
    await page.screenshot({ path, fullPage: true });
    manifest.screenshots.push({ route, viewport, path });
    console.log(`[baseline] Saved ${path}`);
  }
  await context.close();
}

await browser.close();
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[baseline] Wrote ${join(outputDir, 'manifest.json')}`);
