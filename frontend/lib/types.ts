export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'INR'];

export type JobLevel = 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'PRINCIPAL';
export const LEVEL_LABELS: Record<JobLevel, string> = {
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
  LEAD: 'Lead',
  PRINCIPAL: 'Principal',
};

export type Employee = {
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
};

export type EmployeeOptions = {
  countries: string[];
  departments: string[];
  jobTitles: string[];
};

export type AuthUser = {
  id: number;
  email: string;
  role: 'HR_MANAGER';
  expiresAt: string;
};

export type EmployeePage = {
  data: Employee[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DashboardSummary = {
  totalEmployees: number;
  averageSalaryByCurrency: { currency: Currency; average: number }[];
  payrollByCurrency: { currency: Currency; total: number; employeeCount: number }[];
  payrollInUsd: number;
  usdRatesAreIllustrative: true;
  countries: { country: string; count: number }[];
  departments: { department: string; count: number }[];
  levels: JobLevel[];
};

export type AnalyticsDimension = 'country' | 'department' | 'level' | 'jobTitle';

export type PayGroup = {
  key: string;
  currency: Currency;
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  average: number;
  total: number;
};

export type Analytics = { dimension: AnalyticsDimension; groups: PayGroup[] };

export type SalaryOutlier = {
  id: number;
  employeeId: string;
  fullName: string;
  jobTitle: string;
  country: string;
  currency: Currency;
  salary: number;
  peerMedian: number;
  ratio: number;
  peerCount: number;
};

export type EmployeeHistory = {
  employee: Employee;
  history: { salary: number; currency: Currency; effectiveDate: string }[];
  changes: {
    previousSalary: number;
    newSalary: number;
    currency: Currency;
    effectiveDate: string;
    reason: string;
    changedBy: string;
    changedAt: string;
  }[];
};

export type SortField = 'fullName' | 'department' | 'country' | 'level' | 'salary' | 'effectiveDate' | 'hireDate';
export type SortState = { by: SortField; order: 'asc' | 'desc' };

export type DirectoryFilters = {
  search: string;
  country: string;
  department: string;
  level: string;
  currency: string;
  minSalary: string;
  maxSalary: string;
};
