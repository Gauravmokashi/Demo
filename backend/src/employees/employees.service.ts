import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Currency as PrismaCurrency, JobLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsDimension,
  AnalyticsQueryDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from './employee-query.dto';
import { EmployeeFilter, EmployeeQuery } from './employees.types';
import { LARGE_CHANGE_THRESHOLD, UpdateSalaryDto } from './salary-update.dto';

type EmployeeRecord = {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string;
  country: string;
  jobTitle: string;
  level: JobLevel;
  hireDate: Date;
  currency: PrismaCurrency;
  salary: Prisma.Decimal;
  effectiveDate: Date;
  isActive: boolean;
};

type AnalyticsRow = {
  key: string;
  currency: PrismaCurrency;
  count: number;
  min: Prisma.Decimal;
  p25: number;
  median: number;
  p75: number;
  max: Prisma.Decimal;
  average: Prisma.Decimal;
  total: Prisma.Decimal;
};

// Whitelisted column identifiers: user input selects a key, never raw SQL.
const ANALYTICS_COLUMNS: Record<AnalyticsDimension, Prisma.Sql> = {
  country: Prisma.raw('"country"'),
  department: Prisma.raw('"department"'),
  level: Prisma.raw('"level"'),
  jobTitle: Prisma.raw('"jobTitle"'),
};

// Static, illustrative rates for comparison only. Stored salaries are never converted.
const USD_RATES: Record<PrismaCurrency, Prisma.Decimal> = {
  USD: new Prisma.Decimal('1'),
  EUR: new Prisma.Decimal('1.08'),
  GBP: new Prisma.Decimal('1.27'),
  INR: new Prisma.Decimal('0.012'),
};

