import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const scannedRoots = ['README.md', 'src'];
const allowedEvidenceFiles = new Set([
  'docs/SCHOOL_SCALE_VALIDATION_RESULTS.md',
  'docs/LOAD_TEST_RESULTS.md',
]);

const claimPatterns = [
  /\b(supports?|handles?|ready\s+for|scales?\s+to)\s+(?:more\s+than\s+)?(?:20,?000|20k|50,?000|50k)\s+(?:registered\s+)?users\b/i,
  /\b(?:20,?000|20k|50,?000|50k)\s+(?:registered\s+)?users?\s+(?:supported|ready|capacity|scale)\b/i,
  /\b(?:supports?|handles?|ready\s+for|scales?\s+to)\s+(?:1,?000|1000|2,?000|2000)\+?\s+concurrent\s+users\b/i,
  /\b(?:1,?000|1000|2,?000|2000)\+?\s+concurrent\s+users?\s+(?:supported|ready|capacity|scale)\b/i,
  /\bproduction[-\s]?ready\b/i,
  /\bschool[-\s]?scale\s+(?:ready|support|supported|capacity)\b/i,
];

const contextAllowlist = [
  /not\s+(?:currently\s+)?(?:proven|validated|supported|claimable|ready)/i,
  /do\s+not\s+claim/i,
  /claim\s+blocked/i,
  /blocked\s+until/i,
  /target/i,
  /requires?\s+evidence/i,
  /evidence\s+required/i,
  /validation\s+results/i,
  /load[-\s]?test\s+results/i,
];

function walk(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  const rows = [];
  for (const entry of readdirSync(path)) {
    if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry)) continue;
    rows.push(...walk(join(path, entry)));
  }
  return rows;
}

function isScannable(file) {
  return /\.(md|mdx|ts|tsx|js|jsx|html)$/i.test(file) || file === 'README.md';
}

function nearbyAllowed(text, index) {
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + 180);
  const window = text.slice(start, end);
  return contextAllowlist.some((pattern) => pattern.test(window));
}

const files = scannedRoots.flatMap(walk).map((file) => file.replace(/\\/g, '/')).filter(isScannable);
const violations = [];

for (const file of files) {
  if (allowedEvidenceFiles.has(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const pattern of claimPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (nearbyAllowed(text, match.index)) continue;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      violations.push({ file, line, claim: match[0] });
      break;
    }
  }
}

if (violations.length) {
  console.error('Unsupported capacity/readiness claims found. Record passing evidence before making these claims:');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.claim}`);
  }
  console.error('Allowed evidence locations: docs/SCHOOL_SCALE_VALIDATION_RESULTS.md and docs/LOAD_TEST_RESULTS.md');
  process.exit(1);
}

console.log('Capacity claim check passed.');
