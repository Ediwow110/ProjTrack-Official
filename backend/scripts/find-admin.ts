import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  console.log(JSON.stringify(admin));
  await prisma.$disconnect();
}

main();
