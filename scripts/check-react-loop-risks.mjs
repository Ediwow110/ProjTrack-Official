#!/usr/bin/env node
/**
 * check-react-loop-risks.mjs
 *
 * Static audit script that flags React component patterns known to cause
 * "Maximum update depth exceeded" (error #185) render loops.
 *
 * Dangerous pattern:
 *   1. Unstable fallback array:   const x = data?.items ?? [];
 *   2. Derived via useMemo:       useMemo(() => ..., [x]);
 *   3. Effect depends on derived: useEffect(() => ..., [derived]);
 *   4. Effect calls setState with a new reference even when contents match.
 *
 * Usage:  node scripts/check-react-loop-risks.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src", "app");

function findFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith("node_modules")) {
      results.push(...findFiles(full));
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = findFiles(SRC);
let exitCode = 0;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");

  const unstableFallbacks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(\w+\??\.\w+)\s*\?\?\s*\[\]/);
    if (match) {
      const [, varName, source] = match;
      unstableFallbacks.push({ line: i + 1, varName, source });
    }
  }

  if (unstableFallbacks.length === 0) continue;

  for (const fb of unstableFallbacks) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const depMatch = line.match(
        new RegExp(`use(?:Memo|Effect)\\(.*\\[.*\\b${fb.varName}\\b.*\\]`),
      );
      if (depMatch) {
        const rel = relative(ROOT, file);
        console.warn(
          `[RISK] ${rel}:${fb.line} - "${fb.varName}" = ${fb.source} ?? [] ` +
          `is an unstable fallback referenced in useMemo/useEffect at line ${i + 1}.`,
        );
        exitCode = 1;
      }
    }
  }
}

if (exitCode === 0) {
  console.log("[OK] No React loop-risk patterns detected.");
}

process.exit(exitCode);
