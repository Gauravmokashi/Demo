'use client';

import { Download, LogOut, Users, Wallet } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { apiJson, apiRequest, UnauthorizedError } from '@/lib/api';
import { AuthUser, DashboardSummary, Employee } from '@/lib/types';
import { useApiData } from '@/lib/useApiData';
import { useDirectory } from '@/lib/useDirectory';
import { EmployeeDirectory } from './EmployeeDirectory';
import { EmployeeEditorDialog } from './EmployeeEditorDialog';
import { EmployeeHistoryPanel } from './EmployeeHistoryPanel';
import { InsightsPanel } from './InsightsPanel';
import { PayrollOverview } from './PayrollOverview';
import { SalaryEditDialog } from './SalaryEditDialog';
import { Tabs } from './ui/Tabs';
import { ErrorBanner, Notice } from './ui/States';

type Props = { user: AuthUser; onLogout: () => void; onUnauthorized: () => void };

export function Dashboard({ user, onLogout, onUnauthorized }: Props) {
  const [tab, setTab] = useState('directory');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [employeeEditorOpen, setEmployeeEditorOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Employee | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const summary = useApiData<DashboardSummary>('/dashboard/summary', {
    onUnauthorized,
    fallbackMessage: 'Dashboard summary could not be loaded.',
  });
  const directory = useDirectory(onUnauthorized);
  const error = actionError || summary.error || directory.error;

  function dismissError() {
    setActionError('');
    summary.clearError();
    directory.clearError();
  }

  async function exportCsv() {
    try {
      const response = await apiRequest(`/employees/export?${directory.exportQuery}`, { fallbackMessage: 'Export failed.' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      if (reason instanceof UnauthorizedError) onUnauthorized();
      else setActionError(reason instanceof Error ? reason.message : 'Export failed.');
    }
  }

  function salarySaved(updated: Employee) {
    setEditing(null);
    setNotice(`Salary updated for ${updated.fullName}.`);
    summary.reload();
    directory.reload();
  }

  function employeeSaved(saved: Employee) {
    setEmployeeEditorOpen(false);
    setEditingEmployee(null);
    setNotice(`Employee record saved for ${saved.fullName}.`);
    summary.reload();
    directory.reload();
  }

  async function deactivateEmployee(employee: Employee) {
    if (!window.confirm(`Deactivate ${employee.fullName}? Their salary history will be retained.`)) return;
    try {
      await apiJson(`/employees/${employee.id}`, { method: 'DELETE', fallbackMessage: 'Employee could not be deactivated.' });
      setNotice(`${employee.fullName} was deactivated.`);
      summary.reload();
      directory.reload();
    } catch (reason) {
      if (reason instanceof UnauthorizedError) onUnauthorized();
      else setActionError(reason instanceof Error ? reason.message : 'Employee could not be deactivated.');
    }
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
            <button className="secondary-button inline-flex items-center gap-2" onClick={onLogout}><LogOut size={15} aria-hidden="true" />Sign out</button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1e4935] px-4 text-sm font-semibold text-white transition hover:bg-[#286144] disabled:opacity-50" onClick={exportCsv} disabled={!directory.result} title="Export every employee matching the directory filters">
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
          </div>
        </header>

        {error && <ErrorBanner message={`${error} If this persists, check the API and database connection.`} onDismiss={dismissError} />}
        {notice && <Notice message={notice} onDismiss={() => setNotice('')} />}

        <section aria-label="Salary summary" className="mb-9 grid border-y border-[#d7ded7] md:grid-cols-3">
          <Metric label="Employees" value={summary.data ? summary.data.totalEmployees.toLocaleString() : '—'} detail="Current workforce" icon={<Users size={17} />} />
          <Metric label="Payroll currencies" value={summary.data ? String(summary.data.payrollByCurrency.length) : '—'} detail="Totals stay in local currency" icon={<Wallet size={17} />} />
          <Metric label="Markets" value={summary.data ? String(summary.data.countries.length) : '—'} detail="Countries represented" icon={<span className="text-base">◎</span>} />
        </section>

        <Tabs
          label="Dashboard views"
          value={tab}
          onChange={setTab}
          tabs={[
            {
              value: 'directory',
              label: 'Directory',
              content: (
                <div className="grid gap-9 xl:grid-cols-[0.75fr_1.75fr]">
                  <PayrollOverview summary={summary.data} selectedCountry={directory.filters.country} onSelectCountry={(country) => directory.setFilter('country', country)} />
                  <EmployeeDirectory
                    directory={directory}
                    summary={summary.data}
                    onEditProfile={(employee) => { setEditingEmployee(employee); setEmployeeEditorOpen(true); }}
                    onSalaryEdit={setEditing}
                    onHistory={setViewingHistory}
                    onDeactivate={deactivateEmployee}
                  />
                </div>
              ),
            },
            { value: 'insights', label: 'Pay insights', content: <InsightsPanel summary={summary.data} onUnauthorized={onUnauthorized} /> },
          ]}
        />
      </div>

      {editing && <SalaryEditDialog employee={editing} onClose={() => setEditing(null)} onSaved={salarySaved} onUnauthorized={onUnauthorized} />}
      {employeeEditorOpen && <EmployeeEditorDialog employee={editingEmployee} onClose={() => { setEmployeeEditorOpen(false); setEditingEmployee(null); }} onSaved={employeeSaved} onUnauthorized={onUnauthorized} />}
      {viewingHistory && (
        <EmployeeHistoryPanel employeeId={viewingHistory.id} name={viewingHistory.fullName} onClose={() => setViewingHistory(null)} onUnauthorized={onUnauthorized} />
      )}
    </main>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="flex items-start gap-3 border-b border-[#d7ded7] py-5 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"><span className="mt-1 text-[#477358]">{icon}</span><div><div className="text-xs font-medium uppercase tracking-wide text-[#68766d]">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-xs text-[#758078]">{detail}</div></div></div>;
}
