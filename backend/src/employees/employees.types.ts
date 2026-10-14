export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';

export interface Employee {
  id: number;
  employeeId: string;
  fullName: string;
  department: string;
  country: string;
  currency: Currency;
  salary: number;
  effectiveDate: string;
}

export interface EmployeeQuery {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  department?: string;
  currency?: string;
  minSalary?: number;
  maxSalary?: number;
}
