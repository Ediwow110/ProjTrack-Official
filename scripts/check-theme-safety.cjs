#!/usr/bin/env node
/*
 * Theme safety gate for ProjTrack.
 *
 * The check intentionally fails only on high-risk admin pages and shared surface
 * components. Other page-level matches are printed as warnings so legacy areas
 * can be migrated without making this gate noisy. A match is considered safe
 * when the same class string already uses a dark: variant, a portal-* shared
 * token, a CSS variable token, or an explicit translucent color such as
 * bg-white/10 for glass/hero treatments.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const failTargets = new Set([
  'src/app/pages/admin/Announcements.tsx',
  'src/app/pages/admin/SystemTools.tsx',
  'src/app/pages/admin/MailJobs.tsx',
  'src/app/pages/admin/Students.tsx',
  'src/app/pages/admin/Backups.tsx',
  'src/app/pages/admin/SystemHealth.tsx',
  'src/app/pages/admin/Dashboard.tsx',
  'src/app/components/ui/app-modal.tsx',
  'src/app/components/ui/dialog.tsx',
  'src/app/components/ui/drawer.tsx',
  'src/app/components/ui/table.tsx',
]);
const scanRoots = ['src/app/pages', 'src/app/components/ui', 'src/app/components/portal'];
const risky = [
  /\bbg-white\b/,
  /\bbg-gray-50\b/,
  /\bbg-slate-50\b/,
  /\btext-black\b/,
  /\btext-gray-900\b/,
  /\btext-slate-900\b/,
  /\btext-gray-800\b/,
  /\btext-slate-800\b/,
  /\bborder-gray-200\b/,
  /\bborder-slate-200\b/,
  /\bplaceholder-gray-[0-9]+\b/,
  /\bhover:bg-gray-[0-9]+\b/,
  /\bhover:bg-slate-50\b/,
  /\bdivide-gray-[0-9]+\b/,
  /\bdivide-slate-100\b/,
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) return [full];
    return [];
  });
}

function hasRisk(line) {
  return risky.some((pattern) => pattern.test(line));
}

function safeContext(line) {
  if (line.includes('dark:')) return true;
  if (line.includes('portal-')) return true;
  if (line.includes('var(--')) return true;
  if (/\b(bg|border|text)-white\//.test(line)) return true;
  if (/\b(bg|border|text)-slate-50\//.test(line)) return true;
  if (/\b(bg|border|text)-gray-50\//.test(line)) return true;
  if (line.includes('allow-theme-hardcode')) return true;
  return false;
}

const allFiles = scanRoots.flatMap((dir) => walk(path.join(root, dir)));
const failures = [];
const warnings = [];

for (const file of allFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const shouldFail = failTargets.has(rel);
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, idx) => {
    if (!hasRisk(line) || safeContext(line)) return;
    const hit = `${rel}:${idx + 1}: ${line.trim()}`;
    if (shouldFail) failures.push(hit);
    else warnings.push(hit);
  });
}

if (warnings.length) {
  console.warn(`Theme safety warnings (${warnings.length}). These are legacy/page-level hardcoded colors to migrate next:`);
  for (const warning of warnings.slice(0, 30)) console.warn(`  ${warning}`);
  if (warnings.length > 30) console.warn(`  ... ${warnings.length - 30} more warning(s)`);
}

if (failures.length) {
  console.error(`Theme safety check failed (${failures.length} high-risk match(es)). Use shared portal tokens or add explicit dark variants.`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Theme safety check passed for protected admin pages and shared surface components.');
