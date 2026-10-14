CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'INR');

CREATE TABLE "Employee" (
  "id" SERIAL NOT NULL,
  "employeeCode" VARCHAR(24) NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "department" VARCHAR(100) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "currency" "Currency" NOT NULL,
  "salary" DECIMAL(14,2) NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryHistory" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "salary" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE INDEX "Employee_country_department_idx" ON "Employee"("country", "department");
CREATE INDEX "Employee_currency_salary_idx" ON "Employee"("currency", "salary");
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");
CREATE INDEX "SalaryHistory_employeeId_effectiveDate_idx" ON "SalaryHistory"("employeeId", "effectiveDate");

ALTER TABLE "SalaryHistory"
ADD CONSTRAINT "SalaryHistory_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;