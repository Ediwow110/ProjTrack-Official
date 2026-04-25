import { execFileSync } from "node:child_process";

const ports = [3101, 4173];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function killWindowsListeners(port) {
  let output = "";
  try {
    output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const pids = unique(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("LISTENING"))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 5)
      .filter((parts) => parts[1]?.endsWith(`:${port}`))
      .map((parts) => parts[4]),
  );

  for (const pid of pids) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      console.log(`Cleared stale listener on port ${port} (pid ${pid}).`);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function killWindowsPlaywrightBrowsers() {
  const script = [
    "$processes = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome-headless-shell.exe') -and",
    "  (",
    "    ($_.CommandLine -like '*playwright*') -or",
    "    ($_.CommandLine -like '*--remote-debugging-pipe*')",
    "  )",
    "}",
    "$processes | Select-Object -ExpandProperty ProcessId",
  ].join(" ");

  let output = "";
  try {
    output = execFileSync("powershell", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const pids = unique(
    output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  for (const pid of pids) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      console.log(`Cleared stale Playwright browser process ${pid}.`);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function killUnixListeners(port) {
  let output = "";
  try {
    output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const pids = unique(
    output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGKILL");
      console.log(`Cleared stale listener on port ${port} (pid ${pid}).`);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

for (const port of ports) {
  if (process.platform === "win32") {
    killWindowsListeners(port);
  } else {
    killUnixListeners(port);
  }
}

if (process.platform === "win32") {
  killWindowsPlaywrightBrowsers();
}
