import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { EmployeesService } from './employees.service';

const decimal = (value: number) => ({ toString: () => value.toFixed(2), valueOf: () => value });

const databaseEmployee = {
  id: 1,
  employeeCode: 'ACM-00001',
  fullName: 'Maya Patel',
  department: 'Engineering',
  country: 'India',
  jobTitle: 'Senior Software Engineer',
  level: 'SENIOR' as const,
  hireDate: new Date('2020-06-15T00:00:00.000Z'),
  currency: 'INR' as const,
  salary: decimal(1800000),
  effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
  isActive: true,
};

function createService() {
  const transaction: any = {
    $queryRaw: jest.fn<() => Promise<any[]>>().mockResolvedValue([
      {
        salary: databaseEmployee.salary,
        currency: databaseEmployee.currency,
        effectiveDate: databaseEmployee.effectiveDate,
        hireDate: databaseEmployee.hireDate,
        isActive: true,
      },
    ]),
    employee: {
      create: jest.fn<() => Promise<any>>().mockResolvedValue(databaseEmployee),
      update: jest.fn<() => Promise<any>>().mockResolvedValue({
        ...databaseEmployee,
        salary: decimal(1900000),
      }),
      updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
    },
    salaryHistory: { create: jest.fn<() => Promise<any>>().mockResolvedValue({}) },
    salaryChangeAudit: { create: jest.fn<() => Promise<any>>().mockResolvedValue({}) },
  };
  const prisma: any = {
    employee: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn<() => Promise<any>>().mockResolvedValue(databaseEmployee),
      updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn(),
    },
    salaryHistory: { findMany: jest.fn() },
    salaryChangeAudit: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  };

  return { service: new EmployeesService(prisma as never), prisma, transaction };
}

const validChange = { salary: 1900000, effectiveDate: '2025-02-01', reason: 'Annual review' };

