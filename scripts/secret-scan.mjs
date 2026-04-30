import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const allowValue = /^(<[^>]+>|change-me|replace-me|replace-with.*|example.*|placeholder.*|local-dev.*|ci-.*|playwright-.*|projtrack.*)$/i;
const fileAllow = [
  /^package-lock\.json$/,
  /^backend\/package-lock\.json$/,
  /\.(png|jpg|jpeg|webp|ico|svg)$/i,
];
const configLikeFile = /\.(env|ya?ml|md|txt|json|config|example)$/i;
const keyPattern = /\b([A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*)[ \t]*[:=][ \t]*["'`]?([^"'`\s#]{12,})/gi;
const providerLiteralPattern = /\b(?:sk-[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g;
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const findings = [];
const knownTestValues = new Set([
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
]);

const excludedFallbackDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  'tmp',
  'uploads',
  '.local-runtime',
]);

function normalizePath(value) {
  return value.trim().replace(/\\/g, '/');
}

function walkSourceFiles(dir = '.', prefix = '') {
  const rows = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (excludedFallbackDirs.has(entry.name) || excludedFallbackDirs.has(relative)) continue;
      rows.push(...walkSourceFiles(join(dir, entry.name), relative));
      continue;
    }
    if (entry.isFile()) rows.push(relative);
  }
  return rows;
}

function candidateFiles() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  } catch (error) {
    console.warn(`git ls-files failed; falling back to a source-tree scan. ${error instanceof Error ? error.message : ''}`.trim());
    return walkSourceFiles();
  }
}

const files = candidateFiles().filter((file) => !fileAllow.some((pattern) => pattern.test(file)));

for (const file of files) {
  let source = '';
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (privateKeyPattern.test(source)) {
    findings.push({ file, key: 'PRIVATE_KEY', value: '[private key material]' });
  }
  for (const literal of source.matchAll(providerLiteralPattern)) {
    findings.push({ file, key: 'PROVIDER_KEY_LITERAL', value: `${literal[0].slice(0, 4)}...${literal[0].slice(-4)}` });
  }
  if (!configLikeFile.test(file)) continue;
  for (const match of source.matchAll(keyPattern)) {
    const key = match[1];
    const value = match[2].trim().replace(/[),.;`]+$/g, '');
    const normalized = value.toLowerCase();
    if (knownTestValues.has(value)) continue;
    if (allowValue.test(normalized)) continue;
    if (normalized.includes('example') || normalized.includes('placeholder')) continue;
    if (/^https?:\/\//i.test(value)) continue;
    findings.push({ file, key, value: `${value.slice(0, 4)}...${value.slice(-4)}` });
  }
}

if (findings.length) {
  console.error('Secret scan found committed secret-like values. Rotate these if they are real:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.key}=${finding.value}`);
  }
  process.exit(1);
}

console.log('Secret scan passed.');
