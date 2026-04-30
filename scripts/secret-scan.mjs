#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SECRET_KEY_PATTERN =
  /(?:SECRET|TOKEN|PASSWORD|PASS|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|ACCOUNT[_-]?ACTION[_-]?TOKEN[_-]?ENC[_-]?KEY)/i;

const PROVIDER_LITERAL_PATTERNS = [
  { key: "GITHUB_TOKEN", pattern: /\bghp_[A-Za-z0-9_]{30,}\b/g },
  { key: "GITHUB_FINE_GRAINED_TOKEN", pattern: /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g },
  { key: "OPENAI_OR_SIMILAR_KEY", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { key: "SENDGRID_KEY", pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g },
  { key: "AWS_ACCESS_KEY_ID", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { key: "AWS_TEMP_ACCESS_KEY_ID", pattern: /\bASIA[0-9A-Z]{16}\b/g },
  {
    key: "JWT_LITERAL",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

const PRIVATE_KEY_PATTERN =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/;

const ALLOWED_PLACEHOLDER_PREFIXES = [
  "REPLACE_WITH_",
  "EXAMPLE_",
  "DUMMY_",
  "FAKE_",
];

const SAFE_EXACT_VALUES = new Set([
  "",
  "true",
  "false",
  "local",
  "stub",
  "memory",
  "disabled",
  "fail-closed",
  "clamav",
  "production",
  "development",
  "test",
  "s3",
  "redis",
  "mailrelay",
  "postgres",
  "projtrack",
  "password",
  "changeme",
]);

const SAFE_VALUE_PATTERNS = [
  /^REPLACE_WITH_/i,
  /^EXAMPLE_/i,
  /^DUMMY_/i,
  /^FAKE_/i,

  // Explicit fake/local/test values.
  /^local[-_]/i,
  /^test[-_]/i,
  /^ci[-_]/i,
  /^example[-_]/i,
  /^dummy[-_]/i,

  // Local/dev URLs.
  /^https?:\/\/localhost(?::\d+)?(?:\/.*)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/.*)?$/i,

  // Project example URLs.
  /^https:\/\/(?:www\.|api\.|staging\.|api-staging\.)?projtrack\.codes(?:\/.*)?$/i,

  // Example/local emails.
  /^[a-z0-9._%+-]+@(?:example\.com|projtrack\.codes|projtrack\.local)$/i,

  // Safe example DB URLs.
  /^postgresql:\/\/username:password@(?:localhost|127\.0\.0\.1|production-host):5432\/[a-z0-9_]+$/i,
  /^postgres(?:ql)?:\/\/postgres:postgres@(?:localhost|127\.0\.0\.1|postgres):5432\/[a-z0-9_]+$/i,

  // Numeric config.
  /^\d+$/,

  // Safe fake key/version labels.
  /^production-REPLACE_WITH_/i,
  /^staging-REPLACE_WITH_/i,
];

const FILE_ALLOWLIST = [
  /^package-lock\.json$/,
  /^backend\/package-lock\.json$/,
  /\.(png|jpg|jpeg|webp|ico|svg|gif|woff2?|ttf|eot)$/i,
];

const CONFIG_OR_TEXT_FILE_PATTERN =
  /\.(env|ya?ml|md|txt|json|config|example|conf|ini|toml|sql|prisma|js|mjs|cjs|ts|tsx)$/i;

const EXAMPLE_DOC_CI_FILE_PATTERNS = [
  /\.env(?:\.[A-Za-z0-9_-]+)?\.example$/,
  /\.example$/,
  /^docs\//,
  /^backend\/docs\//,
  /\.md$/,
  /^\.github\/workflows\//,
  /docker-compose.*\.ya?ml$/,
  /PRODUCTION_ENV_TEMPLATE\.md$/,
  /DEPLOYMENT\.md$/,
  /MAILRELAY_RUNBOOK\.md$/,
  /STAGING_SMOKE_TEST_GUIDE\.md$/,
  /SECURITY_NOTES\.md$/,
];

const EXCLUDED_FALLBACK_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
  "tmp",
  "uploads",
  ".local-runtime",
]);

function normalizePath(value) {
  return value.trim().replace(/\\/g, "/");
}

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "");
}

function maskValue(value) {
  const cleaned = normalizeValue(value);
  if (!cleaned) return "[empty]";
  if (cleaned.length <= 8) return "[redacted]";
  return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
}

