CREATE TABLE "RecoveryOutcome" ("id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "chatId" TEXT NOT NULL, "result" TEXT NOT NULL, "contractAmount" INTEGER, "reason" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "RecoveryOutcome_sessionId_chatId_key" ON "RecoveryOutcome"("sessionId","chatId");
CREATE INDEX "RecoveryOutcome_sessionId_result_idx" ON "RecoveryOutcome"("sessionId","result");
