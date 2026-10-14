import { Currency } from './types';

export function formatMoney(value: number, code: Currency) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export function percentChange(previous: number, next: number) {
  return previous > 0 ? ((next - previous) / previous) * 100 : 0;
}

export function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
