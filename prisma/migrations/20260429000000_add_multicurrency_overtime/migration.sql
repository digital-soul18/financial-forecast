-- Add currency field to Contractor
ALTER TABLE "Contractor" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AUD';

-- Add multicurrency + overtime fields to Payslip
ALTER TABLE "Payslip" ADD COLUMN "overtimeHours" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "overtimeAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AUD';
ALTER TABLE "Payslip" ADD COLUMN "currencySnapRate" REAL NOT NULL DEFAULT 1;
ALTER TABLE "Payslip" ADD COLUMN "netAmountAud" REAL NOT NULL DEFAULT 0;

-- CreateTable OvertimeRequest
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractorId" TEXT NOT NULL,
    "overtimeDate" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OvertimeRequest_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OvertimeRequest_contractorId_idx" ON "OvertimeRequest"("contractorId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- CreateTable ExchangeRate
CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rateToAud" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable AppSetting
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
