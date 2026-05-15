import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const releaseHygiene = readFileSync('scripts/release-hygiene-check.mjs', 'utf8');
const evidenceWorkflow = readFileSync('.github/workflows/evidence-gates.yml', 'utf8');
const evidenceRunner = readFileSync('scripts/run-local-evidence-gates.mjs', 'utf8');

const failures = [];

if (packageJson.scripts?.['check:capacity-claims'] !== 'node ./scripts/capacity-claim-check.mjs') {
  failures.push('package.json must expose check:capacity-claims as node ./scripts/capacity-claim-check.mjs');
}

if (packageJson.scripts?.['evidence:local'] !== 'node ./scripts/run-local-evidence-gates.mjs') {
  failures.push('package.json must expose evidence:local as node ./scripts/run-local-evidence-gates.mjs');
}

if (!releaseHygiene.includes('./scripts/capacity-claim-check.mjs')) {
  failures.push('release-hygiene-check.mjs must run scripts/capacity-claim-check.mjs');
}

if (!releaseHygiene.includes('execFileSync(process.execPath')) {
  failures.push('release-hygiene-check.mjs must execute the capacity claim checker, not merely mention it');
}

if (!evidenceWorkflow.includes('npm run evidence:local')) {
  failures.push('evidence-gates.yml must run npm run evidence:local');
}

if (!evidenceWorkflow.includes('Verify evidence report exists')) {
  failures.push('evidence-gates.yml must explicitly verify that the local evidence report exists');
}

if (!evidenceWorkflow.includes('if-no-files-found: error')) {
  failures.push('evidence-gates.yml must fail artifact upload when local-evidence-report is missing');
}

if (!evidenceWorkflow.includes('gh issue comment 37') || !evidenceWorkflow.includes('gh issue comment 38')) {
  failures.push('evidence-gates.yml must comment on evidence issues #37 and #38');
}

for (const requiredCommand of [
  "'check:capacity-claims'",
  "'check:release-guard-wiring'",
  "'check:release-hygiene'",
  "'security:secrets'",
  "'security:audit'",
  "'build'",
  "'test:unit'",
  "'test:security'",
]) {
  if (!evidenceRunner.includes(requiredCommand)) {
    failures.push(`run-local-evidence-gates.mjs must include ${requiredCommand}`);
  }
}

if (!evidenceRunner.includes('Overall verdict: ${failed ? \'FAILED\' : \'PASSED\'}')) {
  failures.push('run-local-evidence-gates.mjs must write an explicit overall verdict');
}

if (!evidenceRunner.includes('process.exit(failed ? 1 : 0)')) {
  failures.push('run-local-evidence-gates.mjs must exit nonzero when any evidence check fails');
}

if (failures.length) {
  console.error('Release guard wiring check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Release guard wiring check passed.');
