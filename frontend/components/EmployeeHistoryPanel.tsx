'use client';

import { formatMoney, formatPercent, percentChange } from '@/lib/format';
import { EmployeeHistory, LEVEL_LABELS } from '@/lib/types';
import { useApiData } from '@/lib/useApiData';
import { Dialog } from './ui/Dialog';

type Props = { employeeId: number; name: string; onClose: () => void; onUnauthorized: () => void };

export function EmployeeHistoryPanel({ employeeId, name, onClose, onUnauthorized }: Props) {
  const { data, error, loading } = useApiData<EmployeeHistory>(`/employees/${employeeId}/history`, {
    onUnauthorized,
    fallbackMessage: 'Salary history could not be loaded.',
  });
  const employee = data?.employee;

  return (
    <Dialog open onClose={onClose} variant="panel" kicker="Employee record" title={name} description={employee ? `${employee.employeeId} · ${employee.jobTitle}` : undefined}>
      {error && <div className="mb-4 border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{error}</div>}
      {loading && !data && <p className="text-sm text-[#65726a]">Loading history…</p>}
      {employee && data && (
        <>
          <dl className="mb-7 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-[#d7ded7] py-4 text-sm">
            <Fact label="Current salary" value={formatMoney(employee.salary, employee.currency)} />
            <Fact label="Effective" value={employee.effectiveDate} />
            <Fact label="Level" value={LEVEL_LABELS[employee.level]} />
            <Fact label="Department" value={employee.department} />
            <Fact label="Country" value={employee.country} />
            <Fact label="Hired" value={employee.hireDate} />
          </dl>

          <h3 className="section-kicker mb-3">Changes made in this system</h3>
          {data.changes.length ? (
            <ol className="mb-7 divide-y divide-[#e0e5df] border-y border-[#d7ded7]">
              {data.changes.map((change) => {
                const delta = percentChange(change.previousSalary, change.newSalary);
                return (
                  <li key={change.changedAt} className="py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold tabular-nums">
                        {formatMoney(change.previousSalary, change.currency)} → {formatMoney(change.newSalary, change.currency)}
                      </span>
                      <span className="tabular-nums text-[#526157]">{formatPercent(delta)}</span>
                    </div>
                    <p className="mt-1 text-[#43534a]">{change.reason}</p>
                    <p className="mt-1 text-xs text-[#758078]">
                      Effective {change.effectiveDate} · by {change.changedBy} on {new Date(change.changedAt).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mb-7 text-sm text-[#758078]">No salary changes recorded yet.</p>
          )}

          <h3 className="section-kicker mb-3">Salary timeline</h3>
          <ol className="divide-y divide-[#e0e5df] border-y border-[#d7ded7]">
            {data.history.map((entry, index) => (
              <li key={`${entry.effectiveDate}-${index}`} className="flex justify-between py-2 text-sm">
                <span className="text-[#526157]">{entry.effectiveDate}</span>
                <span className="font-semibold tabular-nums">{formatMoney(entry.salary, entry.currency)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#758078]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
