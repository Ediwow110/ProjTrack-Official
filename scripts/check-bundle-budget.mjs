#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = process.env.BUNDLE_DIST_DIR || 'dist';
const initialJsBudgetKb = Number(process.env.BUNDLE_INITIAL_JS_KB || 500);
const routeJsBudgetKb = Number(process.env.BUNDLE_ROUTE_JS_KB || 300);
const cssBudgetKb = Number(process.env.BUNDLE_CSS_KB || 180);

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

const files = collectFiles(distDir).filter((file) => /\.(js|css)$/.test(file));
const assets = [];
for (const file of files) {
  const rawKb = statSync(file).size / 1024;
  const fs = await import('node:fs');
  const gzipKb = gzipSync(fs.readFileSync(file)).length / 1024;
  assets.push({ file, rawKb, gzipKb, type: file.endsWith('.css') ? 'css' : 'js' });
}

const jsAssets = assets.filter((asset) => asset.type === 'js').sort((a, b) => b.gzipKb - a.gzipKb);
const cssAssets = assets.filter((asset) => asset.type === 'css').sort((a, b) => b.gzipKb - a.gzipKb);
const initialJs = jsAssets[0];
const oversizedRoutes = jsAssets.slice(1).filter((asset) => asset.gzipKb > routeJsBudgetKb);
const oversizedCss = cssAssets.filter((asset) => asset.gzipKb > cssBudgetKb);
const failures = [];

console.log('[bundle-budget] Asset summary (gzip KB)');
for (const asset of [...jsAssets, ...cssAssets]) {
  console.log(`- ${relative(process.cwd(), asset.file)}: ${asset.gzipKb.toFixed(1)} KB gzip (${asset.rawKb.toFixed(1)} KB raw)`);
}

if (initialJs && initialJs.gzipKb > initialJsBudgetKb) {
  failures.push(`Largest JS chunk ${relative(process.cwd(), initialJs.file)} is ${initialJs.gzipKb.toFixed(1)} KB gzip, above ${initialJsBudgetKb} KB.`);
}
for (const asset of oversizedRoutes) {
  failures.push(`Route JS chunk ${relative(process.cwd(), asset.file)} is ${asset.gzipKb.toFixed(1)} KB gzip, above ${routeJsBudgetKb} KB.`);
}
for (const asset of oversizedCss) {
  failures.push(`CSS asset ${relative(process.cwd(), asset.file)} is ${asset.gzipKb.toFixed(1)} KB gzip, above ${cssBudgetKb} KB.`);
}

if (failures.length > 0) {
  console.error('\n[bundle-budget] Budget failures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\n[bundle-budget] Bundle budgets passed.');
