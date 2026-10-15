import { jest } from '@jest/globals';

export type TestUser = { id: number; email: string; role: 'HR_MANAGER'; expiresAt: string };

export const manager: TestUser = {
  id: 1,
  email: 'manager@example.test',
  role: 'HR_MANAGER',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};

export const employee = {
  id: 7,
  employeeId: 'ACM-00007',
  fullName: 'Maya Patel',
  department: 'Engineering',
  country: 'India',
  jobTitle: 'Senior Software Engineer',
  level: 'SENIOR' as const,
  hireDate: '2020-06-15',
  currency: 'INR' as const,
  salary: 1800000,
  effectiveDate: '2025-01-01',
  isActive: true,
};

export const summary = {
  totalEmployees: 1,
  averageSalaryByCurrency: [{ currency: 'INR', average: 1800000 }],
  payrollByCurrency: [{ currency: 'INR', total: 1800000, employeeCount: 1 }],
  payrollInUsd: 21600,
  usdRatesAreIllustrative: true as const,
  countries: [{ country: 'India', count: 1 }],
  departments: [{ department: 'Engineering', count: 1 }],
  levels: ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL'],
};

export const analytics = {
  dimension: 'department',
  groups: [
    { key: 'Engineering', currency: 'INR', count: 40, min: 900000, p25: 1500000, median: 1800000, p75: 2200000, max: 4000000, average: 1900000, total: 76000000 },
  ],
};

export const outliers = [];

export const history = {
  employee,
  history: [
    { salary: 1800000, currency: 'INR', effectiveDate: '2025-01-01' },
    { salary: 1600000, currency: 'INR', effectiveDate: '2024-01-01' },
  ],
  changes: [
    {
      previousSalary: 1600000,
      newSalary: 1800000,
      currency: 'INR',
      effectiveDate: '2025-01-01',
      reason: 'Promotion to Senior',
      changedBy: 'manager@example.test',
      changedAt: '2025-01-02T10:00:00.000Z',
    },
  ],
};

export const fetchMock = jest.fn<typeof fetch>();

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(['csv']),
  } as Response;
}

export type FetchOptions = {
  sessionUser?: TestUser;
  dashboardStatus?: number;
  employeeStatus?: number;
  salaryResponse?: { status: number; body: unknown };
};

export function installFetch(options: FetchOptions = {}) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return jsonResponse(options.sessionUser ? { user: options.sessionUser } : { message: 'Unauthorized' }, options.sessionUser ? 200 : 401);
    }
    if (path.endsWith('/auth/login')) return jsonResponse({ user: manager }, 201);
    if (path.endsWith('/auth/refresh')) return jsonResponse({ user: manager }, 200);
    if (path.endsWith('/auth/logout')) return jsonResponse({ message: 'Logged out.' }, 201);
    if (path.endsWith('/dashboard/summary')) return jsonResponse(summary, options.dashboardStatus ?? 200);
    if (path.endsWith('/employees/options')) return jsonResponse({
      countries: ['India', 'United States'],
      departments: ['Engineering', 'Product'],
      jobTitles: ['Senior Software Engineer', 'Software Engineer'],
    }, 200);
    if (path.endsWith('/employees/export')) return jsonResponse('csv', 200);
    if (path.endsWith('/employees/analytics')) return jsonResponse(analytics, 200);
    if (path.endsWith('/employees/outliers')) return jsonResponse(outliers, 200);
    if (path.endsWith('/employees/7/history')) return jsonResponse(history, 200);
    if (path.endsWith('/employees/7/salary') && method === 'PATCH') {
      const response = options.salaryResponse ?? { status: 200, body: employee };
      return jsonResponse(response.body, response.status);
    }
    if (path.endsWith('/employees/7') && method === 'PATCH') return jsonResponse({ ...employee, ...JSON.parse(String(init?.body ?? '{}')) }, 200);
    if (path.endsWith('/employees/7') && method === 'DELETE') return jsonResponse({ id: employee.id, isActive: false }, 200);
    if (path.endsWith('/employees') && method === 'POST') return jsonResponse({ ...employee, ...JSON.parse(String(init?.body ?? '{}')), id: 8 }, 201);
    if (path.endsWith('/employees')) {
      const page = Number(url.searchParams.get('page') ?? 1);
      return jsonResponse({ data: [employee], page, limit: 10, total: 21, totalPages: 3 }, options.employeeStatus ?? 200);
    }
    return jsonResponse({}, 404);
  });
  global.fetch = fetchMock;
}

export function findCall(predicate: (url: URL, init?: RequestInit) => boolean) {
  return fetchMock.mock.calls.find(([input, init]) => predicate(new URL(String(input), 'http://localhost'), init));
}
