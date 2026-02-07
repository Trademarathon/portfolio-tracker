-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "size" REAL NOT NULL,
    "pnl" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "emotionStart" TEXT,
    "emotionEnd" TEXT,
    "mistakeType" TEXT,
    "notes" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalValue" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
