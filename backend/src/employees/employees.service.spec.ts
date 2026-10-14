import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { EmployeesService } from './employees.service';

const databaseEmployee = {
  id: 1,
  employeeCode: 'ACM-00001',
  fullName: 'Maya Patel',
  department: 'Engineering',
  country: 'India',
  currency: 'INR' as const,
  salary: { toString: () => '1800000.00', valueOf: () => 1800000 },
  effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
};

function createService() {
  const transactionEmployee = {
      update: jest.fn<() => Promise<any>>().mockResolvedValue({
      ...databaseEmployee,
      salary: { toString: () => '2000000.00', valueOf: () => 2000000 },
    }),
  };
  const transaction: any = {
    $queryRaw: jest.fn<() => Promise<any[]>>().mockResolvedValue([databaseEmployee]),
    employee: transactionEmployee,
    salaryHistory: { create: jest.fn<() => Promise<any>>().mockResolvedValue({}) },
    salaryChangeAudit: { create: jest.fn<() => Promise<any>>().mockResolvedValue({}) },
  };
  const prisma: any = {
    employee: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  };

  return { service: new EmployeesService(prisma as never), prisma, transaction };
}

describe('EmployeesService', () => {
  it('aggregates payroll and average salaries by currency', async () => {
    const { service, prisma } = createService();
    prisma.employee.count.mockResolvedValue(2);
    prisma.employee.groupBy
      .mockResolvedValueOnce([{ currency: 'INR', _sum: { salary: 3600000 }, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ country: 'India', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ department: 'Engineering', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ currency: 'INR', _avg: { salary: 1800000 } }]);

    const summary = await service.getSummary();

    expect(summary.totalEmployees).toBe(2);
    expect(summary.payrollByCurrency).toEqual([
      { currency: 'INR', total: 3600000, employeeCount: 2 },
    ]);
    expect(summary.averageSalaryByCurrency).toEqual([{ currency: 'INR', average: 1800000 }]);
  });

  it('uses database pagination and returns serializable employee values', async () => {
    const { service, prisma } = createService();
    prisma.employee.count.mockResolvedValue(125);
    prisma.employee.findMany.mockResolvedValue([databaseEmployee]);

    const result = await service.listEmployees({ page: 3, limit: 50, country: 'India' });

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
    expect(result.totalPages).toBe(3);
    expect(result.data[0]).toMatchObject({
      employeeId: 'ACM-00001',
      salary: 1800000,
      effectiveDate: '2025-01-01',
    });
  });

  it('clamps page requests beyond the final page', async () => {
    const { service, prisma } = createService();
    prisma.employee.count.mockResolvedValue(11);
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.listEmployees({ page: 99, limit: 10 });

    expect(result.page).toBe(2);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it.each([
    '=1+1',
    '+1+1',
    '-1+1',
    '@SUM(1,1)',
    ' \t=HYPERLINK("https://example.test")',
    '\r\n+SUM(1,1)',
    '\u0001@SUM(1,1)',
  ])('neutralizes spreadsheet formulas after untrusted prefix %j', async (formula) => {
    const { service, prisma } = createService();
    prisma.employee.findMany.mockResolvedValue([
      { ...databaseEmployee, fullName: formula },
    ]);

    const csv = await service.exportCsv();
    const escapedFormula = formula.replace(/"/g, '""');

    expect(csv).toContain(`"'${escapedFormula}"`);
  });

  it('preserves ordinary CSV text while escaping quotes', async () => {
    const { service, prisma } = createService();
    prisma.employee.findMany.mockResolvedValue([
      { ...databaseEmployee, fullName: 'Maya "MJ" Patel' },
    ]);

    const csv = await service.exportCsv();

    expect(csv).toContain('"Maya ""MJ"" Patel"');
  });

  it('updates salary and writes salary history in one transaction', async () => {
    const { service, prisma, transaction } = createService();
    prisma.employee.findUnique.mockResolvedValue(databaseEmployee);

    const updated = await service.updateSalary(1, {
      salary: 2000000,
      currency: 'INR',
      effectiveDate: '2025-02-01',
    }, 42);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.salaryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ employeeId: 1 }) }),
    );
    expect(transaction.salaryChangeAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 42,
        employeeId: 1,
        previousSalary: databaseEmployee.salary,
        newSalary: expect.objectContaining({ s: 1, e: 6, d: [2000000] }),
        previousCurrency: 'INR',
        newCurrency: 'INR',
        effectiveDate: new Date('2025-02-01T00:00:00.000Z'),
      }),
    });
    expect(updated.salary).toBe(2000000);
  });

  it('throws when an employee does not exist', async () => {
    const { service, prisma } = createService();
    prisma.employee.findUnique.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
