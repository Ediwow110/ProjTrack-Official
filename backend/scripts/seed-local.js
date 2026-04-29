const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: false,
});

const isProductionLike = [process.env.NODE_ENV, process.env.APP_ENV].some(
  (value) => String(value || "").trim().toLowerCase() === "production",
);

if (isProductionLike) {
  console.error("seed:local is blocked when NODE_ENV or APP_ENV is production.");
  process.exit(1);
}

process.env.ALLOW_DEMO_SEED = String(process.env.ALLOW_DEMO_SEED || "true");

require("ts-node/register");
require(path.resolve(__dirname, "../prisma/seed.ts"));
