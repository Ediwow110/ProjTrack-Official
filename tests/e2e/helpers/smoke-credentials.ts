import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RoleCredential = {
  identifier: string;
  password: string;
};

type SeededSmokeCredentials = {
  teacher?: Partial<RoleCredential>;
  student?: Partial<RoleCredential>;
};

const generatedCredentialsPath = path.resolve(
  fileURLToPath(new URL("../../../.tmp/smoke-credentials.json", import.meta.url)),
);

function readRequiredEnv(name: string) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(
      `[smoke-credentials] Missing required env var ${name}. Run "npm run check:smoke-env" and set the admin smoke credentials before running browser smoke.`,
    );
  }
  return value;
}

function readGeneratedCredentials(): SeededSmokeCredentials {
  if (!existsSync(generatedCredentialsPath)) {
    throw new Error(
      `[smoke-credentials] Missing generated smoke credential file at ${generatedCredentialsPath}. Run "npm run seed:smoke" before running browser smoke. Teacher/student credentials are created during smoke fixture seeding.`,
    );
  }

  const raw = readFileSync(generatedCredentialsPath, "utf8");
  try {
    return JSON.parse(raw) as SeededSmokeCredentials;
  } catch (error) {
    throw new Error(
      `[smoke-credentials] Could not parse ${generatedCredentialsPath}. Rerun "npm run seed:smoke". Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readGeneratedRole(role: "teacher" | "student"): RoleCredential {
  const credentials = readGeneratedCredentials()[role];
  const identifier = String(credentials?.identifier ?? "").trim();
  const password = String(credentials?.password ?? "").trim();
  if (!identifier || !password) {
    throw new Error(
      `[smoke-credentials] Generated ${role} credentials are missing from ${generatedCredentialsPath}. Rerun "npm run seed:smoke".`,
    );
  }
  return { identifier, password };
}

export const smokeCredentials = {
  admin: {
    get identifier() {
      return readRequiredEnv("SMOKE_ADMIN_IDENTIFIER");
    },
    get password() {
      return readRequiredEnv("SMOKE_ADMIN_PASSWORD");
    },
  },
  teacher: {
    get identifier() {
      return readGeneratedRole("teacher").identifier;
    },
    get password() {
      return readGeneratedRole("teacher").password;
    },
  },
  student: {
    get identifier() {
      return readGeneratedRole("student").identifier;
    },
    get password() {
      return readGeneratedRole("student").password;
    },
  },
} as const;

export const smokeCredentialsFilePath = generatedCredentialsPath;
