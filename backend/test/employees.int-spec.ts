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
let employeeSequence = 0;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must point to a disposable test database.');
  await prisma.$connect();
});

afterAll(async () => prisma.$disconnect());

beforeEach(async () => {
  employeeSequence = 0;
  await prisma.$executeRawUnsafe(
    'TRUNCATE "SalaryChangeAudit", "SalaryHistory", "Employee", "User" RESTART IDENTITY CASCADE',
  );
  const actor = await prisma.user.create({
    data: { email: 'hr@example.test', passwordHash: 'not-used', role: 'HR_MANAGER' },
  });
  actorId = actor.id;
});

async function createEmployee(overrides: Record<string, unknown> = {}) {
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `ACM-${String(++employeeSequence).padStart(5, '0')}`,
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
  await prisma.salaryHistory.create({
    data: {
      employeeId: employee.id,
      salary: employee.salary,
      currency: employee.currency,
      effectiveDate: employee.effectiveDate,
    },
  });
  return employee;
}

describe('EmployeesService against PostgreSQL', () => {
  it('creates an employee and the opening salary history in one transaction', async () => {
    const employee = await service.createEmployee({
      employeeCode: 'ACM-10001',
      fullName: 'Aarav Patel',
      department: 'Engineering',
      country: 'India',
      jobTitle: 'Software Engineer',
      level: 'MID',
      hireDate: '2025-01-10',
      currency: 'INR',
      salary: 1800000,
      effectiveDate: '2025-01-10',
    });

    expect(employee.employeeId).toBe('ACM-10001');
    expect(employee.isActive).toBe(true);
    expect(await prisma.salaryHistory.count({ where: { employeeId: employee.id } })).toBe(1);
    expect((await prisma.salaryHistory.findFirstOrThrow({ where: { employeeId: employee.id } })).salary.toString()).toBe('1800000');
  });

  it('updates roster fields and soft-deactivates without removing salary history', async () => {
    const employee = await createEmployee();
    await service.updateEmployee(employee.id, { department: 'Product', jobTitle: 'Product Manager' });
    await service.deactivateEmployee(employee.id);

    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).isActive).toBe(false);
    expect(await prisma.salaryHistory.count({ where: { employeeId: employee.id } })).toBe(1);
    expect(await service.listEmployees()).toMatchObject({ total: 0, data: [] });
  });

  it('refuses salary edits after an employee is deactivated', async () => {
    const employee = await createEmployee();
    await service.deactivateEmployee(employee.id);

    await expect(service.updateSalary(
      employee.id,
      { salary: 110000, effectiveDate: '2025-06-01', reason: 'Should not apply' },
      actorId,
    )).rejects.toThrow(/not found/);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).salary.toString()).toBe('100000');
  });

  it('writes salary, history and audit atomically', async () => {
    const employee = await createEmployee();

    await service.updateSalary(
      employee.id,
      { salary: 110000, effectiveDate: '2025-06-01', reason: 'Annual review' },
      actorId,
    );

    const stored = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(stored.salary.toString()).toBe('110000');
    expect(await prisma.salaryHistory.count({ where: { employeeId: employee.id } })).toBe(2);
    const history = await prisma.salaryHistory.findMany({ where: { employeeId: employee.id } });
    expect(history.map((entry) => entry.salary.toString()).sort()).toEqual(['100000', '110000']);
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
    expect(await prisma.salaryHistory.count()).toBe(1);
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

  it('groups by job title and keeps currency groups separate', async () => {
    await createEmployee({ jobTitle: 'Software Engineer', salary: '100000.00' });
    await createEmployee({ jobTitle: 'Product Manager', department: 'Product', salary: '110000.00' });
    await createEmployee({ jobTitle: 'Software Engineer', country: 'India', currency: 'INR', salary: '1800000.00' });

    const result = await service.getAnalytics({ dimension: 'jobTitle' });

    expect(result.groups).toEqual([
      expect.objectContaining({ key: 'Product Manager', currency: 'USD', count: 1 }),
      expect.objectContaining({ key: 'Software Engineer', currency: 'USD', count: 1 }),
      expect.objectContaining({ key: 'Software Engineer', currency: 'INR', count: 1 }),
    ]);
  });

  it('flags high and low pay versus peer medians, excluding inactive and small groups', async () => {
    for (const salary of ['100000', '100000', '100000', '100000', '100000', '200000', '40000']) {
      await createEmployee({ salary: `${salary}.00` });
    }
    const inactive = await createEmployee({ salary: '500000.00' });
    await service.deactivateEmployee(inactive.id);
    for (const salary of ['50000', '50000', '50000', '50000']) {
      await createEmployee({ country: 'Canada', salary: `${salary}.00` });
    }

    const result = await service.getOutliers();

    expect(result.map((item) => item.salary).sort((a, b) => a - b)).toEqual([40000, 200000]);
    expect(result.every((item) => item.peerCount === 7)).toBe(true);
  });
});
