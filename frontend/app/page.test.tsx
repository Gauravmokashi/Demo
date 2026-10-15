import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';
import { fetchMock, findCall, installFetch, manager } from '../test/fixtures';

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
  jest.restoreAllMocks();
});

describe('HR salary dashboard', () => {
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
      expect.stringMatching(/\/api\/auth\/login$/),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await screen.findByRole('heading', { name: 'HR manager sign in' });
    expect(findCall((url, init) => url.pathname.endsWith('/auth/logout') && init?.method === 'POST')).toBeTruthy();
    expect(screen.queryByText('Maya Patel')).toBeNull();
  });

  it('rejects an already-expired restored session before requesting dashboard data', async () => {
    installFetch({ sessionUser: { ...manager, expiresAt: new Date(Date.now() - 1000).toISOString() } });
    render(<HomePage />);

    await screen.findByRole('heading', { name: 'HR manager sign in' });
    expect(screen.getByRole('alert').textContent).toMatch(/session has expired/i);
    expect(findCall((url) => url.pathname.endsWith('/dashboard/summary'))).toBeUndefined();
    expect(findCall((url) => url.pathname.endsWith('/employees'))).toBeUndefined();
  });

  it('shows API errors rather than pretending data loaded', async () => {
    installFetch({ sessionUser: manager, dashboardStatus: 503, employeeStatus: 503 });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i));
  });

  it('shows job title and level in the directory', async () => {
    await renderAuthenticated();

    expect(screen.getByText('Senior Software Engineer')).toBeTruthy();
  });

  it('creates a roster record and sends its initial compensation', async () => {
    const user = await renderAuthenticated();
    await user.click(screen.getByRole('button', { name: 'Add employee' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Employee ID'), 'ACM-10001');
    await user.type(within(dialog).getByLabelText('Full name'), 'Aarav Patel');
    await screen.findByRole('option', { name: 'Engineering' });
    await user.selectOptions(within(dialog).getByLabelText('Department'), 'Engineering');
    await user.selectOptions(within(dialog).getByLabelText('Country'), 'India');
    await user.selectOptions(within(dialog).getByLabelText('Job title'), 'Software Engineer');
    fireEvent.change(within(dialog).getByLabelText('Hire date'), { target: { value: '2025-01-10' } });
    await user.type(within(dialog).getByLabelText('Annual salary'), '1800000');
    fireEvent.change(within(dialog).getByLabelText('Salary effective date'), { target: { value: '2025-01-10' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add employee' }));

    await screen.findByText('Employee record saved for Aarav Patel.');
    const call = findCall((url, init) => url.pathname.endsWith('/employees') && init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      employeeCode: 'ACM-10001',
      fullName: 'Aarav Patel',
      salary: '1800000',
      currency: 'USD',
    });
  });

  it('edits employee profile fields through the roster editor', async () => {
    const user = await renderAuthenticated();
    await user.click(screen.getByRole('button', { name: 'Edit employee Maya Patel' }));
    const dialog = await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Product' });
    await user.selectOptions(within(dialog).getByLabelText('Department'), 'Product');
    await user.click(within(dialog).getByRole('button', { name: 'Save employee' }));

    await screen.findByText('Employee record saved for Maya Patel.');
    const call = findCall((url, init) => url.pathname.endsWith('/employees/7') && init?.method === 'PATCH');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ department: 'Product' });
    expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty('salary');
  });

  it('deactivates a roster record while retaining the salary history action', async () => {
    const user = await renderAuthenticated();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    await user.click(screen.getByRole('button', { name: 'Deactivate Maya Patel' }));
    window.confirm = originalConfirm;

    await screen.findByText('Maya Patel was deactivated.');
    expect(findCall((url, init) => url.pathname.endsWith('/employees/7') && init?.method === 'DELETE')).toBeTruthy();
  });

  it('sends search, directory filters and salary range to the API', async () => {
    const user = await renderAuthenticated();

    fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'Patel' } });
    await user.selectOptions(screen.getByLabelText('Filter by country'), 'India');
    await user.selectOptions(screen.getByLabelText('Filter by department'), 'Engineering');
    await user.selectOptions(screen.getByLabelText('Filter by level'), 'SENIOR');
    expect((screen.getByLabelText('Minimum salary') as HTMLInputElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText('Filter by currency'), 'INR');
    await user.type(screen.getByLabelText('Minimum salary'), '1000000');

    await waitFor(() => {
      const call = findCall((url) => url.pathname.endsWith('/employees') && url.searchParams.has('minSalary'));
      expect(call).toBeTruthy();
      const url = new URL(String(call?.[0]), 'http://localhost');
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        search: 'Patel',
        country: 'India',
        department: 'Engineering',
        level: 'SENIOR',
        currency: 'INR',
        minSalary: '1000000',
        page: '1',
      });
    });
  });

  it('sorts by salary only once a currency is chosen', async () => {
    const user = await renderAuthenticated();
    const salaryHeader = screen.getByRole('button', { name: /annual salary/i });
    expect((salaryHeader as HTMLButtonElement).disabled).toBe(true);

    await user.selectOptions(screen.getByLabelText('Filter by currency'), 'INR');
    await user.click(salaryHeader);
    await user.click(salaryHeader);

    await waitFor(() => {
      expect(findCall((url) => url.searchParams.get('sortBy') === 'salary' && url.searchParams.get('sortOrder') === 'desc')).toBeTruthy();
    });
  });

  it('requests the next server page when pagination advances', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(findCall((url) => url.pathname.endsWith('/employees') && url.searchParams.get('page') === '2')).toBeTruthy();
    });
  });

  it('exports with the active directory filters', async () => {
    const user = await renderAuthenticated();
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await user.selectOptions(screen.getByLabelText('Filter by country'), 'India');
    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => {
      expect(findCall((url) => url.pathname.endsWith('/employees/export') && url.searchParams.get('country') === 'India')).toBeTruthy();
    });
  });

  it('records a salary change with a reason and refreshes the data', async () => {
    const user = await renderAuthenticated();
    const directoryCallsBefore = fetchMock.mock.calls.filter(([input]) => String(input).includes('/employees?')).length;

    await user.click(screen.getByRole('button', { name: 'Edit salary for Maya Patel' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Annual salary'));
    await user.type(within(dialog).getByLabelText('Annual salary'), '1900000');
    expect(within(dialog).getByText('+5.6%')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Effective date'), { target: { value: '2025-03-01' } });
    await user.type(within(dialog).getByLabelText('Reason for change'), 'Annual review');
    await user.click(within(dialog).getByRole('button', { name: 'Save change' }));

    await screen.findByText('Salary updated for Maya Patel.');
    const update = findCall((url, init) => url.pathname.endsWith('/employees/7/salary') && init?.method === 'PATCH');
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      salary: 1900000,
      effectiveDate: '2025-03-01',
      reason: 'Annual review',
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/employees?')).length).toBeGreaterThan(directoryCallsBefore);
    });
  });

  it('requires explicit confirmation for a large salary change', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('button', { name: 'Edit salary for Maya Patel' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Annual salary'));
    await user.type(within(dialog).getByLabelText('Annual salary'), '2700000');
    expect(within(dialog).getByText(/above the 20% review threshold/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText('Reason for change'), 'Promotion to Lead');
    await user.click(within(dialog).getByLabelText('I confirm this large change'));
    await user.click(within(dialog).getByRole('button', { name: 'Save change' }));

    await waitFor(() => {
      const update = findCall((url, init) => url.pathname.endsWith('/employees/7/salary') && init?.method === 'PATCH');
      expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ salary: 2700000, confirmLargeChange: true });
    });
  });

  it('shows the API validation message inside the salary dialog', async () => {
    const user = userEvent.setup();
    installFetch({
      sessionUser: manager,
      salaryResponse: { status: 400, body: { message: ['Effective date cannot be in the future.'] } },
    });
    render(<HomePage />);
    await screen.findByText('Maya Patel');

    await user.click(screen.getByRole('button', { name: 'Edit salary for Maya Patel' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason for change'), 'Annual review');
    await user.click(within(dialog).getByRole('button', { name: 'Save change' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Effective date cannot be in the future.');
  });

  it('shows salary history with who changed it and why', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('button', { name: 'Salary history for Maya Patel' }));
    const panel = await screen.findByRole('dialog');

    expect(await within(panel).findByText('Promotion to Senior')).toBeTruthy();
    expect(within(panel).getByText(/by manager@example.test/)).toBeTruthy();
    expect(within(panel).getByText('+12.5%')).toBeTruthy();
  });

  it('shows pay distribution on the insights tab', async () => {
    const user = await renderAuthenticated();

    await user.click(screen.getByRole('tab', { name: 'Pay insights' }));

    expect(await screen.findByText(/Paid in INR/)).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Engineering' })).toBeTruthy();
    await waitFor(() => {
      const call = findCall((url) => url.pathname.endsWith('/employees/analytics'));
      expect(new URL(String(call?.[0]), 'http://localhost').searchParams.get('dimension')).toBe('department');
    });

    await user.selectOptions(screen.getByLabelText('Group by'), 'level');
    await waitFor(() => {
      expect(findCall((url) => url.pathname.endsWith('/employees/analytics') && url.searchParams.get('dimension') === 'level')).toBeTruthy();
    });

    await user.selectOptions(screen.getByLabelText('Group by'), 'jobTitle');
    await waitFor(() => {
      expect(findCall((url) => url.pathname.endsWith('/employees/analytics') && url.searchParams.get('dimension') === 'jobTitle')).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Unusual pay compared with peers' })).toBeTruthy();
    expect(findCall((url) => url.pathname.endsWith('/employees/outliers'))).toBeTruthy();
  });

  it('shows combined USD payroll only when the illustrative conversion is enabled', async () => {
    const user = await renderAuthenticated();

    expect(screen.queryByText('Illustrative USD conversion')).toBeNull();
    await user.click(screen.getByLabelText('Show combined payroll in USD'));
    expect(screen.getByText('Illustrative USD conversion')).toBeTruthy();
    expect(screen.getByText('$21,600')).toBeTruthy();
  });
});
