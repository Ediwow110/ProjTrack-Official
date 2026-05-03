import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const forbidden = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)(dist|build|coverage|playwright-report|test-results|tmp|uploads|\.local-runtime)(\/|$)/,
  /(^|\/)data\/system-tools(\/|$)/,
  /(^|\/)backend\/data\/system-tools(\/|$)/,
  /(^|\/)backend\/uploads(\/|$)/,
  /(^|\/)backend\/prisma\/generated(\/|$)/,
  /(^|\/)\.env($|\.)/,
  /(^|\/)backend\/\.env($|\.)/,
  /\.log$/i,
  /(^|\/)artifacts-[^/]+\.png$/i,
  /(^|\/).*-report\.json$/i,
  /(^|\/)teacher-playwright\.json$/i,
  /(^|\/)(apply|patch)_[^/]+\.py$/i,
  /(^|\/)backend\/prisma\/(baseline|db-to-schema|diff-output|profile-fields)\.sql$/i,
  /(^|\/)diagnostics(\/|$)/,
  /\.diagnostic\.json$/i,
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

const allowed = [
  /(^|\/)\.env\.example$/,
  /(^|\/)\.env\.local\.example$/,
  /(^|\/)\.env\.production\.example$/,
  /(^|\/)backend\/\.env\.example$/,
  /(^|\/)backend\/\.env\.local\.example$/,
  /(^|\/)backend\/\.env\.production\.example$/,
    /(^|\/)backend\/\.env\.worker\.example$/,
    /(^|\/)backend\/\.env\.worker\.local\.example$/,
    /(^|\/)backend\/\.env\.worker\.production\.example$/,
  /(^|\/)src\/app\/components\/lists\/logs(\/|$)/,
  /(^|\/)backend\/src\/auth\/dto\/refresh-token\.dto\.ts$/,
];

function gitFiles(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((value) => value.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch (error) {
    console.warn(`git ${args.join(' ')} failed; using fallback release tree scan. ${error instanceof Error ? error.message : ''}`.trim());
    return [];
  }
}

function untrackedFiles() {
  try {
    return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((line) => line.startsWith('?? '))
      .map((line) => line.slice(3).trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

const includeIgnored = /^(1|true|yes|on)$/i.test(String(process.env.RELEASE_HYGIENE_INCLUDE_IGNORED ?? 'false'));
const fallbackExcludedDirs = new Set([
  '.git',
  ...(includeIgnored ? [] : ['node_modules', 'dist', 'build', 'coverage', 'playwright-report', 'test-results', 'tmp', 'uploads', '.local-runtime']),
]);

function walkReleaseTree(dir = '.', prefix = '') {
  const rows = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (fallbackExcludedDirs.has(entry.name) || fallbackExcludedDirs.has(relative)) {
        if (includeIgnored) rows.push(relative);
        continue;
      }
      rows.push(...walkReleaseTree(join(dir, entry.name), relative));
      continue;
    }
    if (entry.isFile()) rows.push(relative);
  }
  return rows;
}

const gitCandidates = [
  ...gitFiles(['ls-files']),
  ...untrackedFiles(),
].filter((file) => existsSync(file));
const files = (gitCandidates.length ? gitCandidates : walkReleaseTree()).map((file) => file.replace(/\\/g, '/'));
const violations = files.filter((file) => {
  if (allowed.some((pattern) => pattern.test(file))) return false;
  return forbidden.some((pattern) => pattern.test(file));
});

if (violations.length) {
  console.error('Release hygiene check failed. Remove these files from the release package:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Release hygiene check passed.');