const CSV_HEADERS = [
  'id', 'employeeCode', 'fullName', 'jobTitle', 'level', 'department', 'country', 'hireDate',
  'currency', 'salary', 'effectiveDate',
];

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions() {
    const [countries, departments, jobTitles] = await Promise.all([
      this.prisma.employee.groupBy({ by: ['country'], where: { isActive: true }, orderBy: { country: 'asc' } }),
      this.prisma.employee.groupBy({ by: ['department'], where: { isActive: true }, orderBy: { department: 'asc' } }),
      this.prisma.employee.groupBy({ by: ['jobTitle'], where: { isActive: true }, orderBy: { jobTitle: 'asc' } }),
    ]);
    return {
      countries: countries.map(({ country }) => country),
      departments: departments.map(({ department }) => department),
      jobTitles: jobTitles.map(({ jobTitle }) => jobTitle),
    };
  }

  async getSummary() {
    const [totalEmployees, currencyGroups, countryGroups, departmentGroups] = await Promise.all([
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.employee.groupBy({
        by: ['currency'],
        where: { isActive: true },
        _sum: { salary: true },
        _avg: { salary: true },
        _count: { _all: true },
        orderBy: { currency: 'asc' },
      }),
      this.prisma.employee.groupBy({ by: ['country'], where: { isActive: true }, _count: { _all: true }, orderBy: { country: 'asc' } }),
      this.prisma.employee.groupBy({
        by: ['department'],
        where: { isActive: true },
        _count: { _all: true },
        orderBy: { department: 'asc' },
      }),
    ]);

    return {
      totalEmployees,
      averageSalaryByCurrency: currencyGroups.map((item) => ({
        currency: item.currency,
        average: Number(item._avg.salary ?? 0),
      })),
      payrollByCurrency: currencyGroups.map((item) => ({
        currency: item.currency,
        total: Number(item._sum.salary ?? 0),
        employeeCount: item._count._all,
      })),
      payrollInUsd: Number(currencyGroups.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item._sum.salary ?? 0).mul(USD_RATES[item.currency])),
        new Prisma.Decimal(0),
      )),
      usdRatesAreIllustrative: true,
      countries: countryGroups.map((item) => ({ country: item.country, count: item._count._all })),
      departments: departmentGroups.map((item) => ({
        department: item.department,
        count: item._count._all,
      })),
      levels: Object.values(JobLevel),
    };
  }

  async listEmployees(query: EmployeeQuery = {}) {
    const page = Math.max(1, this.toPositiveInteger(query.page, 1));
    const limit = Math.min(100, this.toPositiveInteger(query.limit, 10));
    const where = this.buildWhere(query);
    const total = await this.prisma.employee.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: this.buildOrderBy(query),
      skip: (safePage - 1) * limit,
      take: limit,
    });

    return {
      data: employees.map((employee) => this.serializeEmployee(employee)),
      page: safePage,
      limit,
      total,
      totalPages,
    };
  }

  async findById(id: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return this.serializeEmployee(employee);
  }

  async createEmployee(payload: CreateEmployeeDto) {
    const hireDate = new Date(`${payload.hireDate}T00:00:00.000Z`);
    const effectiveDate = new Date(`${payload.effectiveDate}T00:00:00.000Z`);
    this.assertEffectiveDateOnOrAfterHireDate(effectiveDate, hireDate);
    this.assertValidEffectiveDate(effectiveDate, effectiveDate);
    const salary = new Prisma.Decimal(payload.salary);
    const employee = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.employee.create({
        data: {
          employeeCode: payload.employeeCode,
          fullName: payload.fullName,
          department: payload.department,
          country: payload.country,
          jobTitle: payload.jobTitle,
          level: payload.level,
          hireDate,
          currency: payload.currency as PrismaCurrency,
          salary,
          effectiveDate,
          isActive: true,
        },
      });
      await transaction.salaryHistory.create({
        data: { employeeId: created.id, salary, currency: created.currency, effectiveDate },
      });
      return created;
    });
    return this.serializeEmployee(employee);
  }

  async updateEmployee(id: number, payload: UpdateEmployeeDto) {
    if (Object.keys(payload).length === 0) throw new BadRequestException('Provide at least one profile field to update.');
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing?.isActive) throw new NotFoundException(`Employee ${id} not found`);
    const hireDate = payload.hireDate ? new Date(`${payload.hireDate}T00:00:00.000Z`) : existing.hireDate;
    this.assertEffectiveDateOnOrAfterHireDate(existing.effectiveDate, hireDate);
    const data: Prisma.EmployeeUpdateManyMutationInput = {
      ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
      ...(payload.department !== undefined ? { department: payload.department } : {}),
      ...(payload.country !== undefined ? { country: payload.country } : {}),
      ...(payload.jobTitle !== undefined ? { jobTitle: payload.jobTitle } : {}),
      ...(payload.level !== undefined ? { level: payload.level } : {}),
      ...(payload.hireDate !== undefined ? { hireDate: new Date(`${payload.hireDate}T00:00:00.000Z`) } : {}),
    };
    const updated = await this.prisma.employee.updateMany({ where: { id, isActive: true }, data });
    if (updated.count === 0) throw new NotFoundException(`Employee ${id} not found`);
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return this.serializeEmployee(employee);
  }

  async deactivateEmployee(id: number) {
    const result = await this.prisma.employee.updateMany({
      where: { id, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) throw new NotFoundException(`Employee ${id} not found`);
    return { id, isActive: false };
  }

  async getHistory(id: number) {
    const employee = await this.findById(id);
    const [history, changes] = await Promise.all([
      this.prisma.salaryHistory.findMany({
        where: { employeeId: id },
        orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.salaryChangeAudit.findMany({
        where: { employeeId: id },
        orderBy: { changedAt: 'desc' },
        include: { actor: { select: { email: true } } },
      }),
    ]);

    return {
      employee,
      history: history.map((entry) => ({
        salary: Number(entry.salary),
        currency: entry.currency,
        effectiveDate: this.dateOnly(entry.effectiveDate),
      })),
      changes: changes.map((change) => ({
        previousSalary: Number(change.previousSalary),
        newSalary: Number(change.newSalary),
        currency: change.newCurrency,
        effectiveDate: this.dateOnly(change.effectiveDate),
        reason: change.reason,
        changedBy: change.actor.email,
        changedAt: change.changedAt.toISOString(),
      })),
    };
  }

  /**
   * Records a salary change. Rules:
   * - currency is fixed by the employee's record (no implicit FX conversion);
   * - effective date can't be in the future (scheduling is out of scope) or earlier than the
   *   current salary's effective date (would silently rewrite history);
   * - changes above LARGE_CHANGE_THRESHOLD need explicit confirmation.
   */
  async updateSalary(id: number, payload: UpdateSalaryDto, actorUserId: number) {
    const effectiveDate = new Date(`${payload.effectiveDate}T00:00:00.000Z`);
    const newSalary = new Prisma.Decimal(payload.salary);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const [current] = await transaction.$queryRaw<
        { salary: Prisma.Decimal; currency: PrismaCurrency; effectiveDate: Date; hireDate: Date; isActive: boolean }[]
      >(Prisma.sql`SELECT "salary", "currency", "effectiveDate", "hireDate", "isActive" FROM "Employee" WHERE "id" = ${id} FOR UPDATE`);
      if (!current?.isActive) throw new NotFoundException(`Employee ${id} not found`);

      this.assertEffectiveDateOnOrAfterHireDate(effectiveDate, current.hireDate);
      this.assertValidEffectiveDate(effectiveDate, current.effectiveDate);
      this.assertChangeConfirmed(Number(current.salary), payload.salary, payload.confirmLargeChange);

      const employee = await transaction.employee.update({
        where: { id },
        data: { salary: newSalary, effectiveDate },
      });
      await transaction.salaryHistory.create({
        data: { employeeId: id, salary: newSalary, currency: current.currency, effectiveDate },
      });
      await transaction.salaryChangeAudit.create({
        data: {
          actorUserId,
          employeeId: id,
          previousSalary: current.salary,
          newSalary,
          previousCurrency: current.currency,
          newCurrency: current.currency,
          effectiveDate,
          reason: payload.reason,
        },
      });
      return employee;
    });
    return this.serializeEmployee(updated);
  }

  /** Pay distribution per group, always split by currency. */
  async getAnalytics(query: AnalyticsQueryDto = {}) {
    const dimension = query.dimension ?? 'country';
    const column = ANALYTICS_COLUMNS[dimension];
    const conditions: Prisma.Sql[] = [];
    if (query.country) conditions.push(Prisma.sql`"country" = ${query.country}`);
    if (query.department) conditions.push(Prisma.sql`"department" = ${query.department}`);
    if (query.currency) conditions.push(Prisma.sql`"currency" = ${query.currency}::"Currency"`);
    conditions.unshift(Prisma.sql`"isActive" = true`);
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const rows = await this.prisma.$queryRaw<AnalyticsRow[]>(Prisma.sql`
      SELECT ${column}::text AS "key",
             "currency",
             COUNT(*)::int AS "count",
             MIN("salary") AS "min",
             percentile_cont(0.25) WITHIN GROUP (ORDER BY "salary") AS "p25",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "salary") AS "median",
             percentile_cont(0.75) WITHIN GROUP (ORDER BY "salary") AS "p75",
             MAX("salary") AS "max",
             AVG("salary") AS "average",
             SUM("salary") AS "total"
      FROM "Employee"
      ${where}
      GROUP BY ${column}, "currency"
      ORDER BY "currency", ${column}`);

    return {
      dimension,
      groups: rows.map((row) => ({
        key: row.key,
        currency: row.currency,
        count: Number(row.count),
        min: Number(row.min),
        p25: Number(row.p25),
        median: Number(row.median),
        p75: Number(row.p75),
        max: Number(row.max),
        average: Number(row.average),
        total: Number(row.total),
      })),
    };
  }

  /** Flags salary values outside 0.6x–1.5x of a peer median; groups need at least five people. */
  async getOutliers() {
    const rows = await this.prisma.$queryRaw<{
      id: number;
      employeeCode: string;
      fullName: string;
      jobTitle: string;
      country: string;
      currency: PrismaCurrency;
      salary: Prisma.Decimal;
      median: number;
      ratio: number;
      peerCount: number;
    }[]>(Prisma.sql`
      WITH peers AS (
        SELECT "jobTitle", "country", "currency",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY "salary") AS median,
               COUNT(*)::int AS "peerCount"
        FROM "Employee"
        WHERE "isActive" = true
        GROUP BY "jobTitle", "country", "currency"
        HAVING COUNT(*) >= 5
      )
      SELECT e."id", e."employeeCode", e."fullName", e."jobTitle", e."country", e."currency",
             e."salary", p.median, ROUND((e."salary" / p.median::numeric), 2) AS ratio,
             p."peerCount"
      FROM "Employee" e
      JOIN peers p USING ("jobTitle", "country", "currency")
      WHERE e."isActive" = true
        AND (e."salary" > p.median::numeric * 1.5 OR e."salary" < p.median::numeric * 0.6)
      ORDER BY ABS(LN(e."salary"::float / p.median)) DESC
      LIMIT 100`);
    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeCode,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      country: row.country,
      currency: row.currency,
      salary: Number(row.salary),
      peerMedian: Number(row.median),
      ratio: Number(row.ratio),
      peerCount: Number(row.peerCount),
    }));
  }

  async exportCsv(query: EmployeeQuery = {}) {
    const employees = await this.prisma.employee.findMany({
      where: this.buildWhere(query),
      orderBy: this.buildOrderBy(query),
    });
    const rows = employees.map((employee) =>
      [
        employee.id,
        employee.employeeCode,
        employee.fullName,
        employee.jobTitle,
        employee.level,
        employee.department,
        employee.country,
        this.dateOnly(employee.hireDate),
        employee.currency,
        employee.salary.toString(),
        this.dateOnly(employee.effectiveDate),
      ]
        .map((value) => this.toCsvCell(value))
        .join(','),
    );
    return [CSV_HEADERS.join(','), ...rows].join('\n');
  }

  private assertValidEffectiveDate(effectiveDate: Date, currentEffectiveDate: Date) {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (effectiveDate.getTime() > todayUtc) {
      throw new BadRequestException(
        'Effective date cannot be in the future; scheduled salary changes are not supported.',
      );
    }
    if (effectiveDate.getTime() < currentEffectiveDate.getTime()) {
      throw new BadRequestException(
        `Effective date must be on or after the current salary's effective date (${this.dateOnly(currentEffectiveDate)}).`,
      );
    }
  }

  private assertEffectiveDateOnOrAfterHireDate(effectiveDate: Date, hireDate: Date) {
    if (effectiveDate.getTime() < hireDate.getTime()) {
      throw new BadRequestException('Salary effective date cannot be before the employee hire date.');
    }
  }

  private assertChangeConfirmed(previous: number, next: number, confirmed?: boolean) {
    if (previous <= 0) return;
    const change = Math.abs(next - previous) / previous;
    if (change > LARGE_CHANGE_THRESHOLD && !confirmed) {
      throw new BadRequestException(
        `This is a ${Math.round(change * 100)}% change. Confirm large changes with confirmLargeChange: true.`,
      );
    }
  }

  private toCsvCell(value: unknown) {
    const text = String(value);
    const safeText = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text)
      ? `'${text}`
      : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }

  private buildWhere(query: EmployeeFilter): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = { isActive: true };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.country) where.country = query.country;
    if (query.department) where.department = query.department;
    if (query.level) where.level = query.level;
    if (query.currency) where.currency = query.currency as PrismaCurrency;
    if (query.minSalary !== undefined || query.maxSalary !== undefined) {
      where.salary = {
        ...(query.minSalary !== undefined ? { gte: query.minSalary } : {}),
        ...(query.maxSalary !== undefined ? { lte: query.maxSalary } : {}),
      };
    }
    return where;
  }

  private buildOrderBy(query: EmployeeQuery): Prisma.EmployeeOrderByWithRelationInput[] {
    const direction = query.sortOrder ?? 'asc';
    const field = query.sortBy ?? 'fullName';
    // Secondary keys keep pagination stable when the primary key has ties.
    return field === 'fullName'
      ? [{ fullName: direction }, { id: 'asc' }]
      : [{ [field]: direction }, { fullName: 'asc' }, { id: 'asc' }];
  }

  private serializeEmployee(employee: EmployeeRecord) {
    return {
      id: employee.id,
      employeeId: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      country: employee.country,
      jobTitle: employee.jobTitle,
      level: employee.level,
      hireDate: this.dateOnly(employee.hireDate),
      currency: employee.currency,
      salary: Number(employee.salary),
      effectiveDate: this.dateOnly(employee.effectiveDate),
      isActive: employee.isActive,
    };
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toPositiveInteger(value: number | undefined, fallback: number) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
