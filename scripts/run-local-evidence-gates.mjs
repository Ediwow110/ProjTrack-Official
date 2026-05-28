import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const startedAt = new Date();
const commands = [
  ['npm', ['run', 'check:capacity-claims'], 'Capacity claim check'],
  ['npm', ['run', 'check:release-guard-wiring'], 'Release guard wiring check'],
  ['npm', ['run', 'check:release-hygiene'], 'Release hygiene check'],
  ['npm', ['run', 'security:secrets'], 'Secret scan'],
  ['npm', ['run', 'security:audit'], 'Dependency audit'],
  ['npm', ['--prefix', 'backend', 'run', 'build'], 'Backend build'],
  ['npm', ['--prefix', 'backend', 'run', 'test:unit'], 'Backend unit tests'],
  ['npm', ['--prefix', 'backend', 'run', 'test:security'], 'Backend security tests'],
];

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

const commitSha = git(['rev-parse', 'HEAD']);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const rows = [];
let failed = false;

for (const [bin, args, label] of commands) {
  const command = `${bin} ${args.join(' ')}`;
  console.log(`\n=== ${label}: ${command} ===`);
  const started = Date.now();
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const passed = result.status === 0;
  if (!passed) failed = true;

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  rows.push({
    label,
    command,
    passed,
    exitCode: result.status,
    durationMs,
    stdoutTail: stdout.split(/\r?\n/).filter(Boolean).slice(-20).join('\n'),
    stderrTail: stderr.split(/\r?\n/).filter(Boolean).slice(-20).join('\n'),
  });
}

const finishedAt = new Date();
const evidenceDir = join(process.cwd(), 'evidence');
mkdirSync(evidenceDir, { recursive: true });
const fileName = `local-evidence-${finishedAt.toISOString().replace(/[:.]/g, '-')}.md`;
const outputPath = join(evidenceDir, fileName);

const lines = [];
lines.push('# Local Evidence Gate Run');
lines.push('');
lines.push(`Date: ${finishedAt.toISOString()}`);
lines.push(`Branch: ${branch}`);
lines.push(`Commit SHA: ${commitSha}`);
lines.push(`Started: ${startedAt.toISOString()}`);
lines.push(`Finished: ${finishedAt.toISOString()}`);
lines.push(`Overall verdict: ${failed ? 'FAILED' : 'PASSED'}`);
lines.push('');
lines.push('| Check | Command | Result | Exit | Duration ms |');
lines.push('|---|---|---:|---:|---:|');
for (const row of rows) {
  lines.push(`| ${row.label} | \`${row.command}\` | ${row.passed ? 'PASS' : 'FAIL'} | ${row.exitCode ?? 'unknown'} | ${row.durationMs} |`);
}
lines.push('');
lines.push('## Output tails');
for (const row of rows) {
  lines.push('');
  lines.push(`### ${row.label}`);
  lines.push('');
  lines.push(`Command: \`${row.command}\``);
  lines.push(`Result: ${row.passed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  if (row.stdoutTail) {
    lines.push('stdout tail:');
    lines.push('```text');
    lines.push(row.stdoutTail);
    lines.push('```');
  }
  if (row.stderrTail) {
    lines.push('stderr tail:');
    lines.push('```text');
    lines.push(row.stderrTail);
    lines.push('```');
  }
  if (!row.stdoutTail && !row.stderrTail) {
    lines.push('No output captured.');
  }
}
lines.push('');
lines.push('## Evidence update targets');
lines.push('');
lines.push('- `docs/CI_STATUS.md`');
lines.push('- `docs/SECURITY_ACCEPTANCE_GATE.md`');
lines.push('- `docs/2ND_MAIN_IMPROVEMENTS.md`');
lines.push('- Issue #37');
lines.push('- Issue #38');

writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`\nEvidence report written to ${outputPath}`);
process.exit(failed ? 1 : 0);
