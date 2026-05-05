#!/usr/bin/env node
// Pre-flight guard for npm run e2e:smoke.
// Prevents skip-green smoke runs by failing loudly when required SMOKE_* env
// vars are missing. Never prints secret values, only their names.
import process from "node:process";

const REQUIRED = [
  "SMOKE_ADMIN_IDENTIFIER",
  "SMOKE_ADMIN_PASSWORD",
  "SMOKE_TEACHER_IDENTIFIER",
  "SMOKE_TEACHER_PASSWORD",
  "SMOKE_STUDENT_IDENTIFIER",
  "SMOKE_STUDENT_PASSWORD",
];

const missing = REQUIRED.filter((name) => {
  const value = process.env[name];
  return value === undefined || String(value).trim() === "";
});

if (missing.length === 0) {
  console.log("[check:smoke-env] All required SMOKE_* env vars are set.");
  process.exit(0);
}

console.error("[check:smoke-env] Required SMOKE_* env vars are missing:");
for (const name of missing) console.error(`  - ${name}`);
console.error("");
console.error("Set them before running smoke. Use local-only credentials, never production.");
console.error("");
console.error("PowerShell:");
console.error('  $env:SMOKE_ADMIN_IDENTIFIER   = "admin.smoke@example.test"');
console.error('  $env:SMOKE_ADMIN_PASSWORD     = "LocalSmokePass12345!"');
console.error('  $env:SMOKE_TEACHER_IDENTIFIER = "teacher.smoke@example.test"');
console.error('  $env:SMOKE_TEACHER_PASSWORD   = "LocalSmokePass12345!"');
console.error('  $env:SMOKE_STUDENT_IDENTIFIER = "student.smoke@example.test"');
console.error('  $env:SMOKE_STUDENT_PASSWORD   = "LocalSmokePass12345!"');
console.error("");
console.error("Bash:");
console.error('  export SMOKE_ADMIN_IDENTIFIER=admin.smoke@example.test');
console.error('  export SMOKE_ADMIN_PASSWORD=LocalSmokePass12345!');
console.error('  export SMOKE_TEACHER_IDENTIFIER=teacher.smoke@example.test');
console.error('  export SMOKE_TEACHER_PASSWORD=LocalSmokePass12345!');
console.error('  export SMOKE_STUDENT_IDENTIFIER=student.smoke@example.test');
console.error('  export SMOKE_STUDENT_PASSWORD=LocalSmokePass12345!');
console.error("");
console.error("Then provision fixtures and run smoke:");
console.error("  npm run seed:smoke");
console.error("  npm run e2e:smoke");
console.error("");
console.error("Notes:");
console.error("  * These vars are for local or staging only. Never reuse production credentials.");
console.error("  * In CI, set them as GitHub Actions secrets, never inline in YAML.");
console.error("  * npm run e2e:responsive does NOT require these vars; it tests auth pages only.");
process.exit(1);
