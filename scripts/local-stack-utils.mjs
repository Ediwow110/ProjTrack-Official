import { execFileSync, spawn } from "child_process";
import net from "net";
import process from "process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const rootDir = resolve(scriptDir, "..");
export const backendDir = resolve(rootDir, "backend");
export const frontendUrl = "http://127.0.0.1:5173";
export const backendUrl = "http://127.0.0.1:3001";
export const nodeCommand = process.execPath;
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
export const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

function quoteForWindowsCmd(value) {
  const candidate = String(value);
  if (!/[\s"&()^<>|]/.test(candidate)) return candidate;
  return `"${candidate.replace(/"/g, '\\"')}"`;
}

function getSpawnConfig(command, args, options = {}) {
  const baseConfig = {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...(options.env ?? {}) },
  };

  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command)) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", [quoteForWindowsCmd(command), ...args.map(quoteForWindowsCmd)].join(" ")],
      options: baseConfig,
    };
  }

  return {
    command,
    args,
    options: baseConfig,
  };
}

function pipeWithPrefix(stream, target, label) {
  if (!stream) return;

  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      target.write(`[${label}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer) {
      target.write(`[${label}] ${buffer}\n`);
    }
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function runCommand(label, command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const spawnConfig = getSpawnConfig(command, args, options);
    const child = spawn(spawnConfig.command, spawnConfig.args, {
      ...spawnConfig.options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    pipeWithPrefix(child.stdout, process.stdout, label);
    pipeWithPrefix(child.stderr, process.stderr, label);

    child.on("error", (error) => {
      rejectPromise(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${label} exited with code ${code ?? "unknown"}.`));
    });
  });
}

export function startCommand(label, command, args, options = {}) {
  const spawnConfig = getSpawnConfig(command, args, options);
  const child = spawn(spawnConfig.command, spawnConfig.args, {
    ...spawnConfig.options,
    stdio: ["inherit", "pipe", "pipe"],
  });

  pipeWithPrefix(child.stdout, process.stdout, label);
  pipeWithPrefix(child.stderr, process.stderr, label);

  return child;
}

export function clearListeningPorts(ports) {
  const normalizedPorts = unique(ports.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
  if (!normalizedPorts.length) return;

  if (process.platform === "win32") {
    let output = "";
    try {
      output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return;
    }

    const listeners = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("LISTENING"))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 5)
      .filter((parts) =>
        normalizedPorts.some((port) => parts[1]?.endsWith(`:${port}`)),
      )
      .map((parts) => ({ pid: parts[4], port: normalizedPorts.find((port) => parts[1]?.endsWith(`:${port}`)) }));

    for (const { pid, port } of listeners) {
      try {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          stdio: ["ignore", "ignore", "ignore"],
        });
        process.stdout.write(`[ports] Cleared stale listener on port ${port} (pid ${pid}).\n`);
      } catch {
        // Best-effort cleanup only.
      }
    }
    return;
  }

  for (const port of normalizedPorts) {
    let output = "";
    try {
      output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
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
        process.stdout.write(`[ports] Cleared stale listener on port ${port} (pid ${pid}).\n`);
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

export function waitForPort(port, host = "127.0.0.1", timeoutMs = 60_000) {
  const startedAt = Date.now();

  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host });

      socket.once("connect", () => {
        socket.end();
        resolvePromise(true);
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          rejectPromise(new Error(`Timed out waiting for ${host}:${port}.`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

export async function waitForHttp(url, timeoutMs = 90_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // ignore transient boot errors
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

export async function tryFetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, status: response.status, url };
    }
    return await response.json();
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function terminateProcessTree(child) {
  if (!child?.pid) return;

  if (process.platform === "win32") {
    await new Promise((resolvePromise) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolvePromise());
      killer.on("error", () => resolvePromise());
    });
    return;
  }

  child.kill("SIGTERM");
}
