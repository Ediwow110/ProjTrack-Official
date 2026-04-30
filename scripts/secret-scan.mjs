import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_PATTERNS = [
  { key: /api[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /secret[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /access[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /refresh[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /password/i, value: /.*/, allowPlaceholder: true },
  { key: /jwt[_-]?access[_-]?secret/i, value: /.*/, allowPlaceholder: true },
  { key: /jwt[_-]?refresh[_-]?secret/i, value: /.*/, allowPlaceholder: true },
  { key: /account[_-]?action[_-]?token[_-]?enc[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /s3[_-]?access[_-]?key[_-]?id/i, value: /.*/, allowPlaceholder: true },
  { key: /s3[_-]?secret[_-]?access[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /mailrelay[_-]?api[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /github[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /private[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /.*/, value: /[A-Za-z0-9+/=]{40,}/, allowPlaceholder: true },
];

const fileAllow = [
  /^package-lock\.json$/,
  /^backend\/package-lock\.json$/,
  /\.(png|jpg|jpeg|webp|ico|svg)$/i,
];
const configLikeFile = /\.(env|ya?ml|md|txt|json|config|example)$/i;
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const providerLiteralPattern = /\b(?:sk-[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g;
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

function isAllowedPlaceholder(value) {
  const cleanedValue = value.replace(/^['"]|['"]$/g, '').trim();
  return /^(REPLACE_WITH_|EXAMPLE_|DUMMY_|FAKE_)/i.test(cleanedValue);
}

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    lines.forEach((line, index) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      SECRET_PATTERNS.forEach(pattern => {
        if (pattern.key.test(line)) {
          const match = line.match(/=(.+)/);
          if (match && match[1]) {
            const value = match[1].trim();
            if (pattern.value.test(value)) {
              if (!pattern.allowPlaceholder || !isAllowedPlaceholder(value)) {
                violations.push({
                  file: filePath,
                  line: index + 1,
                  content: `${line.slice(0, 50)}${line.length > 50 ? '...' : ''}`,
                });
              }
            }
          }
        }
      });
    });

    return violations;
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error.message);
    return [];
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
  const violations = scanFile(file);
  findings.push(...violations);
}

if (findings.length) {
  console.error('Secret scan found committed secret-like values. Rotate these if they are real:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.key}=${finding.value}`);
  }
  process.exit(1);
}

console.log('Secret scan passed.');
