const { randomBytes, scryptSync } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const DEFAULT_ADMIN_EMAIL = 'admin@projtrack.codes';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const email = String(
    process.env.PROJTRACK_ADMIN_EMAIL ||
      process.env.SMOKE_ADMIN_EMAIL ||
      process.env.SMOKE_ADMIN_IDENTIFIER ||
      DEFAULT_ADMIN_EMAIL,
  ).trim().toLowerCase();
  const password = String(process.env.PROJTRACK_ADMIN_PASSWORD || process.env.SMOKE_ADMIN_PASSWORD || '');

  if (!password) {
    throw new Error(
      'A password is required to bootstrap the admin account. Set PROJTRACK_ADMIN_PASSWORD or SMOKE_ADMIN_PASSWORD.',
    );
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hashPassword(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'ProjTrack',
        lastName: 'Admin',
      },
      update: {
        passwordHash: hashPassword(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'ProjTrack',
        lastName: 'Admin',
      },
    });
    console.log(`Admin account ready for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
