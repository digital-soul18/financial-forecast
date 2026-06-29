-- Leave tracking — add probation / accrual config to Contractor,
-- classification + half-day support to LeaveRequest, and a forfeiture log.

-- Contractor: leave policy fields with PH defaults (Steph profile).
ALTER TABLE "Contractor" ADD COLUMN "probationMonths"              INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Contractor" ADD COLUMN "country"                      TEXT    NOT NULL DEFAULT 'PH';
ALTER TABLE "Contractor" ADD COLUMN "accrualUsableDuringProbation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contractor" ADD COLUMN "vlAccrualPerMonth"            REAL    NOT NULL DEFAULT 0.83;
ALTER TABLE "Contractor" ADD COLUMN "slAccrualPerMonth"            REAL    NOT NULL DEFAULT 0.42;

-- LeaveRequest: classification + half-day support.
ALTER TABLE "LeaveRequest" ADD COLUMN "leaveType"          TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "days"               REAL NOT NULL DEFAULT 1;
ALTER TABLE "LeaveRequest" ADD COLUMN "classificationNote" TEXT;

-- LeaveForfeiture: anniversary forfeiture log (audit trail).
CREATE TABLE "LeaveForfeiture" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "contractorId"    TEXT     NOT NULL,
    "anniversaryDate" DATETIME NOT NULL,
    "vlForfeited"     REAL     NOT NULL DEFAULT 0,
    "slForfeited"     REAL     NOT NULL DEFAULT 0,
    "note"            TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveForfeiture_contractorId_fkey"
        FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeaveForfeiture_contractorId_anniversaryDate_key"
    ON "LeaveForfeiture"("contractorId", "anniversaryDate");
CREATE INDEX "LeaveForfeiture_contractorId_idx"
    ON "LeaveForfeiture"("contractorId");
