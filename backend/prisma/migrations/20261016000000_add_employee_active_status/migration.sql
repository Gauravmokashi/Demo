ALTER TABLE "Employee" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");
CREATE INDEX "Employee_jobTitle_country_currency_idx" ON "Employee"("jobTitle", "country", "currency");
