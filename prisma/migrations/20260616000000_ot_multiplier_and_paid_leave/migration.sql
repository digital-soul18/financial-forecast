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

-- Payslip.leaveDays / billableDays widened Int -> Float in the Prisma schema so
-- half-day leave (0.5) reconciles against netAmount.
--
-- No DDL required: SQLite uses type affinity, and an INTEGER-affinity column
-- stores a non-integral REAL (e.g. 21.5) as REAL without loss. Existing whole
-- numbers are unaffected. Avoiding a table rebuild keeps this migration safe to
-- run against production data.
