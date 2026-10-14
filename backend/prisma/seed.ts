import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { generateEmployees } from './seed-data';

const prisma = new PrismaClient();
const logger = new Logger('Seed');
const EMPLOYEE_COUNT = 10000;
const BATCH_SIZE = 1000;

async function seed() {
  const employees = generateEmployees(EMPLOYEE_COUNT);

  for (let offset = 0; offset < employees.length; offset += BATCH_SIZE) {
    await prisma.employee.createMany({
      data: employees.slice(offset, offset + BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  // Opening history row per employee so every salary timeline starts at a known value.
  // Idempotent: employees that already have history are skipped.
  const openedHistories = await prisma.$executeRaw`
    INSERT INTO "SalaryHistory" ("employeeId", "salary", "currency", "effectiveDate")
    SELECT e."id", e."salary", e."currency", e."effectiveDate"
    FROM "Employee" e
    WHERE NOT EXISTS (SELECT 1 FROM "SalaryHistory" h WHERE h."employeeId" = e."id")`;

  const count = await prisma.employee.count();
  logger.log(`Seed complete. ${count} employees available; ${openedHistories} opening history rows added.`);
}

seed()
  .catch((error: unknown) => {
    logger.error('Seed failed', error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
