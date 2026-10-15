import { formatMoney } from '@/lib/format';
import { DashboardSummary } from '@/lib/types';
import { EmptyState } from './ui/States';
import { useState } from 'react';

type Props = {
  summary: DashboardSummary | null;
  selectedCountry: string;
  onSelectCountry: (country: string) => void;
};

export function PayrollOverview({ summary, selectedCountry, onSelectCountry }: Props) {
  const [showUsd, setShowUsd] = useState(false);
  const payroll = summary?.payrollByCurrency ?? [];
  const maxHeadcount = Math.max(...payroll.map((item) => item.employeeCount), 1);
  const countries = [...(summary?.countries ?? [])].sort((a, b) => b.count - a.count);

  return (
    <section aria-labelledby="payroll-title" className="min-w-0">
      <div className="mb-5">
        <p className="section-kicker">Compensation</p>
        <h2 id="payroll-title" className="mt-1 text-xl font-semibold">Payroll by currency</h2>
        <p className="mt-1 text-xs text-[#65726a]">Totals stay in local currency; bars show headcount paid in each.</p>
        <label className="mt-3 flex items-center gap-2 text-xs text-[#526157]"><input type="checkbox" checked={showUsd} onChange={(event) => setShowUsd(event.target.checked)} />Show combined payroll in USD</label>
        {showUsd && <div className="mt-3 border-l-4 border-[#397553] bg-white px-3 py-2"><div className="text-xs text-[#65726a]">Illustrative USD conversion</div><div className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(summary?.payrollInUsd ?? 0, 'USD')}</div><p className="text-[11px] text-[#758078]">Static multipliers by source currency (EUR ×1.08, GBP ×1.27, INR ×0.012); comparison only, not a payroll or accounting figure.</p></div>}
      </div>
      {payroll.length ? (
        <div className="divide-y divide-[#d7ded7] border-y border-[#d7ded7]">
          {payroll.map((item, index) => (
            <div key={item.currency} className="py-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className={`currency-mark currency-${item.currency.toLowerCase()}`} />{item.currency}</span>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(item.total, item.currency)}</span>
              </div>
              <div className="h-1.5 bg-[#e0e6df]" role="img" aria-label={`${item.employeeCount} employees paid in ${item.currency}`}>
                <div className={`h-full currency-bar currency-bar-${index % 4}`} style={{ width: `${Math.max(4, (item.employeeCount / maxHeadcount) * 100)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-[#65726a]">
                <span>{item.employeeCount.toLocaleString()} employees</span>
                <span>Average {formatMoney(summary?.averageSalaryByCurrency.find((average) => average.currency === item.currency)?.average ?? 0, item.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState loading={!summary} message="Payroll totals will appear when the API is available." />}

      <div className="mt-8">
        <p className="section-kicker">Workforce distribution</p>
        <h2 className="mb-4 mt-1 text-xl font-semibold">By country</h2>
        <div className="divide-y divide-[#d7ded7] border-y border-[#d7ded7]">
          {countries.map((item) => (
            <button
              key={item.country}
              aria-pressed={selectedCountry === item.country}
              className={`flex w-full items-center justify-between py-3 text-left text-sm hover:text-[#286144] ${selectedCountry === item.country ? 'font-semibold text-[#1e4935]' : ''}`}
              onClick={() => onSelectCountry(selectedCountry === item.country ? '' : item.country)}
            >
              <span>{item.country}</span><span className="text-xs tabular-nums text-[#65726a]">{item.count.toLocaleString()}</span>
            </button>
          ))}
          {!countries.length && <EmptyState loading={!summary} message="Country distribution unavailable." />}
        </div>
      </div>
    </section>
  );
}