function isExampleDocOrCiFile(filePath) {
  const normalized = normalizePath(filePath);
  return EXAMPLE_DOC_CI_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasAllowedPlaceholderPrefix(value) {
  const cleaned = normalizeValue(value);
  return ALLOWED_PLACEHOLDER_PREFIXES.some((prefix) =>
    cleaned.toUpperCase().startsWith(prefix),
  );
}

function isSafePlaceholderOrExampleValue(filePath, value) {
  const cleaned = normalizeValue(value);
  const lower = cleaned.toLowerCase();

  if (hasAllowedPlaceholderPrefix(cleaned)) return true;
  if (SAFE_EXACT_VALUES.has(lower)) return true;
  if (SAFE_VALUE_PATTERNS.some((pattern) => pattern.test(cleaned))) return true;

  // Looser allowances only for examples/docs/workflows/docker-compose files.
  if (isExampleDocOrCiFile(filePath)) {
    if (/^(your-|your_|secure-|secure_|sample-|sample_|demo-|demo_)/i.test(cleaned)) return true;
    if (/^(local|test|ci|example|dummy|fake)[-_a-z0-9]*$/i.test(cleaned)) return true;
    if (/^[a-z0-9._%+-]+@example\.com$/i.test(cleaned)) return true;
    if (/^[a-z0-9._%+-]+@projtrack\.(codes|local)$/i.test(cleaned)) return true;
  }

  return false;
}

function walkSourceFiles(dir = ".", prefix = "") {
  const rows = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_FALLBACK_DIRS.has(entry.name) || EXCLUDED_FALLBACK_DIRS.has(relative)) {
        continue;
      }
      rows.push(...walkSourceFiles(join(dir, entry.name), relative));
      continue;
    }

    if (entry.isFile()) rows.push(relative);
  }

  return rows;
}

function candidateFiles() {
  try {
    return execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `git ls-files failed; falling back to a source-tree scan. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
    return walkSourceFiles();
  }
}

function shouldScanFile(filePath) {
  if (FILE_ALLOWLIST.some((pattern) => pattern.test(filePath))) return false;
  return CONFIG_OR_TEXT_FILE_PATTERN.test(filePath);
}

function stripInlineComment(value) {
  const raw = String(value ?? "");
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (char === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    if (char === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    if (char === "`" && !inSingle && !inDouble) inBacktick = !inBacktick;

    if (char === "#" && !inSingle && !inDouble && !inBacktick) {
      return raw.slice(0, i).trim();
    }
  }

  return raw.trim();
}

function extractAssignments(line) {
  const assignments = [];

  // ENV/YAML/Markdown-ish key-value forms:
  // KEY=value
  // KEY: value
  // - KEY=value
  // `KEY=value`
  const assignmentPattern =
    /(?:^|[\s`"'-])([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCOUNT_ACTION_TOKEN_ENC_KEY)[A-Z0-9_]*)\s*[:=]\s*`?([^`\s#]+)`?/gi;

  for (const match of line.matchAll(assignmentPattern)) {
    assignments.push({
      key: match[1],
      value: stripInlineComment(match[2]),
    });
  }

  return assignments;
}

function looksLikeLongRandomSecret(value) {
  const cleaned = normalizeValue(value);

  if (cleaned.length < 40) return false;
  if (isSafePlaceholderOrExampleValue("", cleaned)) return false;

  // Base64-ish, hex-ish, or mixed token-ish values.
  if (/^[A-Za-z0-9+/=]{40,}$/.test(cleaned)) return true;
  if (/^[a-f0-9]{40,}$/i.test(cleaned)) return true;
  if (/^[A-Za-z0-9_-]{40,}$/.test(cleaned)) return true;

  return false;
}

function scanFile(filePath) {
  const findings = [];
  let source = "";

  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    return findings;
  }

  if (PRIVATE_KEY_PATTERN.test(source)) {
    findings.push({
      file: filePath,
      line: "?",
      key: "PRIVATE_KEY",
      value: "[private key material]",
    });
  }

  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("//")) return;

    for (const provider of PROVIDER_LITERAL_PATTERNS) {
      for (const match of line.matchAll(provider.pattern)) {
        const value = match[0];
        if (isSafePlaceholderOrExampleValue(filePath, value)) continue;

        findings.push({
          file: filePath,
          line: lineNumber,
          key: provider.key,
          value: maskValue(value),
        });
      }
    }

    for (const assignment of extractAssignments(line)) {
      const key = assignment.key;
      const value = normalizeValue(assignment.value);

      if (!SECRET_KEY_PATTERN.test(key)) continue;
      if (isSafePlaceholderOrExampleValue(filePath, value)) continue;

      findings.push({
        file: filePath,
        line: lineNumber,
        key,
        value: maskValue(value),
      });
    }

    // Catch long secret-looking literals in config/docs even without a suspicious key.
    if (isExampleDocOrCiFile(filePath)) return;

    const words = line.split(/\s+/);
    for (const word of words) {
      const cleaned = normalizeValue(word.replace(/[",;)]$/g, ""));
      if (looksLikeLongRandomSecret(cleaned)) {
        findings.push({
          file: filePath,
          line: lineNumber,
          key: "LONG_RANDOM_LITERAL",
          value: maskValue(cleaned),
        });
        break;
      }
    }
  });

  return findings;
}

const findings = [];

for (const file of candidateFiles()) {
  const normalized = normalizePath(file);
  if (!shouldScanFile(normalized)) continue;
  findings.push(...scanFile(normalized));
}

if (findings.length > 0) {
  console.error("Secret scan found committed secret-like values. Rotate these if they are real:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}: ${finding.key}=${finding.value}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");