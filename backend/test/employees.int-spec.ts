import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmployeesService } from '../src/employees/employees.service';

/**
 * Exercises the parts mocks cannot prove: the raw SQL (row lock, percentile analytics)
 * and transactional atomicity against real PostgreSQL. Each test starts from empty tables.
 */
const prisma = new PrismaService();
const service = new EmployeesService(prisma);
let actorId: number;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must point to a disposable test database.');
  await prisma.$connect();
});

afterAll(async () => prisma.$disconnect());

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "SalaryChangeAudit", "SalaryHistory", "Employee", "User" RESTART IDENTITY CASCADE',
  );
  const actor = await prisma.user.create({
    data: { email: 'hr@example.test', passwordHash: 'not-used', role: 'HR_MANAGER' },
  });
  actorId = actor.id;
});

async function createEmployee(overrides: Record<string, unknown> = {}) {
  return prisma.employee.create({
    data: {
      employeeCode: `ACM-${Math.random().toString(36).slice(2, 8)}`,
      fullName: 'Maya Patel',
      department: 'Engineering',
      country: 'United States',
      jobTitle: 'Software Engineer',
      level: 'MID',
      hireDate: new Date('2022-01-10'),
      currency: 'USD',
      salary: '100000.00',
      effectiveDate: new Date('2025-01-01'),
      ...overrides,
    },
  });
}

describe('EmployeesService against PostgreSQL', () => {
  it('writes salary, history and audit atomically', async () => {
    const employee = await createEmployee();

    await service.updateSalary(
      employee.id,
      { salary: 110000, effectiveDate: '2025-06-01', reason: 'Annual review' },
      actorId,
    );

    const stored = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(stored.salary.toString()).toBe('110000');
    expect(await prisma.salaryHistory.count({ where: { employeeId: employee.id } })).toBe(1);
    const audit = await prisma.salaryChangeAudit.findFirstOrThrow({ where: { employeeId: employee.id } });
    expect(audit).toMatchObject({ actorUserId: actorId, reason: 'Annual review' });
    expect(audit.previousSalary.toString()).toBe('100000');
  });

  it('leaves no partial writes when a business rule rejects the change', async () => {
    const employee = await createEmployee();

    await expect(
      service.updateSalary(
        employee.id,
        { salary: 200000, effectiveDate: '2025-06-01', reason: 'Too large without confirmation' },
        actorId,
      ),
    ).rejects.toThrow(/Confirm large changes/);

    const stored = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(stored.salary.toString()).toBe('100000');
    expect(await prisma.salaryHistory.count()).toBe(0);
    expect(await prisma.salaryChangeAudit.count()).toBe(0);
  });

  it('computes medians and quartiles per group and currency', async () => {
    for (const salary of ['80000.00', '100000.00', '120000.00']) {
      await createEmployee({ salary });
    }
    await createEmployee({ country: 'India', currency: 'INR', salary: '1800000.00' });

    const result = await service.getAnalytics({ dimension: 'department' });

    expect(result.groups).toEqual([
      expect.objectContaining({
        key: 'Engineering',
        currency: 'USD',
        count: 3,
        min: 80000,
        p25: 90000,
        median: 100000,
        p75: 110000,
        max: 120000,
        total: 300000,
      }),
      // Currencies follow the enum order (USD, EUR, GBP, INR).
      expect.objectContaining({ key: 'Engineering', currency: 'INR', count: 1, median: 1800000 }),
    ]);
  });

  it('orders levels by seniority, not alphabetically', async () => {
    await createEmployee({ level: 'PRINCIPAL' });
    await createEmployee({ level: 'JUNIOR' });
    await createEmployee({ level: 'LEAD' });

    const result = await service.getAnalytics({ dimension: 'level', currency: 'USD' });

    expect(result.groups.map((group) => group.key)).toEqual(['JUNIOR', 'LEAD', 'PRINCIPAL']);
  });
});
