CREATE TABLE "RecoverySecondAttempt" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "sessionId" TEXT NOT NULL,
 "chatId" TEXT NOT NULL,
 "firstSentAt" DATETIME NOT NULL,
 "lastOutgoingAt" DATETIME NOT NULL,
 "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "eligibleAt" DATETIME NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'review',
 "reason" TEXT NOT NULL DEFAULT '',
 "messageText" TEXT NOT NULL DEFAULT '',
 "approvedAt" DATETIME,
 "sentAt" DATETIME,
 "dayKey" TEXT,
 "lastError" TEXT NOT NULL DEFAULT '',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "RecoverySecondAttempt_sessionId_chatId_key" ON "RecoverySecondAttempt"("sessionId","chatId");
CREATE INDEX "RecoverySecondAttempt_sessionId_status_eligibleAt_idx" ON "RecoverySecondAttempt"("sessionId","status","eligibleAt");
CREATE INDEX "RecoverySecondAttempt_sessionId_dayKey_idx" ON "RecoverySecondAttempt"("sessionId","dayKey");
