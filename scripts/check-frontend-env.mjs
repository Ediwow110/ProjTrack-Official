if (process.argv.includes('--production-fixture')) {
  process.env.CI_PRODUCTION_BUILD = 'true';
  process.env.VITE_USE_BACKEND = 'true';
  process.env.VITE_API_BASE_URL = 'https://api.projtrack.codes';
  process.env.VITE_PUBLIC_APP_URL = 'https://www.projtrack.codes';
}

const prod = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production' || process.env.CI_PRODUCTION_BUILD === 'true';
const failures = [];

function bool(value, fallback) {
  if (value === undefined) return fallback;
  if (/^(1|true|yes|on)$/i.test(String(value))) return true;
  if (/^(0|false|no|off)$/i.test(String(value))) return false;
  return fallback;
}

function url(key) {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    failures.push(`${key} is required.`);
    return null;
  }
  try {
    return new URL(value);
  } catch {
    failures.push(`${key} must be a valid absolute URL.`);
    return null;
  }
}

if (prod) {
  if (!bool(process.env.VITE_USE_BACKEND, true)) {
    failures.push('VITE_USE_BACKEND=false is not allowed for production builds.');
  }
  const api = url('VITE_API_BASE_URL');
  const app = url('VITE_PUBLIC_APP_URL');
  for (const [key, parsed] of [['VITE_API_BASE_URL', api], ['VITE_PUBLIC_APP_URL', app]]) {
    if (!parsed) continue;
    if (parsed.protocol !== 'https:') failures.push(`${key} must use https:// for production builds.`);
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname)) {
      failures.push(`${key} cannot point to localhost for production builds.`);
    }
  }
}

if (failures.length) {
  console.error('Frontend environment validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(prod ? 'Frontend production environment validation passed.' : 'Frontend environment validation skipped for non-production mode.');
