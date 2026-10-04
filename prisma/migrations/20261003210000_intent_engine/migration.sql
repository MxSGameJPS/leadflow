CREATE TABLE IF NOT EXISTS "IntentSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "author" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "query" TEXT,
    "publishedAt" TEXT,
    "matchedService" TEXT NOT NULL DEFAULT 'unknown',
    "intentType" TEXT NOT NULL DEFAULT 'other',
    "buyerStage" TEXT NOT NULL DEFAULT 'unknown',
    "intentLevel" TEXT NOT NULL DEFAULT 'unknown',
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0,
    "explicitIntent" BOOLEAN NOT NULL DEFAULT false,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "band" TEXT NOT NULL DEFAULT 'low',
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "leadId" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntentSignal_fingerprint_key" ON "IntentSignal"("fingerprint");
CREATE INDEX IF NOT EXISTS "IntentSignal_score_idx" ON "IntentSignal"("intentScore" DESC);
CREATE INDEX IF NOT EXISTS "IntentSignal_status_idx" ON "IntentSignal"("status");
CREATE INDEX IF NOT EXISTS "IntentSignal_source_idx" ON "IntentSignal"("source");