describe('EmployeesService', () => {
  describe('summary', () => {
    it('aggregates payroll and average salaries per currency in one query', async () => {
      const { service, prisma } = createService();
      prisma.employee.count.mockResolvedValue(2);
      prisma.employee.groupBy
        .mockResolvedValueOnce([
          { currency: 'INR', _sum: { salary: 3600000 }, _avg: { salary: 1800000 }, _count: { _all: 2 } },
        ])
        .mockResolvedValueOnce([{ country: 'India', _count: { _all: 2 } }])
        .mockResolvedValueOnce([{ department: 'Engineering', _count: { _all: 2 } }]);

      const summary = await service.getSummary();

      expect(prisma.employee.groupBy).toHaveBeenCalledTimes(3);
      expect(summary.totalEmployees).toBe(2);
      expect(summary.payrollByCurrency).toEqual([
        { currency: 'INR', total: 3600000, employeeCount: 2 },
      ]);
      expect(summary.averageSalaryByCurrency).toEqual([{ currency: 'INR', average: 1800000 }]);
      expect(summary.payrollInUsd).toBe(43200);
      expect(summary.usdRatesAreIllustrative).toBe(true);
      expect(summary.levels).toEqual(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL']);
    });
  });

  describe('directory', () => {
    it('uses database pagination and returns serializable employee values', async () => {
      const { service, prisma } = createService();
      prisma.employee.count.mockResolvedValue(125);
      prisma.employee.findMany.mockResolvedValue([databaseEmployee]);

      const result = await service.listEmployees({ page: 3, limit: 50, country: 'India' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 }),
      );
      expect(result.totalPages).toBe(3);
      expect(result.data[0]).toEqual({
        id: 1,
        employeeId: 'ACM-00001',
        fullName: 'Maya Patel',
        department: 'Engineering',
        country: 'India',
        jobTitle: 'Senior Software Engineer',
        level: 'SENIOR',
        hireDate: '2020-06-15',
        currency: 'INR',
        salary: 1800000,
        effectiveDate: '2025-01-01',
        isActive: true,
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

    it('sorts by the requested column with stable tie-breakers', async () => {
      const { service, prisma } = createService();
      prisma.employee.count.mockResolvedValue(1);
      prisma.employee.findMany.mockResolvedValue([]);

      await service.listEmployees({ currency: 'USD', sortBy: 'salary', sortOrder: 'desc' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ salary: 'desc' }, { fullName: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('applies level and salary-range filters', async () => {
      const { service, prisma } = createService();
      prisma.employee.count.mockResolvedValue(0);
      prisma.employee.findMany.mockResolvedValue([]);

      await service.listEmployees({ level: 'LEAD', currency: 'USD', minSalary: 100000, maxSalary: 200000 });

      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: { isActive: true, level: 'LEAD', currency: 'USD', salary: { gte: 100000, lte: 200000 } },
      });
    });
  });

  describe('CSV export', () => {
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
      prisma.employee.findMany.mockResolvedValue([{ ...databaseEmployee, fullName: formula }]);

      const csv = await service.exportCsv();
      const escapedFormula = formula.replace(/"/g, '""');

      expect(csv).toContain(`"'${escapedFormula}"`);
    });

    it('preserves ordinary CSV text while escaping quotes', async () => {
      const { service, prisma } = createService();
      prisma.employee.findMany.mockResolvedValue([{ ...databaseEmployee, fullName: 'Maya "MJ" Patel' }]);

      const csv = await service.exportCsv();

      expect(csv).toContain('"Maya ""MJ"" Patel"');
    });

    it('applies the same filters as the directory, including salary bounds', async () => {
      const { service, prisma } = createService();
      prisma.employee.findMany.mockResolvedValue([databaseEmployee]);

      const csv = await service.exportCsv({ currency: 'INR', minSalary: 1000000 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, currency: 'INR', salary: { gte: 1000000 } } }),
      );
      expect(csv.split('\n')).toHaveLength(2);
      expect(csv.split('\n')[0]).toContain('jobTitle');
    });
  });

  describe('salary update', () => {
    it('updates salary and writes history and an audit row with the reason in one transaction', async () => {
      const { service, prisma, transaction } = createService();

      const updated = await service.updateSalary(1, validChange, 42);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.employee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          salary: expect.objectContaining({ s: 1 }),
          effectiveDate: new Date('2025-02-01T00:00:00.000Z'),
        },
      });
      expect(transaction.salaryHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ employeeId: 1, currency: 'INR' }),
      });
      expect(transaction.salaryChangeAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: 42,
          employeeId: 1,
          previousSalary: databaseEmployee.salary,
          previousCurrency: 'INR',
          newCurrency: 'INR',
          effectiveDate: new Date('2025-02-01T00:00:00.000Z'),
          reason: 'Annual review',
        }),
      });
      expect(updated.salary).toBe(1900000);
    });

    it('rejects a future effective date', async () => {
      const { service, transaction } = createService();

      await expect(
        service.updateSalary(1, { ...validChange, effectiveDate: '2999-01-01' }, 42),
      ).rejects.toThrow(/cannot be in the future/);
      expect(transaction.employee.update).not.toHaveBeenCalled();
    });

    it('rejects an effective date earlier than the current salary', async () => {
      const { service, transaction } = createService();

      await expect(
        service.updateSalary(1, { ...validChange, effectiveDate: '2024-12-31' }, 42),
      ).rejects.toThrow(/on or after the current salary's effective date \(2025-01-01\)/);
      expect(transaction.employee.update).not.toHaveBeenCalled();
    });

    it('rejects a salary effective date before the hire date', async () => {
      const { service, transaction } = createService();

      await expect(
        service.updateSalary(1, { ...validChange, effectiveDate: '2020-06-14' }, 42),
      ).rejects.toThrow(/before the employee hire date/);
      expect(transaction.employee.update).not.toHaveBeenCalled();
    });

    it('requires confirmation for changes above 20%', async () => {
      const { service, transaction } = createService();

      await expect(service.updateSalary(1, { ...validChange, salary: 2500000 }, 42)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(transaction.employee.update).not.toHaveBeenCalled();

      await service.updateSalary(1, { ...validChange, salary: 2500000, confirmLargeChange: true }, 42);
      expect(transaction.employee.update).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when the employee does not exist', async () => {
      const { service, transaction } = createService();
      transaction.$queryRaw.mockResolvedValue([]);

      await expect(service.updateSalary(999, validChange, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not allow a salary change for a deactivated employee', async () => {
      const { service, transaction } = createService();
      transaction.$queryRaw.mockResolvedValueOnce([{ ...databaseEmployee, isActive: false }]);

      await expect(service.updateSalary(1, validChange, 42)).rejects.toBeInstanceOf(NotFoundException);
      expect(transaction.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('analytics', () => {
    it('returns pay distribution per group and currency as numbers', async () => {
      const { service, prisma } = createService();
      prisma.$queryRaw.mockResolvedValue([
        {
          key: 'Engineering',
          currency: 'USD',
          count: 3,
          min: decimal(90000),
          p25: 95000,
          median: 100000,
          p75: 105000,
          max: decimal(110000),
          average: decimal(100000),
          total: decimal(300000),
        },
      ]);

      const result = await service.getAnalytics({ dimension: 'department', country: 'United States' });

      expect(result).toEqual({
        dimension: 'department',
        groups: [
          {
            key: 'Engineering',
            currency: 'USD',
            count: 3,
            min: 90000,
            p25: 95000,
            median: 100000,
            p75: 105000,
            max: 110000,
            average: 100000,
            total: 300000,
          },
        ],
      });
      const sql = prisma.$queryRaw.mock.calls[0][0];
      expect(sql.sql).toContain('GROUP BY "department", "currency"');
      expect(sql.values).toEqual(['United States']);
    });

    it('defaults to grouping by country', async () => {
      const { service, prisma } = createService();
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getAnalytics();

      expect(result.dimension).toBe('country');
      expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain('GROUP BY "country", "currency"');
    });

    it('supports grouping pay by job title', async () => {
      const { service, prisma } = createService();
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getAnalytics({ dimension: 'jobTitle' });

      expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain('GROUP BY "jobTitle", "currency"');
    });

    it('uses the peer definition and excludes inactive employees for outliers', async () => {
      const { service, prisma } = createService();
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.getOutliers()).resolves.toEqual([]);
      const sql = prisma.$queryRaw.mock.calls[0][0].sql;
      expect(sql).toContain('HAVING COUNT(*) >= 5');
      expect(sql).toContain('"isActive" = true');
      expect(sql).toContain('p.median::numeric * 1.5');
      expect(sql).toContain('p.median::numeric * 0.6');
    });
  });

  describe('employee roster', () => {
    const newEmployee = {
      employeeCode: 'ACM-10001',
      fullName: 'Aarav Patel',
      department: 'Engineering',
      country: 'India',
      jobTitle: 'Software Engineer',
      level: 'MID' as const,
      hireDate: '2025-01-01',
      currency: 'INR',
      salary: 1800000,
      effectiveDate: '2025-01-01',
    };

    it('creates a roster row and opening salary history atomically', async () => {
      const { service, transaction } = createService();

      await service.createEmployee(newEmployee);

      expect(transaction.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ employeeCode: 'ACM-10001', isActive: true }),
      });
      expect(transaction.salaryHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ employeeId: 1, currency: 'INR' }),
      });
    });

    it('rejects a future opening effective date', async () => {
      const { service, transaction } = createService();
      await expect(service.createEmployee({ ...newEmployee, effectiveDate: '2999-01-01' })).rejects.toThrow(/cannot be in the future/);
      expect(transaction.employee.create).not.toHaveBeenCalled();
    });

    it('rejects an opening salary effective date before the hire date', async () => {
      const { service, transaction } = createService();
      await expect(service.createEmployee({ ...newEmployee, effectiveDate: '2024-12-31' })).rejects.toThrow(/before the employee hire date/);
      expect(transaction.employee.create).not.toHaveBeenCalled();
    });

    it('rejects a profile hire date after the current salary effective date', async () => {
      const { service, prisma } = createService();
      prisma.employee.findUnique.mockResolvedValue(databaseEmployee);

      await expect(service.updateEmployee(1, { hireDate: '2025-01-02' })).rejects.toThrow(/before the employee hire date/);
      expect(prisma.employee.updateMany).not.toHaveBeenCalled();
    });

    it('updates profile fields without changing compensation', async () => {
      const { service, prisma } = createService();
      prisma.employee.findUnique.mockResolvedValue(databaseEmployee);

      await service.updateEmployee(1, { department: 'Product' });

      expect(prisma.employee.updateMany).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
        data: { department: 'Product' },
      });
      expect(prisma.employee.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('soft-deactivates the employee and returns 404 for an already inactive record', async () => {
      const { service, prisma } = createService();

      await expect(service.deactivateEmployee(1)).resolves.toEqual({ id: 1, isActive: false });
      prisma.employee.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.deactivateEmployee(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty profile update', async () => {
      const { service, prisma } = createService();
      await expect(service.updateEmployee(1, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.employee.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('returns the salary timeline and attributed changes', async () => {
      const { service, prisma } = createService();
      prisma.employee.findUnique.mockResolvedValue(databaseEmployee);
      prisma.salaryHistory.findMany.mockResolvedValue([
        { salary: decimal(1800000), currency: 'INR', effectiveDate: new Date('2025-01-01T00:00:00.000Z') },
      ]);
      prisma.salaryChangeAudit.findMany.mockResolvedValue([
        {
          previousSalary: decimal(1700000),
          newSalary: decimal(1800000),
          newCurrency: 'INR',
          effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
          reason: 'Promotion',
          changedAt: new Date('2025-01-02T10:00:00.000Z'),
          actor: { email: 'hr@example.test' },
        },
      ]);

      const result = await service.getHistory(1);

      expect(result.history).toEqual([{ salary: 1800000, currency: 'INR', effectiveDate: '2025-01-01' }]);
      expect(result.changes[0]).toEqual({
        previousSalary: 1700000,
        newSalary: 1800000,
        currency: 'INR',
        effectiveDate: '2025-01-01',
        reason: 'Promotion',
        changedBy: 'hr@example.test',
        changedAt: '2025-01-02T10:00:00.000Z',
      });
    });

    it('throws when an employee does not exist', async () => {
      const { service, prisma } = createService();
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getHistory(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
