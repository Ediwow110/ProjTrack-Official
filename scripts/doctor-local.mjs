import { backendUrl, frontendUrl, tryFetchJson } from "./local-stack-utils.mjs";

async function main() {
  const backendLive = await tryFetchJson(`${backendUrl}/health/live`);
  const ready = await tryFetchJson(`${backendUrl}/health/ready`);
  const database = await tryFetchJson(`${backendUrl}/health/database`);
  const storage = await tryFetchJson(`${backendUrl}/health/storage`);
  const mail = await tryFetchJson(`${backendUrl}/health/mail`);

  const describeProtectedProbe = (probe) => {
    if (probe?.status === 401 || probe?.status === 403) {
      return "protected";
    }
    if (probe?.ok) {
      return probe.detail || "ok";
    }
    return JSON.stringify(probe);
  };

  let frontendStatus = "unreachable";
  try {
    const response = await fetch(`${frontendUrl}/student/login`);
    frontendStatus = response.ok ? "ok" : `HTTP ${response.status}`;
  } catch (error) {
    frontendStatus = error instanceof Error ? error.message : String(error);
  }

  console.log("Local stack report");
  console.log(`- Frontend: ${frontendStatus}`);
  console.log(`- Backend live: ${backendLive.ok ? "ok" : JSON.stringify(backendLive)}`);
  console.log(`- Database: ${describeProtectedProbe(database)}`);
  console.log(`- Storage: ${describeProtectedProbe(storage)}`);
  console.log(`- Mail: ${describeProtectedProbe(mail)}`);
  console.log(`- Ready: ${ready.ok ? "ready" : JSON.stringify(ready)}`);

  if (frontendStatus !== "ok" || !backendLive.ok || !ready.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
