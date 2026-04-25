#!/usr/bin/env node

try {
  require('dotenv').config();
} catch {}

function envValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function parseArgs(argv) {
  const options = {};
  for (const entry of argv) {
    if (!entry.startsWith('--')) continue;
    const [rawKey, rawValue] = entry.slice(2).split('=');
    options[rawKey] = rawValue ?? 'true';
  }
  return options;
}

function usage() {
  console.error(
    [
      'Usage: npm run mail:testmail -- --tag=activation [--limit=5] [--timestamp_from=1714010000000]',
      'Requires TESTMAIL_API_KEY and TESTMAIL_NAMESPACE in the environment.',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = envValue('TESTMAIL_API_KEY', 'TESTMAIL_APIKEY');
  const namespace = envValue('TESTMAIL_NAMESPACE');
  const tag = String(args.tag ?? '').trim();
  const limit = String(args.limit ?? '10').trim();
  const timestampFrom = String(args.timestamp_from ?? '').trim();

  if (!apiKey || !namespace) {
    usage();
    throw new Error('TESTMAIL_API_KEY and TESTMAIL_NAMESPACE are required.');
  }

  if (!tag) {
    usage();
    throw new Error('A testmail tag is required, for example --tag=activation.');
  }

  const query = new URLSearchParams({
    apikey: apiKey,
    namespace,
    tag,
    limit,
  });

  if (timestampFrom) {
    query.set('timestamp_from', timestampFrom);
  }

  const response = await fetch(`https://api.testmail.app/api/json?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`testmail.app API failed with ${response.status}: ${bodyText}`);
  }

  const payload = JSON.parse(bodyText);
  const emails = Array.isArray(payload.emails) ? payload.emails : [];

  console.log(
    JSON.stringify(
      {
        result: payload.result,
        message: payload.message,
        count: payload.count,
        emails: emails.map((email) => ({
          id: email.id ?? null,
          to: email.to ?? null,
          from: email.from ?? null,
          subject: email.subject ?? null,
          tag: email.tag ?? null,
          timestamp: email.timestamp ?? null,
          htmlPreview: String(email.html ?? '').slice(0, 200),
          textPreview: String(email.text ?? '').slice(0, 200),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
