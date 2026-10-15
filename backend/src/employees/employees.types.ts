import { JobLevel } from '@prisma/client';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';

export const EMPLOYEE_SORT_FIELDS = [
  'fullName',
  'department',
  'country',
  'level',
  'salary',
  'effectiveDate',
  'hireDate',
] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export interface Employee {
  id: number;
  employeeId: string;
  fullName: string;
  department: string;
  country: string;
  jobTitle: string;
  level: JobLevel;
  hireDate: string;
  currency: Currency;
  salary: number;
  effectiveDate: string;
  isActive: boolean;
}

export interface EmployeeFilter {
  search?: string;
  country?: string;
  department?: string;
  level?: JobLevel;
  currency?: string;
  minSalary?: number;
  maxSalary?: number;
}

export interface EmployeeQuery extends EmployeeFilter {
  page?: number;
  limit?: number;
  sortBy?: EmployeeSortField;
  sortOrder?: 'asc' | 'desc';
}
