import { describe, expect, it } from '@jest/globals';
import { departments, generateEmployees, markets, SEED_REFERENCE_DATE } from './seed-data';

describe('seed data generator', () => {
  const employees = generateEmployees(10000);

  it('is deterministic for the same seed', () => {
    expect(generateEmployees(50)).toEqual(employees.slice(0, 50));
    expect(generateEmployees(50, 1)).not.toEqual(employees.slice(0, 50));
  });

  it('produces unique, stable employee codes', () => {
    expect(new Set(employees.map((employee) => employee.employeeCode)).size).toBe(10000);
    expect(employees[0].employeeCode).toBe('ACM-00001');
    expect(employees[9999].employeeCode).toBe('ACM-10000');
  });

  it('produces a realistic variety of names', () => {
    expect(new Set(employees.map((employee) => employee.fullName)).size).toBeGreaterThan(1000);
  });

  it('covers every country and department combination', () => {
    const combinations = new Set(employees.map((employee) => `${employee.country}|${employee.department}`));
    expect(combinations.size).toBe(markets.length * departments.length);
  });

  it('pays more senior levels more within the same market', () => {
    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const usSalaries = (level: string) =>
      employees
        .filter((employee) => employee.country === 'United States' && employee.level === level)
        .map((employee) => Number(employee.salary));

    expect(median(usSalaries('JUNIOR'))).toBeLessThan(median(usSalaries('MID')));
    expect(median(usSalaries('MID'))).toBeLessThan(median(usSalaries('SENIOR')));
    expect(median(usSalaries('SENIOR'))).toBeLessThan(median(usSalaries('PRINCIPAL')));
  });

  it('keeps dates consistent: hired before the effective date, nothing in the future', () => {
    for (const employee of employees) {
      expect(employee.hireDate.getTime()).toBeLessThanOrEqual(employee.effectiveDate.getTime());
      expect(employee.effectiveDate.getTime()).toBeLessThanOrEqual(SEED_REFERENCE_DATE.getTime());
    }
  });
});
