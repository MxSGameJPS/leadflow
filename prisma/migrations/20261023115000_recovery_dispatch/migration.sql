CREATE TABLE "RecoveryDispatch" ("id" TEXT NOT NULL PRIMARY KEY,"sessionId" TEXT NOT NULL,"chatId" TEXT NOT NULL,"decisionId" TEXT NOT NULL,"dayKey" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'reserved',"messageSnapshot" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "RecoveryDispatch_sessionId_chatId_key" ON "RecoveryDispatch"("sessionId","chatId");
CREATE INDEX "RecoveryDispatch_sessionId_dayKey_idx" ON "RecoveryDispatch"("sessionId","dayKey");
