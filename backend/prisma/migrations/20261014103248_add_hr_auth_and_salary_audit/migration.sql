-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HR_MANAGER', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryChangeAudit" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "previousSalary" DECIMAL(14,2) NOT NULL,
    "newSalary" DECIMAL(14,2) NOT NULL,
    "previousCurrency" "Currency" NOT NULL,
    "newCurrency" "Currency" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryChangeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SalaryChangeAudit_actorUserId_changedAt_idx" ON "SalaryChangeAudit"("actorUserId", "changedAt");

-- CreateIndex
CREATE INDEX "SalaryChangeAudit_employeeId_changedAt_idx" ON "SalaryChangeAudit"("employeeId", "changedAt");

-- AddForeignKey
ALTER TABLE "SalaryChangeAudit" ADD CONSTRAINT "SalaryChangeAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryChangeAudit" ADD CONSTRAINT "SalaryChangeAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
