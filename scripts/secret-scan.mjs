#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EXCLUDED_DIRS = new Set([
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

const FILE_ALLOWLIST = [
  /^package-lock\.json$/,
  /^backend\/package-lock\.json$/,
  /\.(png|jpg|jpeg|webp|ico|svg|gif|woff2?|ttf|eot)$/i,
];

const SCANNABLE_FILE_PATTERN =
  /\.(env|ya?ml|md|txt|json|config|example|conf|ini|toml|js|mjs|cjs|ts|tsx)$/i;

const CONFIG_ASSIGNMENT_FILE_PATTERN =
  /\.(env|ya?ml|md|txt|json|config|example|conf|ini|toml)$/i;

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

const SUSPICIOUS_ASSIGNMENT_KEY_PATTERN =
  /(?:SECRET|TOKEN|PASSWORD|PASS|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|ACCOUNT[_-]?ACTION[_-]?TOKEN[_-]?ENC[_-]?KEY)/i;

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
  "[redacted]",
  "***",
]);

const SAFE_VALUE_PATTERNS = [
  /^REPLACE_WITH_/i,
  /^EXAMPLE_/i,
  /^DUMMY_/i,
  /^FAKE_/i,
  /^local[-_]/i,
  /^test[-_]/i,
  /^ci[-_]/i,
  /^example[-_]/i,
  /^dummy[-_]/i,
  /^fake[-_]/i,
  /^your[-_]/i,
  /^secure[-_]/i,
  /^sample[-_]/i,
  /^demo[-_]/i,
  /^<[^>]+>$/,
  /^\[[^\]]+\]$/,

  /^https?:\/\/localhost(?::\d+)?(?:\/.*)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/.*)?$/i,
  /^https:\/\/(?:www\.|api\.|staging\.|api-staging\.)?projtrack\.codes(?:\/.*)?$/i,

  /^[a-z0-9._%+-]+@(?:example\.com|projtrack\.codes|projtrack\.local)$/i,

  /^postgresql:\/\/username:password@(?:localhost|127\.0\.0\.1|production-host):5432\/[a-z0-9_]+$/i,
  /^postgres(?:ql)?:\/\/postgres:postgres@(?:localhost|127\.0\.0\.1|postgres):5432\/[a-z0-9_]+$/i,

  /^\d+$/,
  /^production-REPLACE_WITH_/i,
  /^staging-REPLACE_WITH_/i,
];

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/");
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

function isSafeExampleValue(value) {
  const cleaned = normalizeValue(value);
  const lower = cleaned.toLowerCase();

  if (SAFE_EXACT_VALUES.has(lower)) return true;
  return SAFE_VALUE_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function walkSourceFiles(dir = ".", prefix = "") {
  const rows = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_DIRS.has(relative)) continue;
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
      `git ls-files failed; falling back to source-tree scan. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
    return walkSourceFiles();
  }
}

function shouldScanFile(filePath) {
  if (FILE_ALLOWLIST.some((pattern) => pattern.test(filePath))) return false;
  return SCANNABLE_FILE_PATTERN.test(filePath);
}

function shouldScanAssignments(filePath) {
  return CONFIG_ASSIGNMENT_FILE_PATTERN.test(filePath);
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

function extractConfigAssignments(line) {
  const assignments = [];

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

    // Always scan for real provider/token literals anywhere, including source files.
    for (const provider of PROVIDER_LITERAL_PATTERNS) {
      for (const match of line.matchAll(provider.pattern)) {
        const value = match[0];
        if (isSafeExampleValue(value)) continue;

        findings.push({
          file: filePath,
          line: lineNumber,
          key: provider.key,
          value: maskValue(value),
        });
      }
    }

    // Only scan suspicious KEY=value assignments in config/docs/env/workflow files.
    // Do not scan normal TypeScript source variables like refreshToken or passwordHash.
    if (!shouldScanAssignments(filePath)) return;

    for (const assignment of extractConfigAssignments(line)) {
      const key = assignment.key;
      const value = normalizeValue(assignment.value);

      if (!SUSPICIOUS_ASSIGNMENT_KEY_PATTERN.test(key)) continue;
      if (isSafeExampleValue(value)) continue;

      findings.push({
        file: filePath,
        line: lineNumber,
        key,
        value: maskValue(value),
      });
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