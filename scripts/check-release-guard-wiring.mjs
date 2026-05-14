import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const releaseHygiene = readFileSync('scripts/release-hygiene-check.mjs', 'utf8');

const failures = [];

if (packageJson.scripts?.['check:capacity-claims'] !== 'node ./scripts/capacity-claim-check.mjs') {
  failures.push('package.json must expose check:capacity-claims as node ./scripts/capacity-claim-check.mjs');
}

if (!releaseHygiene.includes('./scripts/capacity-claim-check.mjs')) {
  failures.push('release-hygiene-check.mjs must run scripts/capacity-claim-check.mjs');
}

if (!releaseHygiene.includes('execFileSync(process.execPath')) {
  failures.push('release-hygiene-check.mjs must execute the capacity claim checker, not merely mention it');
}

if (failures.length) {
  console.error('Release guard wiring check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Release guard wiring check passed.');
