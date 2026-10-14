import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency as PrismaCurrency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeQuery } from './employees.types';
import { UpdateSalaryDto } from './salary-update.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [totalEmployees, payrollGroups, countryGroups, departmentGroups, averages] =
      await Promise.all([
        this.prisma.employee.count(),
        this.prisma.employee.groupBy({
          by: ['currency'],
          _sum: { salary: true },
          _count: { _all: true },
        }),
        this.prisma.employee.groupBy({ by: ['country'], _count: { _all: true } }),
        this.prisma.employee.groupBy({ by: ['department'], _count: { _all: true } }),
        this.prisma.employee.groupBy({ by: ['currency'], _avg: { salary: true } }),
      ]);

    return {
      totalEmployees,
      averageSalaryByCurrency: averages.map((item) => ({
        currency: item.currency,
        average: Number(item._avg.salary ?? 0),
      })),
      payrollByCurrency: payrollGroups.map((item) => ({
        currency: item.currency,
        total: Number(item._sum.salary ?? 0),
        employeeCount: item._count._all,
      })),
      countries: countryGroups.map((item) => ({ country: item.country, count: item._count._all })),
      departments: departmentGroups.map((item) => ({
        department: item.department,
        count: item._count._all,
      })),
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
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
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

  async updateSalary(id: number, payload: UpdateSalaryDto, actorUserId: number) {
    const effectiveDate = new Date(`${payload.effectiveDate}T00:00:00.000Z`);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const [current] = await transaction.$queryRaw<
        { salary: Prisma.Decimal; currency: PrismaCurrency }[]
      >(Prisma.sql`SELECT "salary", "currency" FROM "Employee" WHERE "id" = ${id} FOR UPDATE`);
      if (!current) throw new NotFoundException(`Employee ${id} not found`);

      const employee = await transaction.employee.update({
        where: { id },
        data: {
          salary: new Prisma.Decimal(payload.salary),
          currency: payload.currency as PrismaCurrency,
          effectiveDate,
        },
      });
      await transaction.salaryHistory.create({
        data: {
          employeeId: id,
          salary: new Prisma.Decimal(payload.salary),
          currency: payload.currency as PrismaCurrency,
          effectiveDate,
        },
      });
      await transaction.salaryChangeAudit.create({
        data: {
          actorUserId,
          employeeId: id,
          previousSalary: current.salary,
          newSalary: new Prisma.Decimal(payload.salary),
          previousCurrency: current.currency,
          newCurrency: payload.currency as PrismaCurrency,
          effectiveDate,
        },
      });
      return employee;
    });
    return this.serializeEmployee(updated);
  }

  async getAnalytics() {
    const [countryGroups, departmentGroups] = await Promise.all([
      this.prisma.employee.groupBy({
        by: ['country', 'currency'],
        _count: { _all: true },
        _sum: { salary: true },
        _avg: { salary: true },
        orderBy: [{ country: 'asc' }, { currency: 'asc' }],
      }),
      this.prisma.employee.groupBy({
        by: ['department', 'currency'],
        _count: { _all: true },
        _sum: { salary: true },
        _avg: { salary: true },
        orderBy: [{ department: 'asc' }, { currency: 'asc' }],
      }),
    ]);
    const metrics = (group: {
      currency: PrismaCurrency;
      _count: { _all: number };
      _avg: { salary: Prisma.Decimal | null };
      _sum: { salary: Prisma.Decimal | null };
    }) => ({
      currency: group.currency,
      count: group._count._all,
      average: Number(group._avg.salary ?? 0),
      total: Number(group._sum.salary ?? 0),
    });

    return {
      byCountry: countryGroups.map((group) => ({ country: group.country, ...metrics(group) })),
      byDepartment: departmentGroups.map((group) => ({
        department: group.department,
        ...metrics(group),
      })),
    };
  }

  async exportCsv(search?: string, country?: string, department?: string, currency?: string) {
    const employees = await this.prisma.employee.findMany({
      where: this.buildWhere({ search, country, department, currency }),
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    const headers = [
      'id', 'employeeCode', 'fullName', 'department', 'country', 'currency', 'salary', 'effectiveDate',
    ];
    const rows = employees.map((employee) =>
      [
        employee.id,
        employee.employeeCode,
        employee.fullName,
        employee.department,
        employee.country,
        employee.currency,
        employee.salary.toString(),
        this.dateOnly(employee.effectiveDate),
      ]
        .map((value) => this.toCsvCell(value))
        .join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private toCsvCell(value: unknown) {
    const text = String(value);
    const safeText = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text)
      ? `'${text}`
      : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }

  private buildWhere(query: EmployeeQuery): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = {};
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.country) where.country = query.country;
    if (query.department) where.department = query.department;
    if (query.currency) where.currency = query.currency as PrismaCurrency;
    if (query.minSalary !== undefined || query.maxSalary !== undefined) {
      where.salary = {
        ...(query.minSalary !== undefined ? { gte: query.minSalary } : {}),
        ...(query.maxSalary !== undefined ? { lte: query.maxSalary } : {}),
      };
    }
    return where;
  }

  private serializeEmployee(employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    department: string;
    country: string;
    currency: PrismaCurrency;
    salary: Prisma.Decimal;
    effectiveDate: Date;
  }) {
    return {
      id: employee.id,
      employeeId: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      country: employee.country,
      currency: employee.currency,
      salary: Number(employee.salary),
      effectiveDate: this.dateOnly(employee.effectiveDate),
    };
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toPositiveInteger(value: number | undefined, fallback: number) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
