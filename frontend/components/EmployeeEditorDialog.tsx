'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiJson, UnauthorizedError } from '@/lib/api';
import { CURRENCIES, Employee, EmployeeOptions, LEVEL_LABELS, JobLevel } from '@/lib/types';
import { Dialog } from './ui/Dialog';

type Props = {
  employee: Employee | null;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  onUnauthorized: () => void;
};

const inputClass = 'filter-control mt-1 w-full px-3';

export function EmployeeEditorDialog({ employee, onClose, onSaved, onUnauthorized }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<EmployeeOptions>({ countries: [], departments: [], jobTitles: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let active = true;
    apiJson<EmployeeOptions>('/employees/options', { fallbackMessage: 'Employee choices could not be loaded.' })
      .then((data) => { if (active) setOptions(data); })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof UnauthorizedError) onUnauthorized();
        else setError(reason instanceof Error ? reason.message : 'Employee choices could not be loaded.');
      })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [onUnauthorized]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = Object.fromEntries(Object.entries(values).filter(([, value]) => String(value).trim() !== ''));
    setSaving(true);
    setError('');
    try {
      const saved = await apiJson<Employee>(employee ? `/employees/${employee.id}` : '/employees', {
        method: employee ? 'PATCH' : 'POST',
        fallbackMessage: 'Employee record could not be saved.',
        body: JSON.stringify(body),
      });
      onSaved(saved);
    } catch (reason) {
      if (reason instanceof UnauthorizedError) onUnauthorized();
      else setError(reason instanceof Error ? reason.message : 'Employee record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} kicker="Employee record" title={employee ? 'Edit employee' : 'Add employee'} description={employee ? `${employee.employeeId} · salary changes stay in the audited salary workflow` : 'New employees start with an opening salary-history entry.'}>
      <form className="space-y-3" onSubmit={submit}>
        {error && <div className="border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{error}</div>}
        {!employee && <Field name="employeeCode" label="Employee ID" defaultValue="" placeholder="ACM-10001" pattern="ACM-[0-9]{5}" maxLength={24} required />}
        <Field name="fullName" label="Full name" defaultValue={employee?.fullName ?? ''} maxLength={160} required />
        <div className="grid grid-cols-2 gap-3">
          <SelectField name="department" label="Department" value={employee?.department ?? ''} options={withCurrent(options.departments, employee?.department)} disabled={loadingOptions} />
          <SelectField name="country" label="Country" value={employee?.country ?? ''} options={withCurrent(options.countries, employee?.country)} disabled={loadingOptions} />
        </div>
        <SelectField name="jobTitle" label="Job title" value={employee?.jobTitle ?? ''} options={withCurrent(options.jobTitles, employee?.jobTitle)} disabled={loadingOptions} />
        <label className="block text-sm font-medium">Job level
          <select className={inputClass} name="level" defaultValue={employee?.level ?? 'MID'}>
            {(Object.keys(LEVEL_LABELS) as JobLevel[]).map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
          </select>
        </label>
        <Field name="hireDate" label="Hire date" type="date" defaultValue={employee?.hireDate ?? ''} required />
        {!employee && <>
          <label className="block text-sm font-medium">Currency
            <select className={inputClass} name="currency" defaultValue="USD">
              {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <Field name="salary" label="Annual salary" type="number" min="0.01" max="100000000" step="0.01" required />
          <Field name="effectiveDate" label="Salary effective date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </>}
        {employee && <p className="rounded bg-[#eef2ed] px-3 py-2 text-xs text-[#65726a]">Salary and currency are managed separately so every pay change keeps its reason and audit record.</p>}
        <div className="flex justify-end gap-2 border-t border-[#d7ded7] pt-4">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : employee ? 'Save employee' : 'Add employee'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ name, label, defaultValue, type = 'text', ...props }: { name: string; label: string; defaultValue?: string; type?: string; placeholder?: string; pattern?: string; maxLength?: number; min?: string; max?: string; step?: string; required?: boolean }) {
  return <label className="block text-sm font-medium">{label}<input className={inputClass} name={name} type={type} defaultValue={defaultValue} {...props} /></label>;
}

function SelectField({ name, label, value, options, disabled }: { name: string; label: string; value: string; options: string[]; disabled: boolean }) {
  return <label className="block text-sm font-medium">{label}
    <select className={inputClass} name={name} defaultValue={value} required disabled={disabled}>
      <option value="" disabled>{disabled ? 'Loading choices…' : 'Select an option'}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function withCurrent(options: string[], current?: string) {
  return current && !options.includes(current) ? [...options, current].sort((a, b) => a.localeCompare(b)) : options;
}
