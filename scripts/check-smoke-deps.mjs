import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import process from "node:process";

const postgresHost = process.env.SMOKE_POSTGRES_HOST || "127.0.0.1";
const postgresPort = Number(process.env.SMOKE_POSTGRES_PORT || 5432);
const composeFile = "backend/docker-compose.postgres.yml";

function checkCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  return {
    ok: result.status === 0,
    output: result.status === 0
      ? `${result.stdout || ""}${result.stderr || ""}`.trim()
      : `${result.stderr || ""}${result.stdout || ""}`.trim(),
  };
}

function canConnect(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

const checks = [];

checks.push({
  name: "Docker CLI",
  ...checkCommand("docker", ["--version"]),
});

checks.push({
  name: "Docker Compose",
  ...checkCommand("docker", ["compose", "version"]),
});

checks.push({
  name: "Local PostgreSQL compose file",
  ok: existsSync(composeFile),
  output: composeFile,
});

const dockerDaemon = checkCommand("docker", ["info"]);
checks.push({
  name: "Docker daemon",
  ok: dockerDaemon.ok,
  output: dockerDaemon.output,
});

checks.push({
  name: `PostgreSQL reachable at ${postgresHost}:${postgresPort}`,
  ok: await canConnect(postgresHost, postgresPort),
  output: `${postgresHost}:${postgresPort}`,
});

let failed = false;
for (const check of checks) {
  const icon = check.ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${check.name}`);
  if (!check.ok && check.output) {
    const firstLine = check.output
      .split(/\r?\n/)
      .find((line) => /failed|error|refused|not found|cannot|unavailable|denied|missing/i.test(line))
      || check.output.split(/\r?\n/).find(Boolean);
    if (firstLine) console.log(`  ${firstLine}`);
  }
  failed ||= !check.ok;
}

if (failed) {
  console.error("\nSmoke dependencies are not ready.");
  console.error("Expected local path:");
  console.error("1. Start Docker Desktop.");
  console.error("2. Run npm run prepare:local.");
  console.error("3. Run npm run check:smoke-deps.");
  console.error("4. Run npm run e2e:smoke.");
  process.exit(1);
}

console.log("\nSmoke dependencies are ready for npm run e2e:smoke.");
