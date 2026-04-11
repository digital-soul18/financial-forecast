-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "uploadId" TEXT,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "balance" REAL,
    "transactionType" TEXT,
    "transactionDetails" TEXT,
    "merchantName" TEXT,
    "accountNumber" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "categorySource" TEXT,
    "categoryConfidence" REAL,
    "dedupHash" TEXT,
    "rdEligible" BOOLEAN NOT NULL DEFAULT false,
    "rdPercentage" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processedOn" DATETIME,
    CONSTRAINT "Transaction_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubcategoryRdConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "rdPercent" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "TransactionAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionAttachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "learnedFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_dedupHash_key" ON "Transaction"("dedupHash");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- CreateIndex
CREATE INDEX "Transaction_source_idx" ON "Transaction"("source");

-- CreateIndex
CREATE UNIQUE INDEX "SubcategoryRdConfig_category_subcategory_key" ON "SubcategoryRdConfig"("category", "subcategory");
