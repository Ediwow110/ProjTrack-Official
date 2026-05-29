#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const playwrightBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const configArgs = ['playwright', 'test', '--config=playwright.responsive.config.ts'];
const passthroughArgs = process.argv.slice(2);
const listOnly = passthroughArgs.includes('--list');
const passthroughWithoutList = passthroughArgs.filter((arg) => arg !== '--list');

function runPlaywright(args, options = {}) {
  return spawnSync(playwrightBin, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function fail(message, result) {
  console.error(`\n[responsive-e2e] ${message}`);
  if (result?.stdout) console.error(`\n--- playwright stdout ---\n${result.stdout}`);
  if (result?.stderr) console.error(`\n--- playwright stderr ---\n${result.stderr}`);
  process.exit(result?.status && result.status !== 0 ? result.status : 1);
}

const listResult = runPlaywright([...configArgs, ...passthroughWithoutList, '--list']);
if (listResult.status !== 0) {
  fail('Failed to discover responsive Playwright tests. This blocks responsive readiness.', listResult);
}

const listOutput = `${listResult.stdout || ''}\n${listResult.stderr || ''}`;
const totalMatch = listOutput.match(/Total:\s+(\d+)\s+tests?\s+in\s+(\d+)\s+files?/i);
const totalTests = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
const totalFiles = totalMatch ? Number.parseInt(totalMatch[2], 10) : 0;
const specNames = [...new Set([...listOutput.matchAll(/›\s+([^:\n]+\.spec\.ts):/g)].map((match) => match[1]))].sort();
const projects = [...new Set([...listOutput.matchAll(/^\s*\[([^\]]+)\]/gm)].map((match) => match[1]))].sort();
const viewports = [...new Set([...listOutput.matchAll(/\b(\d{3,4}x\d{3,4})\b/g)].map((match) => match[1]))].sort((a, b) => {
  const [aw, ah] = a.split('x').map(Number);
  const [bw, bh] = b.split('x').map(Number);
  return aw - bw || ah - bh;
});

const requiredSpec = 'authenticated-responsive.spec.ts';
const missingRoles = ['student', 'teacher', 'admin'].filter(
  (role) => !new RegExp(`${role} dashboard fits`, 'i').test(listOutput),
);

if (totalTests <= 0 || totalFiles <= 0 || specNames.length === 0) {
  fail('Zero responsive tests were discovered. Refusing to continue because CI could otherwise give false confidence.', listResult);
}

if (!specNames.includes(requiredSpec)) {
  fail(`Responsive harness is not targeting ${requiredSpec}. Discovered specs: ${specNames.join(', ') || '(none)'}.`, listResult);
}

if (missingRoles.length > 0) {
  fail(`Responsive harness is missing dashboard checks for: ${missingRoles.join(', ')}.`, listResult);
}

console.log('[responsive-e2e] Discovery summary');
console.log(`- responsive specs: ${specNames.length} (${specNames.join(', ')})`);
console.log(`- discovered tests: ${totalTests}`);
console.log(`- browser projects: ${projects.length} (${projects.join(', ')})`);
console.log(`- tested viewports: ${viewports.join(', ') || '(none detected)'}`);
console.log('- required role dashboard checks: student, teacher, admin');

if (listOnly) {
  console.log('\n[responsive-e2e] Playwright --list output');
  process.stdout.write(listResult.stdout || '');
  process.stderr.write(listResult.stderr || '');
  process.exit(0);
}

const runResult = spawnSync(playwrightBin, [...configArgs, ...passthroughArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(runResult.status ?? 1);
