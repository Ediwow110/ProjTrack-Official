import { env } from '../src/config/env';

// Configuration for Prisma datasource
export const datasourceConfig = {
  url: env.DATABASE_URL,
};

// Optionally, if using Prisma Accelerate, configure accelerateUrl
// export const accelerateUrl = env.ACCELERATE_URL;
