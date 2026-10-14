'use client';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Pencil,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';

type Employee = {
  id: number;
  employeeId: string;
  fullName: string;
  department: string;
  country: string;
  currency: Currency;
  salary: number;
  effectiveDate: string;
};

type AuthUser = {
  id: number;
  email: string;
  role: 'HR_MANAGER';
  expiresAt: string;
};

type EmployeePage = {
  data: Employee[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type DashboardSummary = {
  totalEmployees: number;
  averageSalaryByCurrency: { currency: Currency; average: number }[];
  payrollByCurrency: { currency: Currency; total: number; employeeCount: number }[];
  countries: { country: string; count: number }[];
  departments: { department: string; count: number }[];
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

function currency(value: number, code: Currency) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [result, setResult] = useState<EmployeePage | null>(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [department, setDepartment] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  function expireSession(message = 'Your session has expired. Please sign in again.') {
    setUser(null);
    setSummary(null);
    setResult(null);
    setEditing(null);
    setError('');
    setLoginError(message);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/auth/me`, { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Could not verify your sign-in.');
        return response.json() as Promise<{ user: AuthUser }>;
      })
      .then((result) => {
        const sessionUser = result?.user;
        if (sessionUser && Date.parse(sessionUser.expiresAt) <= Date.now()) {
          expireSession();
          return;
        }
        setUser(sessionUser ?? null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setLoginError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;
    const remaining = Date.parse(user.expiresAt) - Date.now();
    const delay = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
    const timer = window.setTimeout(() => expireSession(), delay);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch(`${apiBase}/dashboard/summary`, { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (response.status === 401) {
          expireSession();
          return null;
        }
        if (!response.ok) throw new Error('Dashboard summary could not be loaded.');
        return response.json() as Promise<DashboardSummary>;
      })
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, [notice, user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search.trim()) params.set('search', search.trim());
      if (country) params.set('country', country);
      if (department) params.set('department', department);
      if (currencyFilter) params.set('currency', currencyFilter);

      fetch(`${apiBase}/employees?${params}`, { credentials: 'include', signal: controller.signal })
        .then((response) => {
          if (response.status === 401) {
            expireSession();
            throw new Error('Session expired.');
          }
          if (!response.ok) throw new Error('Employee records could not be loaded.');
          return response.json() as Promise<EmployeePage>;
        })
        .then((data) => {
          setResult(data);
          setError('');
        })
        .catch((reason: unknown) => {
          if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, country, department, currencyFilter, notice, user]);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? 'Sign-in failed.');
      const sessionUser = body?.user as AuthUser | undefined;
      if (!sessionUser || !Number.isFinite(Date.parse(sessionUser.expiresAt)) || Date.parse(sessionUser.expiresAt) <= Date.now()) {
        throw new Error('Sign-in response did not contain a valid session.');
      }
      setUser(sessionUser);
      setLoginError('');
      formElement.reset();
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
      setSummary(null);
      setResult(null);
      setEditing(null);
      setError('');
    }
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (country) params.set('country', country);
    if (department) params.set('department', department);
    if (currencyFilter) params.set('currency', currencyFilter);
    try {
      const response = await fetch(`${apiBase}/employees/export?${params}`, { credentials: 'include' });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'employees.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.');
    }
  }

  async function saveSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/employees/${editing.id}/salary`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary: Number(form.get('salary')),
          currency: form.get('currency'),
          effectiveDate: form.get('effectiveDate'),
        }),
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? 'Salary update failed.');
      }
      setEditing(null);
      setNotice(new Date().toISOString());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Salary update failed.');
    } finally {
      setSaving(false);
    }
  }

  const payroll = summary?.payrollByCurrency ?? [];
  const maxCurrencyHeadcount = Math.max(...payroll.map((item) => item.employeeCount), 1);
  const from = result && result.total > 0 ? (result.page - 1) * result.limit + 1 : 0;
  const to = result ? Math.min(result.page * result.limit, result.total) : 0;

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-[#f3f5f1] text-sm text-[#65726a]">Checking your session…</main>;
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f1] px-5 py-10 text-[#182520]">
        <section className="w-full max-w-md border-y border-[#cfd8cf] bg-white px-7 py-9 sm:px-9">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#52745e]"><span className="h-2 w-2 rounded-full bg-[#548c67]" /> ACME People Operations</div>
          <h1 className="text-3xl font-semibold">HR manager sign in</h1>
          <p className="mt-2 text-sm text-[#65726a]">Sign in to access salary and employee records.</p>
          {loginError && <div className="mt-5 border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{loginError}</div>}
          <form className="mt-6 space-y-4" onSubmit={submitLogin}>
            <label className="block text-sm font-medium">Work email
              <input className="filter-control mt-1 w-full px-3" name="email" type="email" autoComplete="username" maxLength={320} required />
            </label>
            <label className="block text-sm font-medium">Password
              <input className="filter-control mt-1 w-full px-3" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={72} required />
            </label>
            <button className="primary-button w-full" type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f1] text-[#182520]">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-[#d7ded7] pb-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#52745e]">
              <span className="h-2 w-2 rounded-full bg-[#548c67]" /> Global People Operations
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Salary overview</h1>
            <p className="mt-2 text-sm text-[#65726a]">Compensation and employee records across your organization</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[#65726a]">{user.email}</span>
            <button className="secondary-button inline-flex items-center gap-2" onClick={logout}><LogOut size={15} aria-hidden="true" />Sign out</button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1e4935] px-4 text-sm font-semibold text-white transition hover:bg-[#286144] disabled:opacity-50" onClick={exportCsv} disabled={!result}>
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center justify-between border-l-4 border-[#b45140] bg-[#f7e7e3] px-4 py-3 text-sm text-[#763b31]" role="alert">
            <span>{error} Check the backend connection and database configuration.</span>
            <button aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button>
          </div>
        )}

        <section aria-label="Salary summary" className="mb-9 grid border-y border-[#d7ded7] md:grid-cols-3">
          <Metric label="Employees" value={summary ? summary.totalEmployees.toLocaleString() : '—'} detail="Current workforce" icon={<Users size={17} />} />
          <Metric label="Payroll by currency" value={`${payroll.length} currencies`} detail="Totals stay in local currency" icon={<Wallet size={17} />} />
          <Metric label="Markets" value={summary ? String(summary.countries.length) : '—'} detail="Countries represented" icon={<span className="text-base">◎</span>} />
        </section>

        <div className="grid gap-9 xl:grid-cols-[0.85fr_1.65fr]">
          <section aria-labelledby="payroll-title" className="min-w-0">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <div>
                <p className="section-kicker">Compensation</p>
                <h2 id="payroll-title" className="mt-1 text-xl font-semibold">Payroll by currency</h2>
              </div>
              {summary && <span className="text-xs text-[#65726a]">{summary.totalEmployees.toLocaleString()} employees</span>}
            </div>
            {payroll.length ? (
              <div className="divide-y divide-[#d7ded7] border-y border-[#d7ded7]">
                {payroll.map((item, index) => (
                  <div key={item.currency} className="py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold"><span className={`currency-mark currency-${item.currency.toLowerCase()}`} />{item.currency}</span>
                      <span className="text-sm font-semibold tabular-nums">{currency(item.total, item.currency)}</span>
                    </div>
                    <div className="h-1.5 bg-[#e0e6df]">
                      <div className={`h-full currency-bar currency-bar-${index % 4}`} style={{ width: `${Math.max(4, (item.employeeCount / maxCurrencyHeadcount) * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-[#65726a]">
                      <span>{item.employeeCount.toLocaleString()} employees</span>
                      Average: {currency(summary?.averageSalaryByCurrency.find((average) => average.currency === item.currency)?.average ?? 0, item.currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState loading={!summary} message="Payroll totals will appear when the API is available." />}

            <div className="mt-8">
              <p className="section-kicker">Workforce distribution</p>
              <h2 className="mb-4 mt-1 text-xl font-semibold">By country</h2>
              <div className="divide-y divide-[#d7ded7] border-y border-[#d7ded7]">
                {(summary?.countries ?? []).slice(0, 7).map((item) => (
                  <button key={item.country} className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-[#286144]" onClick={() => resetPage(() => setCountry(country === item.country ? '' : item.country))}>
                    <span>{item.country}</span><span className="text-xs tabular-nums text-[#65726a]">{item.count.toLocaleString()}</span>
                  </button>
                ))}
                {!summary?.countries.length && <EmptyState loading={!summary} message="Country distribution unavailable." />}
              </div>
            </div>
          </section>

          <section aria-labelledby="directory-title" className="min-w-0">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-kicker">People directory</p>
                <h2 id="directory-title" className="mt-1 text-xl font-semibold">Employee records</h2>
              </div>
              <span className="text-xs text-[#65726a]">Salary values shown in employee currency</span>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative sm:col-span-2 lg:col-span-1">
                <span className="sr-only">Search employees</span>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68766d]" size={16} />
                <input className="filter-control w-full pl-9" placeholder="Search people" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} />
              </label>
              <label>
                <span className="sr-only">Filter by country</span>
                <select className="filter-control w-full" value={country} onChange={(event) => resetPage(() => setCountry(event.target.value))}>
                  <option value="">All countries</option>
                  {(summary?.countries ?? []).map((item) => <option key={item.country} value={item.country}>{item.country}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by department</span>
                <select className="filter-control w-full" value={department} onChange={(event) => resetPage(() => setDepartment(event.target.value))}>
                  <option value="">All departments</option>
                  {(summary?.departments ?? []).map((item) => <option key={item.department} value={item.department}>{item.department}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by currency</span>
                <select className="filter-control w-full" value={currencyFilter} onChange={(event) => resetPage(() => setCurrencyFilter(event.target.value))}>
                  <option value="">All currencies</option>
                  {(['USD', 'EUR', 'GBP', 'INR'] as Currency[]).map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto border-y border-[#cfd8cf]">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#e8ede7] text-[11px] font-semibold uppercase text-[#5b6c60]">
                    <th className="px-3 py-3">Employee</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Location</th><th className="px-3 py-3 text-right">Annual salary</th><th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.data ?? []).map((employee) => (
                    <tr key={employee.id} className="border-t border-[#e0e5df] bg-white/70 hover:bg-white">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[#20352a]">{employee.fullName}</div>
                        <div className="mt-0.5 text-xs text-[#758078]">{employee.employeeId}</div>
                      </td>
                      <td className="px-3 py-3 text-[#43534a]">{employee.department}</td>
                      <td className="px-3 py-3"><div className="text-[#43534a]">{employee.country}</div><div className="mt-0.5 text-xs text-[#758078]">Effective {employee.effectiveDate}</div></td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#20352a]">{currency(employee.salary, employee.currency)}<span className="ml-1 text-xs font-normal text-[#758078]">{employee.currency}</span></td>
                      <td className="px-3 py-3 text-right">
                        <button className="icon-button" title={`Edit salary for ${employee.fullName}`} aria-label={`Edit salary for ${employee.fullName}`} onClick={() => setEditing(employee)}><Pencil size={15} /></button>
                      </td>
                    </tr>
                  ))}
                  {!loading && !result?.data.length && <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-[#65726a]">No employees match these filters.</td></tr>}
                  {loading && <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-[#65726a]">Loading employee records…</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <span className="text-xs text-[#65726a]">{result ? `Showing ${from}–${to} of ${result.total.toLocaleString()}` : 'Waiting for employee records'}</span>
              <div className="flex items-center gap-2">
                <button className="icon-button" aria-label="Previous page" disabled={!result || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button>
                <span className="min-w-20 text-center text-xs tabular-nums text-[#526157]">Page {result?.page ?? 1} of {result?.totalPages ?? 1}</span>
                <button className="icon-button" aria-label="Next page" disabled={!result || page >= (result?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}><ChevronRight size={17} /></button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#11251b]/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section aria-labelledby="edit-title" aria-modal="true" className="w-full max-w-md bg-[#fbfcfa] p-6 shadow-2xl" role="dialog">
            <div className="mb-6 flex items-start justify-between">
              <div><p className="section-kicker">Compensation change</p><h2 id="edit-title" className="mt-1 text-xl font-semibold">Edit salary</h2><p className="mt-1 text-sm text-[#65726a]">{editing.fullName} · {editing.employeeId}</p></div>
              <button className="icon-button" aria-label="Close salary editor" onClick={() => setEditing(null)}><X size={17} /></button>
            </div>
            <form className="space-y-4" onSubmit={saveSalary}>
              <label className="block text-sm font-medium">Annual salary
                <input className="filter-control mt-1 w-full" name="salary" type="number" min="0.01" step="0.01" defaultValue={editing.salary} required />
              </label>
              <label className="block text-sm font-medium">Currency
                <select className="filter-control mt-1 w-full" name="currency" defaultValue={editing.currency}>
                  {(['USD', 'EUR', 'GBP', 'INR'] as Currency[]).map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Effective date
                <input className="filter-control mt-1 w-full" name="effectiveDate" type="date" defaultValue={editing.effectiveDate} required />
              </label>
              <div className="flex justify-end gap-2 border-t border-[#d7ded7] pt-4">
                <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save change'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="flex items-start gap-3 border-b border-[#d7ded7] py-5 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"><span className="mt-1 text-[#477358]">{icon}</span><div><div className="text-xs font-medium uppercase tracking-wide text-[#68766d]">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-xs text-[#758078]">{detail}</div></div></div>;
}

function EmptyState({ loading, message }: { loading: boolean; message: string }) {
  return <div className="border-y border-[#d7ded7] py-8 text-sm text-[#758078]">{loading ? 'Loading…' : message}</div>;
}
