const path = require("path");
const dotenv = require("dotenv");

process.env.ALLOW_DEMO_SEED = String(process.env.ALLOW_DEMO_SEED || "true");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: false,
});

require("ts-node/register");
require(path.resolve(__dirname, "../prisma/seed.ts"));
