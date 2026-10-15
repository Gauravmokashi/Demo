# Pay insights: PostgreSQL query reference

The API implementation lives in `backend/src/employees/employees.service.ts`; the Prisma model and index definitions live in `backend/prisma/schema.prisma`. These notes explain the query rules used by that code.

## 1. Employee data and migration

The employee model includes `jobTitle` and `isActive`. The deterministic seed supplies job titles and opening `SalaryHistory` rows. The lifecycle migration adds the active flag and peer-group index for existing databases.

## 2. Pay distribution by dimension (country, department, level or job title)

Per group *and currency*, so currencies are never mixed:

```sql
SELECT
  "country"                                                   AS "group",
  "currency",
  COUNT(*)::int                                               AS "headcount",
  MIN("salary")                                               AS "min",
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY "salary")      AS "median",
  AVG("salary")                                               AS "avg",
  percentile_cont(0.9)  WITHIN GROUP (ORDER BY "salary")      AS "p90",
  MAX("salary")                                               AS "max"
FROM "Employee"
WHERE "isActive" = true
GROUP BY "country", "currency"
ORDER BY "country", "currency";
```

The API also supports `department`, `level` and `jobTitle`. It validates the dimension and chooses its SQL identifier from a fixed whitelist.

## 3. Outliers (paid far from the peer median)

Peers are the same job title, country and currency. The endpoint flags salaries above 1.5× or below 0.6× of the group median; groups need at least five active employees.

```sql
WITH peer AS (
  SELECT
    "jobTitle", "country", "currency",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "salary") AS median,
    COUNT(*) AS n
  FROM "Employee"
  WHERE "isActive" = true
  GROUP BY "jobTitle", "country", "currency"
  HAVING COUNT(*) >= 5          -- ignore tiny groups
)
SELECT
  e."id", e."employeeCode", e."fullName", e."jobTitle", e."country", e."currency",
  e."salary", p.median,
  ROUND((e."salary" / p.median::numeric), 2) AS "ratio"
FROM "Employee" e
JOIN peer p USING ("jobTitle", "country", "currency")
WHERE e."isActive" = true
  AND (e."salary" > p.median::numeric * 1.5 OR e."salary" < p.median::numeric * 0.6)
ORDER BY ABS(LN(e."salary" / p.median)) DESC
LIMIT 100;
```

## 4. Payroll total in USD (explicit conversion)

The implementation multiplies local salaries by fixed USD comparison rates: USD 1.00, EUR 1.08, GBP 1.27 and INR 0.012. It never changes stored salaries.

```sql
SELECT SUM("salary" * r.rate) AS "payrollUsd"
FROM "Employee" e
JOIN (VALUES ('USD', 1.0), ('EUR', 1.08), ('GBP', 1.27), ('INR', 0.012))
  AS r(currency, rate) ON r.currency = e."currency"::text
WHERE e."isActive" = true;
```

The UI labels these static rates as illustrative.

## 5. NestJS service sketch

This sketch shows the whitelist pattern. The shipped implementation is consolidated in EmployeesService, not a separate insights module.

```ts
// insights.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type Dimension = 'country' | 'department' | 'jobTitle' | 'level';

// Whitelist: raw SQL identifiers can't be parameterized.
const COLUMNS: Record<Dimension, Prisma.Sql> = {
  country: Prisma.raw('"country"'),
  department: Prisma.raw('"department"'),
  jobTitle: Prisma.raw('"jobTitle"'),
  level: Prisma.raw('"level"'),
};

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async distribution(dimension: Dimension) {
    const col = COLUMNS[dimension];
    if (!col) throw new Error('Unsupported dimension');
    return this.prisma.$queryRaw`
      SELECT ${col} AS "group", "currency",
             COUNT(*)::int AS "headcount",
             MIN("salary")::float AS "min",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "salary")::float AS "median",
             AVG("salary")::float AS "avg",
             MAX("salary")::float AS "max"
      FROM "Employee"
      WHERE "isActive" = true
      GROUP BY ${col}, "currency"
      ORDER BY ${col}, "currency"`;
  }
}
```

The corresponding DTO validates all four dimensions before the service uses the whitelist.

## 6. Integration coverage (real Postgres)

- Assert exact median and quartile values, separate currencies, job-title groups and active-only data.
- Plant high and low salaries; verify outlier thresholds and the five-person minimum.
- Verify unsupported dimensions return 400.

These checks live in `backend/test/employees.int-spec.ts` and run in CI with PostgreSQL 16.

## 7. Performance

- No `EXPLAIN ANALYZE` timings are recorded yet; measure them on the seeded 10,000-row database before claiming a latency target.
- The peer-group index on `("jobTitle", "country", "currency")` is included in the migration. Consider caching only if measured query times show it is needed.
