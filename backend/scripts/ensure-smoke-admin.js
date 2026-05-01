const { randomBytes, scryptSync } = require('crypto');
const { PrismaClient } = require('@prisma/client');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const email = String(process.env.SMOKE_ADMIN_EMAIL || process.env.SMOKE_ADMIN_IDENTIFIER || '').trim().toLowerCase();
  const password = String(process.env.SMOKE_ADMIN_PASSWORD || '');

  if (!email || !password) {
    throw new Error('SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required to bootstrap the CI smoke admin.');
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
        firstName: 'CI',
        lastName: 'Smoke Admin',
      },
      update: {
        passwordHash: hashPassword(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'CI',
        lastName: 'Smoke Admin',
      },
    });
    console.log(`Smoke admin ready for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
