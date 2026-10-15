'use client';

import { AlertTriangle } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { apiJson, UnauthorizedError } from '@/lib/api';
import { formatMoney, formatPercent, percentChange, todayIsoDate } from '@/lib/format';
import { Employee } from '@/lib/types';
import { Dialog } from './ui/Dialog';

// Mirrors the API rule: larger changes need an explicit confirmation.
export const LARGE_CHANGE_PERCENT = 20;

type Props = {
  employee: Employee;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  onUnauthorized: () => void;
};

export function SalaryEditDialog({ employee, onClose, onSaved, onUnauthorized }: Props) {
  const [salary, setSalary] = useState(String(employee.salary));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const newSalary = Number(salary);
  const change = Number.isFinite(newSalary) && newSalary > 0 ? percentChange(employee.salary, newSalary) : 0;
  const isLargeChange = Math.abs(change) > LARGE_CHANGE_PERCENT;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const updated = await apiJson<Employee>(`/employees/${employee.id}/salary`, {
        method: 'PATCH',
        fallbackMessage: 'Salary update failed.',
        body: JSON.stringify({
          salary: newSalary,
          effectiveDate: form.get('effectiveDate'),
          reason: String(form.get('reason') ?? '').trim(),
          ...(isLargeChange ? { confirmLargeChange: form.get('confirmLargeChange') === 'on' } : {}),
        }),
      });
      onSaved(updated);
    } catch (reason) {
      if (reason instanceof UnauthorizedError) onUnauthorized();
      else setError(reason instanceof Error ? reason.message : 'Salary update failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} kicker="Compensation change" title="Edit salary" description={`${employee.fullName} · ${employee.employeeId} · ${employee.jobTitle}`}>
      <form className="space-y-4" onSubmit={submit}>
        {error && <div className="border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{error}</div>}
        <label className="block text-sm font-medium">Annual salary ({employee.currency})
          <input
            className="filter-control mt-1 w-full px-3"
            name="salary"
            type="number"
            min="0.01"
            max="100000000"
            step="0.01"
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
            aria-label="Annual salary"
            required
          />
        </label>
        <div className="flex items-center justify-between bg-[#eef2ed] px-3 py-2 text-sm" aria-live="polite">
          <span className="text-[#65726a]">{formatMoney(employee.salary, employee.currency)} → <strong className="text-[#182520]">{formatMoney(newSalary || 0, employee.currency)}</strong></span>
          <span className={`font-semibold tabular-nums ${isLargeChange ? 'text-[#a34a34]' : 'text-[#2f5f43]'}`}>{formatPercent(change)}</span>
        </div>
        <p className="text-xs text-[#758078]">Paid in {employee.currency}. This salary update keeps the currently assigned currency.</p>
        <label className="block text-sm font-medium">Effective date
          <input className="filter-control mt-1 w-full px-3" name="effectiveDate" type="date" min={employee.effectiveDate} max={todayIsoDate()} defaultValue={todayIsoDate()} required />
        </label>
        <label className="block text-sm font-medium">Reason for change
          <textarea className="filter-control mt-1 h-20 w-full px-3 py-2" name="reason" minLength={3} maxLength={500} placeholder="e.g. Annual review, promotion to Senior, market adjustment" required />
        </label>
        {isLargeChange && (
          <div className="flex items-start gap-2 border-l-4 border-[#c98a2e] bg-[#fbf1df] px-3 py-2 text-sm text-[#6b4a15]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p>This is a {formatPercent(change)} change, above the {LARGE_CHANGE_PERCENT}% review threshold.</p>
              <label className="mt-1 flex items-center gap-2 font-medium">
                <input type="checkbox" name="confirmLargeChange" required /> I confirm this large change
              </label>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#d7ded7] pt-4">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save change'}</button>
        </div>
      </form>
    </Dialog>
  );
}
