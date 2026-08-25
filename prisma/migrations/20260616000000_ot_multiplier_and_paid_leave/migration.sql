-- Configurable overtime multiplier + paid/unpaid leave split on payslips.
--
-- otMultiplier defaults to 1 (straight time) so NO existing pay changes until
-- an admin explicitly sets it per contractor.
ALTER TABLE "Contractor" ADD COLUMN "otMultiplier" REAL NOT NULL DEFAULT 1;

-- Payslip: split leaveDays into paid vs unpaid, snapshot the OT multiplier.
-- Both default 0 / 1, so pre-cutover payslips keep their existing figures and
-- are identifiable (paidLeaveDays = 0 while leaveDays > 0 means old logic).
ALTER TABLE "Payslip" ADD COLUMN "paidLeaveDays"    REAL NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "unpaidLeaveDays"  REAL NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "otMultiplierSnap" REAL NOT NULL DEFAULT 1;

-- NOTE: leaveDays / billableDays deliberately remain INTEGER.
-- Widening them to Float caused `prisma db push` (used in the container start
-- command) to abort with a data-loss warning, crash-looping the deployment.
-- Fractional precision lives in paidLeaveDays / unpaidLeaveDays instead, and
-- netAmount is always computed from those exact values.
