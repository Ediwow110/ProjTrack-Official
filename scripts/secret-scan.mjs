import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SECRET_PATTERNS = [
  { key: /api[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /secret[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /access[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /refresh[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /password/i, value: /.*/, allowPlaceholder: true },
  { key: /jwt[_-]?access[_-]?secret/i, value: /.*/, allowPlaceholder: true },
  { key: /jwt[_-]?refresh[_-]?secret/i, value: /.*/, allowPlaceholder: true },
  { key: /account[_-]?action[_-]?token[_-]?enc[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /s3[_-]?access[_-]?key[_-]?id/i, value: /.*/, allowPlaceholder: true },
  { key: /s3[_-]?secret[_-]?access[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /mailrelay[_-]?api[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /github[_-]?token/i, value: /.*/, allowPlaceholder: true },
  { key: /private[_-]?key/i, value: /.*/, allowPlaceholder: true },
  { key: /.*/, value: /[A-Za-z0-9+/=]{40,}/, allowPlaceholder: true },
];

const fileAllow = [
  /^package-lock\.json$/,
  /^backend\/package-lock\.json$/,
  /\.(png|jpg|jpeg|webp|ico|svg)$/i,
];

const configLikeFile = /\.(env|ya?ml|md|txt|json|config|example)$/i;
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const providerLiteralPattern = /\b(?:sk-[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g;

const excludedFallbackDirs = new Set([
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

const allowedExactValues = new Set([
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
]);

function normalizePath(value) {
  return value.trim().replace(/\\/g, "/");
}

function walkSourceFiles(dir = ".", prefix = "") {
  const rows = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (excludedFallbackDirs.has(entry.name) || excludedFallbackDirs.has(relative)) continue;
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

function cleanValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function isAllowedPlaceholder(value) {
  const cleanedValue = cleanValue(value);
  return /^(REPLACE_WITH_|EXAMPLE_|DUMMY_|FAKE_)/i.test(cleanedValue);
}

function isClearlySafeValue(value) {
  const cleanedValue = cleanValue(value);

  if (isAllowedPlaceholder(cleanedValue)) return true;
  if (allowedExactValues.has(cleanedValue.toLowerCase())) return true;
  if (/^\d+$/.test(cleanedValue)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/i.test(cleanedValue)) return true;
  if (/^https:\/\/(?:www\.|api\.)?projtrack\.codes(?:\/.*)?$/i.test(cleanedValue)) return true;
  if (/^[a-z0-9._%+-]+@(?:example\.com|projtrack\.codes|projtrack\.local)$/i.test(cleanedValue)) return true;
  if (/^postgresql:\/\/username:password@(?:localhost|production-host):5432\/[a-z0-9_]+$/i.test(cleanedValue)) return true;

  return false;
}

function maskValue(value) {
  const cleanedValue = cleanValue(value);
  if (cleanedValue.length <= 8) return "[redacted]";
  return `${cleanedValue.slice(0, 4)}...${cleanedValue.slice(-4)}`;
}

function extractAssignment(line) {
  const match = line.match(/^\s*([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCOUNT_ACTION_TOKEN_ENC_KEY)[A-Z0-9_]*)\s*[:=]\s*`?([^`\s#]+)`?/i);
  if (!match) return null;

  return {
    key: match[1],
    value: match[2],
  };
}

function scanFile(filePath) {
  const violations = [];

  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;

      for (const literal of line.matchAll(providerLiteralPattern)) {
        violations.push({
          file: filePath,
          line: index + 1,
          key: "PROVIDER_KEY_LITERAL",
          value: maskValue(literal[0]),
        });
      }

      const assignment = extractAssignment(line);
      if (!assignment) return;

      if (isClearlySafeValue(assignment.value)) return;

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.key.test(assignment.key) && pattern.value.test(assignment.value)) {
          violations.push({
            file: filePath,
            line: index + 1,
            key: assignment.key,
            value: maskValue(assignment.value),
          });
          return;
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return violations;
}

const findings = [];

const files = candidateFiles().filter((file) => !fileAllow.some((pattern) => pattern.test(file)));

for (const file of files) {
  let source = "";

  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (privateKeyPattern.test(source)) {
    findings.push({
      file,
      line: "?",
      key: "PRIVATE_KEY",
      value: "[private key material]",
    });
  }

  if (!configLikeFile.test(file)) continue;

  findings.push(...scanFile(file));
}

if (findings.length) {
  console.error("Secret scan found committed secret-like values. Rotate these if they are real:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}: ${finding.key}=${finding.value}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");