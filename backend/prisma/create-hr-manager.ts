import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createInitialHrManager() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Set NODE_ENV=development to run the initial HR-manager bootstrap.');
  }

  const email = process.env.INITIAL_HR_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_HR_PASSWORD;
  if (!email || !password || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set INITIAL_HR_EMAIL and a 12-72 byte INITIAL_HR_PASSWORD in backend/.env.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error('INITIAL_HR_EMAIL must be a valid email address.');
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new Error('An account with INITIAL_HR_EMAIL already exists; bootstrap does not overwrite accounts.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, role: UserRole.HR_MANAGER, isActive: true },
  });
  console.log('Initial HR-manager account created.');
}

createInitialHrManager()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'HR-manager bootstrap failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());