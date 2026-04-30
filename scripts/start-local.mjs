import process from "process";
import {
  backendDir,
  backendUrl,
  clearListeningPorts,
  dockerCommand,
  frontendUrl,
  nodeCommand,
  npmCommand,
  rootDir,
  runCommand,
  startCommand,
  terminateProcessTree,
  waitForHttp,
  waitForPort,
} from "./local-stack-utils.mjs";
import { withLocalBackendEnv } from "./local-backend-env.mjs";
const args = new Set(process.argv.slice(2));
const prepareOnly = args.has("--prepare-only");

const managedChildren = [];
let shuttingDown = false;

function registerChild(name, child) {
  managedChildren.push({ name, child });
  child.on("exit", async (code) => {
    if (shuttingDown) return;
    if (code === 0 || code === null) return;

    shuttingDown = true;
    console.error(`[start-local] ${name} exited unexpectedly with code ${code}.`);
    await shutdown();
    process.exit(code ?? 1);
  });
  child.on("error", async (error) => {
    if (shuttingDown) return;

    shuttingDown = true;
    console.error(`[start-local] ${name} failed: ${error.message}`);
    await shutdown();
    process.exit(1);
  });
}

async function shutdown() {
  const children = [...managedChildren].reverse();
  await Promise.all(children.map(({ child }) => terminateProcessTree(child)));
}

process.on("SIGINT", async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await shutdown();
  process.exit(0);
});

async function ensureInfrastructure() {
  console.log("[start-local] Checking Docker engine...");
  await runCommand("docker info", dockerCommand, ["info"], { cwd: backendDir });

  console.log("[start-local] Starting PostgreSQL and MinIO...");
  await runCommand(
    "infra compose",
    dockerCommand,
    ["compose", "-f", "docker-compose.postgres.yml", "-f", "docker-compose.storage.yml", "up", "-d"],
    { cwd: backendDir },
  );
  await waitForPort(5432, "127.0.0.1", 60_000);
  await waitForPort(9000, "127.0.0.1", 60_000);
}

async function prepareDatabase() {
  console.log("[start-local] Generating Prisma client...");
  await runCommand("prisma generate", npmCommand, ["run", "prisma:generate"], {
    cwd: backendDir,
    env: withLocalBackendEnv(),
  });

  console.log("[start-local] Applying Prisma migrations...");
  await runCommand("prisma migrate deploy", npmCommand, ["run", "prisma:migrate:deploy"], {
    cwd: backendDir,
    env: withLocalBackendEnv(),
  });

  console.log("[start-local] Skipping automatic data seeding for production-safe local startup.");
}

async function ensureBackend() {
  console.log("[start-local] Starting backend...");
  const backend = startCommand("backend", nodeCommand, ["-r", "ts-node/register", "src/main.ts"], {
    cwd: backendDir,
    env: withLocalBackendEnv(),
  });
  registerChild("backend", backend);
  await waitForHttp(`${backendUrl}/health/live`, 120_000);
}

async function ensureFrontend() {
  console.log("[start-local] Starting frontend...");
  const frontend = startCommand(
    "frontend",
    npmCommand,
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
    {
      cwd: rootDir,
      env: {
        VITE_USE_BACKEND: "true",
        VITE_API_BASE_URL: backendUrl,
      },
    },
  );
  registerChild("frontend", frontend);
  await waitForHttp(`${frontendUrl}/student/login`, 120_000);
}

async function main() {
  console.log("[start-local] Clearing local app and test ports...");
  clearListeningPorts([3001, 5173, 3101, 4173]);

  await ensureInfrastructure();
  await prepareDatabase();

  if (prepareOnly) {
    console.log("[start-local] Local infrastructure and database are ready.");
    console.log("[start-local] Run `npm start` to launch the frontend and backend.");
    return;
  }

  await ensureBackend();
  await ensureFrontend();

  console.log("");
  console.log("[start-local] PROJTRACK is ready.");
  console.log(`[start-local] Frontend: ${frontendUrl}/student/login`);
  console.log(`[start-local] Backend: ${backendUrl}/health/live`);
  console.log("[start-local] Automatic demo account seeding is disabled.");
  console.log("[start-local] Mail stays pending until SMTP is configured.");

  await new Promise(() => {});
}

main().catch(async (error) => {
  console.error(`[start-local] ${error instanceof Error ? error.message : String(error)}`);
  shuttingDown = true;
  await shutdown();
  process.exit(1);
});
