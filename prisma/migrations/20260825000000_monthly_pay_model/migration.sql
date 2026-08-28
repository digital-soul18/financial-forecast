-- Fixed monthly salary support.
--
-- All columns are ADDITIVE with defaults that preserve existing behaviour:
-- every contractor stays on payModel = "daily" until an admin switches them,
-- so no existing pay changes as a result of this migration.
--
-- NOTE: deliberately no column TYPE changes here. Altering a column type makes
-- `prisma db push` (the container start command) abort with a data-loss
-- warning and crash-loop the deployment.
ALTER TABLE "Contractor" ADD COLUMN "payModel"        TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "Contractor" ADD COLUMN "monthlySalary"   REAL;
ALTER TABLE "Contractor" ADD COLUMN "probationSalary" REAL;

ALTER TABLE "Payslip" ADD COLUMN "payModelSnap"   TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "Payslip" ADD COLUMN "baseSalarySnap" REAL NOT NULL DEFAULT 0;
