'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, History, Pencil, Search, UserRoundX, Wallet, UserPlus } from 'lucide-react';
import { ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
import { CURRENCIES, DashboardSummary, Employee, LEVEL_LABELS, SortField } from '@/lib/types';
import { useDirectory } from '@/lib/useDirectory';

type Props = {
  directory: ReturnType<typeof useDirectory>;
  summary: DashboardSummary | null;
  onEditProfile: (employee: Employee | null) => void;
  onSalaryEdit: (employee: Employee) => void;
  onHistory: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
};

export function EmployeeDirectory({ directory, summary, onEditProfile, onSalaryEdit, onHistory, onDeactivate }: Props) {
  const { filters, setFilter, sort, toggleSort, page, setPage, hasCurrency, result, loading } = directory;
  const from = result && result.total > 0 ? (result.page - 1) * result.limit + 1 : 0;
  const to = result ? Math.min(result.page * result.limit, result.total) : 0;

  const header = (field: SortField, label: string, options: { align?: 'right'; disabledReason?: string } = {}) => {
    const active = sort.by === field;
    return (
      <th className={`px-3 py-3 ${options.align === 'right' ? 'text-right' : ''}`} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          className="inline-flex items-center gap-1 uppercase disabled:cursor-help disabled:opacity-60"
          onClick={() => toggleSort(field)}
          disabled={Boolean(options.disabledReason)}
          title={options.disabledReason ?? `Sort by ${label.toLowerCase()}`}
        >
          {label}
          {active && (sort.order === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  return (
    <section aria-labelledby="directory-title" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">People directory</p>
          <h2 id="directory-title" className="mt-1 text-xl font-semibold">Employee records</h2>
        </div>
        <div className="flex items-center gap-3"><span className="text-xs text-[#65726a]">Salaries shown in each employee&apos;s currency</span><button className="primary-button inline-flex items-center gap-2" onClick={() => onEditProfile(null)}><UserPlus size={15} />Add employee</button></div>
      </div>

      <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search employees</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68766d]" size={16} />
          <input className="filter-control w-full pl-9" placeholder="Name, ID or title" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} />
        </label>
        <FilterSelect label="Filter by country" allLabel="All countries" value={filters.country} onChange={(value) => setFilter('country', value)}>
          {(summary?.countries ?? []).map((item) => <option key={item.country} value={item.country}>{item.country}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by department" allLabel="All departments" value={filters.department} onChange={(value) => setFilter('department', value)}>
          {(summary?.departments ?? []).map((item) => <option key={item.department} value={item.department}>{item.department}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by level" allLabel="All levels" value={filters.level} onChange={(value) => setFilter('level', value)}>
          {(summary?.levels ?? []).map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by currency" allLabel="All currencies" value={filters.currency} onChange={(value) => setFilter('currency', value)}>
          {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
        </FilterSelect>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[#65726a]">
        <span>Salary range</span>
        <input className="filter-control w-32 px-2" type="number" min="0" placeholder="Min" aria-label="Minimum salary" disabled={!hasCurrency} value={filters.minSalary} onChange={(event) => setFilter('minSalary', event.target.value)} />
        <span>–</span>
        <input className="filter-control w-32 px-2" type="number" min="0" placeholder="Max" aria-label="Maximum salary" disabled={!hasCurrency} value={filters.maxSalary} onChange={(event) => setFilter('maxSalary', event.target.value)} />
        {!hasCurrency && <span>Choose a currency to filter or sort by salary.</span>}
      </div>

      <div className="overflow-x-auto border-y border-[#cfd8cf]">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#e8ede7] text-[11px] font-semibold uppercase text-[#5b6c60]">
              {header('fullName', 'Employee')}
              {header('level', 'Role')}
              {header('department', 'Department')}
              {header('country', 'Location')}
              {header('salary', 'Annual salary', { align: 'right', disabledReason: hasCurrency ? undefined : 'Choose a currency to sort by salary' })}
              <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(result?.data ?? []).map((employee) => (
              <tr key={employee.id} className="border-t border-[#e0e5df] bg-white/70 hover:bg-white">
                <td className="px-3 py-3">
                  <div className="font-semibold text-[#20352a]">{employee.fullName}</div>
                  <div className="mt-0.5 text-xs text-[#758078]">{employee.employeeId}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-[#43534a]">{employee.jobTitle}</div>
                  <div className="mt-0.5 text-xs text-[#758078]">{LEVEL_LABELS[employee.level]}</div>
                </td>
                <td className="px-3 py-3 text-[#43534a]">{employee.department}</td>
                <td className="px-3 py-3 text-[#43534a]">{employee.country}</td>
                <td className="px-3 py-3 text-right">
                  <div className="font-semibold tabular-nums text-[#20352a]">{formatMoney(employee.salary, employee.currency)}<span className="ml-1 text-xs font-normal text-[#758078]">{employee.currency}</span></div>
                  <div className="mt-0.5 text-xs text-[#758078]">Effective {employee.effectiveDate}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button className="icon-button" title={`Salary history for ${employee.fullName}`} aria-label={`Salary history for ${employee.fullName}`} onClick={() => onHistory(employee)}><History size={15} /></button>
                    <button className="icon-button" title={`Edit employee ${employee.fullName}`} aria-label={`Edit employee ${employee.fullName}`} onClick={() => onEditProfile(employee)}><Pencil size={15} /></button>
                    <button className="icon-button" title={`Edit salary for ${employee.fullName}`} aria-label={`Edit salary for ${employee.fullName}`} onClick={() => onSalaryEdit(employee)}><Wallet size={15} /></button>
                    <button className="icon-button" title={`Deactivate ${employee.fullName}`} aria-label={`Deactivate ${employee.fullName}`} onClick={() => onDeactivate(employee)}><UserRoundX size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !result?.data.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-[#65726a]">No employees match these filters.</td></tr>}
            {loading && !result && <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-[#65726a]">Loading employee records…</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
        <span className="text-xs text-[#65726a]" aria-live="polite">{result ? `Showing ${from}–${to} of ${result.total.toLocaleString()}` : 'Waiting for employee records'}</span>
        <div className="flex items-center gap-2">
          <button className="icon-button" aria-label="Previous page" disabled={!result || page <= 1} onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={17} /></button>
          <span className="min-w-20 text-center text-xs tabular-nums text-[#526157]">Page {result?.page ?? 1} of {result?.totalPages ?? 1}</span>
          <button className="icon-button" aria-label="Next page" disabled={!result || page >= (result?.totalPages ?? 1)} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({ label, allLabel, value, onChange, children }: { label: string; allLabel: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="filter-control w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {children}
      </select>
    </label>
  );
}
