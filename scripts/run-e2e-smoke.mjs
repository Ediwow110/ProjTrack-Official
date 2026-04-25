import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { clearListeningPorts } from "./local-stack-utils.mjs";

const specs = [
  "tests/e2e/auth-smoke.spec.ts",
  "tests/e2e/portal-navigation.spec.ts",
  "tests/e2e/workflow-smoke.spec.ts",
];

const transientPatterns = [
  /3221225477/,
  /browserType\.launch/i,
  /browserContext\.newPage/i,
  /Test timeout .* while setting up "page"/i,
  /Process from config\.webServer was not able to start/i,
  /spawn EPERM/i,
  /net::ERR_ABORTED/i,
  /\[e2e:smoke\].*timed out after/i,
];

function runPlaywright(spec) {
  return new Promise((resolve) => {
    const maxDurationMs = Number(process.env.PLAYWRIGHT_SPEC_TIMEOUT_MS || 240000);
    const child = spawn(
      process.execPath,
      ["./node_modules/@playwright/test/cli.js", "test", spec, "--project", "chromium"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSER_CHANNEL: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let combined = "";
    let resolved = false;
    const killChildTree = () => {
      if (process.platform === "win32") {
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        return;
      }
      child.kill("SIGTERM");
    };

    const watchdog = setTimeout(() => {
      if (resolved) return;
      combined += `\n[e2e:smoke] ${spec} timed out after ${maxDurationMs}ms.\n`;
      killChildTree();
      setTimeout(() => {
        if (!resolved) {
          killChildTree();
        }
      }, 5000).unref();
    }, maxDurationMs);

    const finalize = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(watchdog);
      resolve(result);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      combined += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      combined += chunk;
      process.stderr.write(chunk);
    });
    child.on("exit", (code) => finalize({ code: code ?? 1, output: combined }));
    child.on("error", (error) =>
      finalize({
        code: 1,
        output: `${combined}\n${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  });
}

function isTransientFailure(output) {
  return transientPatterns.some((pattern) => pattern.test(output));
}

async function runSpec(spec) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    process.stdout.write(`[e2e:smoke] Running ${spec} (attempt ${attempt}).\n`);
    clearListeningPorts([3101, 4173]);
    const result = await runPlaywright(spec);
    if (result.code === 0) return;
    if (attempt < 3 && isTransientFailure(result.output)) {
      process.stdout.write(`[e2e:smoke] Retrying ${spec} after transient Playwright failure.\n`);
      continue;
    }
    process.exit(result.code);
  }
}

for (const spec of specs) {
  await runSpec(spec);
}
