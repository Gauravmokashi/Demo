'use client';

import { useState } from 'react';
import { toQueryString } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Analytics, AnalyticsDimension, CURRENCIES, Currency, DashboardSummary, JobLevel, LEVEL_LABELS, PayGroup, SalaryOutlier } from '@/lib/types';
import { useApiData } from '@/lib/useApiData';
import { EmptyState } from './ui/States';

const DIMENSION_LABELS: Record<AnalyticsDimension, string> = {
  country: 'Country',
  department: 'Department',
  level: 'Level',
  jobTitle: 'Job title',
};

type Props = { summary: DashboardSummary | null; onUnauthorized: () => void };

/** Answers "how do we pay people?": pay spread per country, department or level, one currency at a time. */
export function InsightsPanel({ summary, onUnauthorized }: Props) {
  const [dimension, setDimension] = useState<AnalyticsDimension>('department');
  const [country, setCountry] = useState('United States');
  const [currency, setCurrency] = useState('');
  const query = toQueryString({ dimension, country: dimension === 'country' ? '' : country, currency });
  const { data, error, loading } = useApiData<Analytics>(`/employees/analytics?${query}`, {
    onUnauthorized,
    fallbackMessage: 'Pay insights could not be loaded.',
  });
  const outlierQuery = useApiData<SalaryOutlier[]>('/employees/outliers', {
    onUnauthorized,
    fallbackMessage: 'Salary outliers could not be loaded.',
  });

  const byCurrency = new Map<Currency, PayGroup[]>();
  for (const group of data?.groups ?? []) {
    byCurrency.set(group.currency, [...(byCurrency.get(group.currency) ?? []), group]);
  }
  const label = (key: string) => (dimension === 'level' ? LEVEL_LABELS[key as JobLevel] ?? key : key);

  return (
    <section aria-labelledby="insights-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Pay insights</p>
          <h2 id="insights-title" className="mt-1 text-xl font-semibold">How pay is distributed</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#65726a]">
            Median and middle-50% pay range by country, department, job level or title. Each currency stays separate.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
        <label className="text-xs font-medium text-[#526157]">Group by
          <select className="filter-control mt-1 w-full" value={dimension} onChange={(event) => setDimension(event.target.value as AnalyticsDimension)}>
            {(Object.keys(DIMENSION_LABELS) as AnalyticsDimension[]).map((key) => <option key={key} value={key}>{DIMENSION_LABELS[key]}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#526157]">Within country
          <select className="filter-control mt-1 w-full" value={dimension === 'country' ? '' : country} disabled={dimension === 'country'} onChange={(event) => setCountry(event.target.value)}>
            <option value="">All countries</option>
            {(summary?.countries ?? []).map((item) => <option key={item.country} value={item.country}>{item.country}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#526157]">Currency
          <select className="filter-control mt-1 w-full" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="">All currencies</option>
            {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="mb-4 border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{error}</div>}
      {!byCurrency.size && <EmptyState loading={loading} message="No employees match these filters." />}

      <div className="space-y-10">
        {Array.from(byCurrency.entries()).map(([code, groups]) => (
          <PayDistributionTable key={code} currency={code} groups={groups} dimensionLabel={DIMENSION_LABELS[dimension]} label={label} />
        ))}
      </div>

      <section className="mt-10" aria-labelledby="outliers-title">
        <p className="section-kicker">Peer review</p>
        <h3 id="outliers-title" className="mt-1 text-lg font-semibold">Unusual pay compared with peers</h3>
        <p className="mb-4 mt-1 text-xs text-[#65726a]">Flags salaries above 1.5× or below 0.6× the median for the same job title, country and currency. Groups with fewer than five employees are excluded.</p>
        {outlierQuery.error && <div className="mb-3 text-sm text-[#763b31]" role="alert">{outlierQuery.error}</div>}
        {!outlierQuery.data?.length && <EmptyState loading={outlierQuery.loading} message="No employees are outside the peer thresholds." />}
        {!!outlierQuery.data?.length && <div className="overflow-x-auto border-y border-[#cfd8cf]"><table className="w-full min-w-[700px] text-left text-sm">
          <thead><tr className="bg-[#e8ede7] text-[11px] uppercase text-[#5b6c60]"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Peer group</th><th className="px-3 py-3 text-right">Salary</th><th className="px-3 py-3 text-right">Peer median</th><th className="px-3 py-3 text-right">Ratio</th></tr></thead>
          <tbody>{outlierQuery.data.map((person) => <tr key={person.id} className="border-t border-[#e0e5df] bg-white/70"><td className="px-3 py-3 font-medium">{person.fullName}<div className="text-xs font-normal text-[#758078]">{person.employeeId}</div></td><td className="px-3 py-3">{person.jobTitle} · {person.country}<div className="text-xs text-[#758078]">{person.peerCount} peers</div></td><td className="px-3 py-3 text-right">{formatMoney(person.salary, person.currency)}</td><td className="px-3 py-3 text-right">{formatMoney(person.peerMedian, person.currency)}</td><td className="px-3 py-3 text-right font-semibold">{person.ratio.toFixed(2)}×</td></tr>)}</tbody>
        </table></div>}
      </section>
    </section>
  );
}

function PayDistributionTable({ currency, groups, dimensionLabel, label }: { currency: Currency; groups: PayGroup[]; dimensionLabel: string; label: (key: string) => string }) {
  // One scale per currency section so ranges are comparable within it.
  const scaleMin = Math.min(...groups.map((group) => group.min));
  const scaleMax = Math.max(...groups.map((group) => group.max));
  const position = (value: number) => (scaleMax === scaleMin ? 50 : ((value - scaleMin) / (scaleMax - scaleMin)) * 100);
  const headcount = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`currency-mark currency-${currency.toLowerCase()}`} />Paid in {currency}
        <span className="font-normal text-[#65726a]">· {headcount.toLocaleString()} employees</span>
      </h3>
      <div className="overflow-x-auto border-y border-[#cfd8cf]">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <caption className="sr-only">Pay distribution by {dimensionLabel.toLowerCase()} in {currency}</caption>
          <thead>
            <tr className="bg-[#e8ede7] text-[11px] font-semibold uppercase text-[#5b6c60]">
              <th className="px-3 py-3">{dimensionLabel}</th>
              <th className="px-3 py-3 text-right">Headcount</th>
              <th className="w-[32%] px-3 py-3">
                Range <span className="font-normal normal-case">(line: min–max · bar: middle 50% · tick: median)</span>
              </th>
              <th className="px-3 py-3 text-right">Median</th>
              <th className="px-3 py-3 text-right">P25 – P75</th>
              <th className="px-3 py-3 text-right">Min – Max</th>
              <th className="px-3 py-3 text-right">Total payroll</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key} className="border-t border-[#e0e5df] bg-white/70 hover:bg-white">
                <td className="px-3 py-3 font-medium">{label(group.key)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{group.count.toLocaleString()}</td>
                <td className="px-3 py-3">
                  <div
                    className="relative h-6"
                    role="img"
                    aria-label={`${label(group.key)}: median ${formatMoney(group.median, currency)}, middle 50% ${formatMoney(group.p25, currency)} to ${formatMoney(group.p75, currency)}`}
                    title={`Min ${formatMoney(group.min, currency)} · P25 ${formatMoney(group.p25, currency)} · Median ${formatMoney(group.median, currency)} · P75 ${formatMoney(group.p75, currency)} · Max ${formatMoney(group.max, currency)}`}
                  >
                    <div className="absolute top-1/2 h-px -translate-y-1/2 bg-[#9aa79e]" style={{ left: `${position(group.min)}%`, width: `${position(group.max) - position(group.min)}%` }} />
                    <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-[#397553]" style={{ left: `${position(group.p25)}%`, width: `${Math.max(0.5, position(group.p75) - position(group.p25))}%` }} />
                    <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[#182520] ring-2 ring-white" style={{ left: `${position(group.median)}%` }} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(group.median, currency)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[#43534a]">{formatMoney(group.p25, currency)} – {formatMoney(group.p75, currency)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[#758078]">{formatMoney(group.min, currency)} – {formatMoney(group.max, currency)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[#43534a]">{formatMoney(group.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
