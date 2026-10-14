-- Job architecture: lets HR compare pay by level, not only by country/department.
CREATE TYPE "JobLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL');

-- Backfill existing rows with neutral values, then drop the defaults so new rows must be explicit.
ALTER TABLE "Employee"
  ADD COLUMN "jobTitle" VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  ADD COLUMN "level" "JobLevel" NOT NULL DEFAULT 'MID',
  ADD COLUMN "hireDate" DATE;
UPDATE "Employee" SET "hireDate" = "effectiveDate" WHERE "hireDate" IS NULL;
ALTER TABLE "Employee"
  ALTER COLUMN "hireDate" SET NOT NULL,
  ALTER COLUMN "jobTitle" DROP DEFAULT,
  ALTER COLUMN "level" DROP DEFAULT;

CREATE INDEX "Employee_level_idx" ON "Employee"("level");

-- Every salary change must carry a business reason.
ALTER TABLE "SalaryChangeAudit" ADD COLUMN "reason" VARCHAR(500) NOT NULL DEFAULT 'Not recorded';
ALTER TABLE "SalaryChangeAudit" ALTER COLUMN "reason" DROP DEFAULT;

-- Give every employee an opening salary-history row so the timeline starts at their current salary.
INSERT INTO "SalaryHistory" ("employeeId", "salary", "currency", "effectiveDate")
SELECT e."id", e."salary", e."currency", e."effectiveDate"
FROM "Employee" e
WHERE NOT EXISTS (SELECT 1 FROM "SalaryHistory" h WHERE h."employeeId" = e."id");
