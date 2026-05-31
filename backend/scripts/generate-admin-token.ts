import { PrismaClient } from '@prisma/client';
import { TokenService } from '../src/auth/token.service';

async function main() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
  });

  if (!admin) {
    console.error('No active admin user found.');
    process.exit(1);
  }

  // Manually setting env vars if they are not loaded automatically by ts-node
  process.env.JWT_ACCESS_SECRET = 'local_dev_access_secret_32_char_min';
  process.env.JWT_REFRESH_SECRET = 'local_dev_refresh_secret_32_min';
  process.env.JWT_ISSUER = 'projtrack-api-local';
  process.env.JWT_AUDIENCE = 'projtrack-web-local';
  process.env.JWT_KEY_ID = 'local-dev';

  const tokenService = new TokenService();
  const token = tokenService.createAccessToken({
    id: admin.id,
    role: admin.role,
    email: admin.email,
  });

  console.log(token);
  await prisma.$disconnect();
}

main();
