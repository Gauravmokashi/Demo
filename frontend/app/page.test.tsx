import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';

type TestUser = {
  id: number;
  email: string;
  role: 'HR_MANAGER';
  expiresAt: string;
};

const manager: TestUser = {
  id: 1,
  email: 'manager@example.test',
  role: 'HR_MANAGER',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};
const employee = {
  id: 7,
  employeeId: 'ACM-00007',
  fullName: 'Maya Patel',
  department: 'Engineering',
  country: 'India',
  currency: 'INR',
  salary: 1800000,
  effectiveDate: '2025-01-01',
};
const summary = {
  totalEmployees: 1,
  averageSalaryByCurrency: [{ currency: 'INR', average: 1800000 }],
  payrollByCurrency: [{ currency: 'INR', total: 1800000, employeeCount: 1 }],
  countries: [{ country: 'India', count: 1 }],
  departments: [{ department: 'Engineering', count: 1 }],
};

const fetchMock = jest.fn<typeof fetch>();

type FetchOptions = {
  sessionStatus?: number;
  sessionUser?: TestUser;
  dashboardStatus?: number;
  employeeStatus?: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(['csv']),
  } as Response;
}

function installFetch(options: FetchOptions = {}) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';

    if (url.pathname.endsWith('/auth/me')) {
      return jsonResponse(
        options.sessionUser ? { user: options.sessionUser } : null,
        options.sessionStatus ?? (options.sessionUser ? 200 : 401),
      );
    }
    if (url.pathname.endsWith('/auth/login')) return jsonResponse({ user: manager }, 201);
    if (url.pathname.endsWith('/auth/logout')) return jsonResponse({ message: 'Logged out.' }, 201);
    if (url.pathname.endsWith('/dashboard/summary')) {
      return jsonResponse(summary, options.dashboardStatus ?? 200);
    }
    if (url.pathname.endsWith('/employees/export')) return jsonResponse('csv', 200);
    if (url.pathname.endsWith('/employees/7/salary') && method === 'PATCH') {
      return jsonResponse(employee, 200);
    }
    if (url.pathname.endsWith('/employees')) {
      const page = Number(url.searchParams.get('page') ?? 1);
      return jsonResponse({ data: [employee], page, limit: 10, total: 21, totalPages: 3 }, options.employeeStatus ?? 200);
    }
    return jsonResponse({}, 404);
  });
  global.fetch = fetchMock;
}

async function renderAuthenticated(user = userEvent.setup()) {
  installFetch({ sessionUser: manager });
  render(<HomePage />);
  await screen.findByText('Maya Patel');
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('HR salary dashboard authentication and workflows', () => {
  it('logs in before rendering protected employee data and supports logout', async () => {
    const user = userEvent.setup();
    installFetch();
    render(<HomePage />);

    await screen.findByRole('heading', { name: 'HR manager sign in' });
    expect(screen.queryByText('Maya Patel')).toBeNull();

    await user.type(screen.getByLabelText('Work email'), manager.email);
    await user.type(screen.getByLabelText('Password'), 'manager-password-123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Maya Patel');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/login$/),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/employees\?/),
      expect.objectContaining({ credentials: 'include' }),
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await screen.findByRole('heading', { name: 'HR manager sign in' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/logout$/),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(screen.queryByText('Maya Patel')).toBeNull();
  });

  it('rejects an already-expired restored session before requesting dashboard data', async () => {
    const expiredUser = { ...manager, expiresAt: new Date(Date.now() - 1000).toISOString() };
    installFetch({ sessionUser: expiredUser });
    render(<HomePage />);

    await screen.findByRole('heading', { name: 'HR manager sign in' });
    expect(screen.getByRole('alert').textContent).toMatch(/session has expired/i);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/dashboard/summary'))).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/employees?'))).toBe(false);
  });

  it('shows API errors rather than pretending data loaded', async () => {
    installFetch({ sessionUser: manager, dashboardStatus: 503, employeeStatus: 503 });
    render(<HomePage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i));
  });

  it('sends search and directory filters to the API', async () => {
    const user = await renderAuthenticated();

    fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'Patel' } });
    await user.selectOptions(screen.getByLabelText('Filter by country'), 'India');
    await user.selectOptions(screen.getByLabelText('Filter by department'), 'Engineering');
    await user.selectOptions(screen.getByLabelText('Filter by currency'), 'INR');

    await waitFor(() => {
      const matchingCall = fetchMock.mock.calls.find(([input]) => {
        const url = new URL(String(input), 'http://localhost');
        return url.pathname.endsWith('/employees') && url.searchParams.has('currency');
      });
      expect(matchingCall).toBeTruthy();
      const url = new URL(String(matchingCall?.[0]), 'http://localhost');
      expect(url.searchParams.get('search')).toBe('Patel');
      expect(url.searchParams.get('country')).toBe('India');
      expect(url.searchParams.get('department')).toBe('Engineering');
      expect(url.searchParams.get('currency')).toBe('INR');
    });
  });

  it('requests the next server page when pagination advances', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => {
        const url = new URL(String(input), 'http://localhost');
        return url.pathname.endsWith('/employees') && url.searchParams.get('page') === '2';
      })).toBe(true);
    });
  });

  it('submits salary updates with the current employee and effective date', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('button', { name: 'Edit salary for Maya Patel' }));
    await user.clear(screen.getByLabelText('Annual salary'));
    await user.type(screen.getByLabelText('Annual salary'), '1900000');
    await user.selectOptions(screen.getByLabelText('Currency'), 'INR');
    await user.clear(screen.getByLabelText('Effective date'));
    await user.type(screen.getByLabelText('Effective date'), '2025-03-01');
    await user.click(screen.getByRole('button', { name: 'Save change' }));

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(([input, init]) =>
        String(input).endsWith('/employees/7/salary') && init?.method === 'PATCH',
      );
      expect(updateCall).toBeTruthy();
      expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
        salary: 1900000,
        currency: 'INR',
        effectiveDate: '2025-03-01',
      });
      expect(updateCall?.[1]?.credentials).toBe('include');
    });
  });
});
