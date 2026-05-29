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

const roleConfigs = {
  student: {
    loginPath: '/student/login',
    identifierLabel: /Email or Student ID/i,
    buttonName: /Sign In$/i,
    identifier: process.env.SMOKE_STUDENT_IDENTIFIER,
    password: process.env.SMOKE_STUDENT_PASSWORD,
    routes: [
      '/student/dashboard',
      '/student/subjects',
      '/student/submissions',
      '/student/submit',
    ],
  },
  teacher: {
    loginPath: '/teacher/login',
    identifierLabel: /Email or Teacher ID/i,
    buttonName: /Sign In as Teacher/i,
    identifier: process.env.SMOKE_TEACHER_IDENTIFIER,
    password: process.env.SMOKE_TEACHER_PASSWORD,
    routes: [
      '/teacher/dashboard',
      '/teacher/submissions',
    ],
  },
  admin: {
    loginPath: '/admin/login',
    identifierLabel: /Email or Admin ID/i,
    buttonName: /Sign In as Admin/i,
    identifier: process.env.SMOKE_ADMIN_IDENTIFIER,
    password: process.env.SMOKE_ADMIN_PASSWORD,
    routes: [
      '/admin/dashboard',
      '/admin/users',
      '/admin/students',
      '/admin/settings',
    ],
  },
};

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
  note: 'Screenshots captured with credentialed authentication where available. If routes redirect to login, check SMOKE_* credentials.',
  screenshots: [],
};

async function login(page, config) {
  if (!config.identifier || !config.password) {
    console.log(`[baseline] Skipping login for ${config.loginPath} (credentials missing)`);
    return false;
  }
  const url = new URL(config.loginPath, baseUrl).toString();
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await page.getByLabel(config.identifierLabel).fill(config.identifier);
  await page.getByLabel(/Password/i).fill(config.password);
  await page.getByRole('button', { name: config.buttonName }).click();
  // Wait for redirect or dashboard indicator.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  return true;
}

for (const viewport of viewports) {
  console.log(`[baseline] Starting viewport ${viewport.width}x${viewport.height}`);
  for (const [role, config] of Object.entries(roleConfigs)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    
    const isAuthenticated = await login(page, config).catch((err) => {
      console.error(`[baseline] Login failed for ${role}: ${err.message}`);
      return false;
    });

    for (const route of config.routes) {
      const safeName = `${role}-${route.replace(/^\//, '').replace(/\//g, '-')}-${viewport.width}x${viewport.height}.png`;
      const url = new URL(route, baseUrl).toString();
      
      console.log(`[baseline] Capturing ${url} (authenticated: ${isAuthenticated})`);
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 }).catch((error) => {      
        console.error(`[baseline] Navigation failed for ${url}: ${error.message}`);        
      });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      
      const path = join(outputDir, safeName);
      await page.screenshot({ path, fullPage: true });
      manifest.screenshots.push({ role, route, viewport, path, authenticated: isAuthenticated });
      console.log(`[baseline] Saved ${path}`);
    }
    await context.close();
  }
}

await browser.close();
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));      
console.log(`[baseline] Wrote ${join(outputDir, 'manifest.json')}`);
