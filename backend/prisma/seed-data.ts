import { Currency, JobLevel } from '@prisma/client';

/**
 * Pure, deterministic generator for the development seed.
 *
 * A seeded PRNG (instead of index arithmetic) gives realistic variety while staying
 * reproducible: the same seed always yields the same 10,000 employees.
 */

export interface SeedEmployee {
  employeeCode: string;
  fullName: string;
  department: string;
  country: string;
  jobTitle: string;
  level: JobLevel;
  hireDate: Date;
  currency: Currency;
  salary: string;
  effectiveDate: Date;
}

// Fixed "today" for the seed so generated dates never depend on when the script runs.
export const SEED_REFERENCE_DATE = new Date(Date.UTC(2026, 3, 1));
export const DEFAULT_SEED = 20261014;
const DAY_MS = 24 * 60 * 60 * 1000;

const firstNames = [
  'Aarav', 'Maya', 'Noah', 'Aisha', 'Leo', 'Sofia', 'Ethan', 'Priya', 'Amara', 'Lucas',
  'Zara', 'Daniel', 'Mei', 'Oliver', 'Nina', 'Arjun', 'Grace', 'Mateo', 'Elena', 'Samir',
  'Hannah', 'Kwame', 'Isabel', 'Yuki', 'Omar', 'Chloe', 'Ravi', 'Fatima', 'Jonas', 'Ines',
  'Tariq', 'Ana', 'Felix', 'Lina', 'Diego', 'Sara', 'Kenji', 'Ada', 'Hugo', 'Leila',
];
const lastNames = [
  'Patel', 'Brooks', 'Khan', 'Romero', 'Nwosu', 'Mehta', 'Liu', 'Keller', 'Shah', 'Wilson',
  'Haddad', 'Martin', 'Okafor', 'Singh', 'Garcia', 'Chen', 'Muller', 'Silva', 'Ahmed', 'Kim',
  'Dubois', 'Rossi', 'Tanaka', 'Novak', 'Iyer', 'Adeyemi', 'Schmidt', 'Lopez', 'Reddy', 'Clarke',
  'Moreau', 'Fischer', 'Ortiz', 'Bose', 'Wright', 'Costa', 'Lim', 'Hassan', 'Murphy', 'Jensen',
];

// `medianMid` is the typical annual salary of a MID-level, multiplier-1.0 role in that market.
export const markets: { country: string; currency: Currency; medianMid: number; weight: number }[] = [
  { country: 'United States', currency: 'USD', medianMid: 120000, weight: 25 },
  { country: 'India', currency: 'INR', medianMid: 1800000, weight: 25 },
  { country: 'United Kingdom', currency: 'GBP', medianMid: 62000, weight: 10 },
  { country: 'Germany', currency: 'EUR', medianMid: 68000, weight: 10 },
  { country: 'France', currency: 'EUR', medianMid: 58000, weight: 6 },
  { country: 'Spain', currency: 'EUR', medianMid: 45000, weight: 4 },
  { country: 'Singapore', currency: 'USD', medianMid: 85000, weight: 6 },
  { country: 'Canada', currency: 'USD', medianMid: 82000, weight: 6 },
  { country: 'United Arab Emirates', currency: 'USD', medianMid: 75000, weight: 4 },
  { country: 'Nigeria', currency: 'USD', medianMid: 32000, weight: 4 },
];

export const departments: { name: string; role: string; multiplier: number; weight: number }[] = [
  { name: 'Engineering', role: 'Software Engineer', multiplier: 1.15, weight: 30 },
  { name: 'Product', role: 'Product Manager', multiplier: 1.1, weight: 8 },
  { name: 'Design', role: 'Product Designer', multiplier: 1.0, weight: 6 },
  { name: 'Finance', role: 'Financial Analyst', multiplier: 1.05, weight: 8 },
  { name: 'Sales', role: 'Account Executive', multiplier: 1.0, weight: 18 },
  { name: 'Marketing', role: 'Marketing Specialist', multiplier: 0.95, weight: 10 },
  { name: 'Operations', role: 'Operations Analyst', multiplier: 0.85, weight: 12 },
  { name: 'People Ops', role: 'People Partner', multiplier: 0.9, weight: 8 },
];

export const levels: { level: JobLevel; prefix: string; multiplier: number; weight: number }[] = [
  { level: 'JUNIOR', prefix: 'Junior', multiplier: 0.7, weight: 25 },
  { level: 'MID', prefix: '', multiplier: 1.0, weight: 35 },
  { level: 'SENIOR', prefix: 'Senior', multiplier: 1.35, weight: 25 },
  { level: 'LEAD', prefix: 'Lead', multiplier: 1.75, weight: 10 },
  { level: 'PRINCIPAL', prefix: 'Principal', multiplier: 2.3, weight: 5 },
];

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pickWeighted<T extends { weight: number }>(random: () => number, items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function randomDateBetween(random: () => number, start: Date, end: Date): Date {
  const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS);
  return new Date(start.getTime() + Math.floor(random() * (days + 1)) * DAY_MS);
}

export function generateEmployees(count: number, seed = DEFAULT_SEED): SeedEmployee[] {
  const random = createRandom(seed);
  const earliestHire = new Date(Date.UTC(2012, 0, 1));
  const lastReviewWindowStart = new Date(SEED_REFERENCE_DATE.getTime() - 730 * DAY_MS);

  return Array.from({ length: count }, (_, index) => {
    const market = pickWeighted(random, markets);
    const department = pickWeighted(random, departments);
    const level = pickWeighted(random, levels);
    // +/-15% spread around the band midpoint models individual negotiation and performance.
    const spread = 0.85 + random() * 0.3;
    const rounding = market.currency === 'INR' ? 1000 : 100;
    const salary =
      Math.round((market.medianMid * department.multiplier * level.multiplier * spread) / rounding) *
      rounding;
    const hireDate = randomDateBetween(random, earliestHire, SEED_REFERENCE_DATE);
    const reviewStart = hireDate > lastReviewWindowStart ? hireDate : lastReviewWindowStart;

    return {
      employeeCode: `ACM-${String(index + 1).padStart(5, '0')}`,
      fullName: `${pick(random, firstNames)} ${pick(random, lastNames)}`,
      department: department.name,
      country: market.country,
      jobTitle: [level.prefix, department.role].filter(Boolean).join(' '),
      level: level.level,
      hireDate,
      currency: market.currency,
      salary: salary.toFixed(2),
      effectiveDate: randomDateBetween(random, reviewStart, SEED_REFERENCE_DATE),
    };
  });
}
