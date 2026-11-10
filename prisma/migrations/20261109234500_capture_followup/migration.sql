CREATE TABLE "CaptureFollowup" (
"id" TEXT NOT NULL PRIMARY KEY,
"sessionId" TEXT NOT NULL,
"leadId" TEXT NOT NULL,
"chatId" TEXT NOT NULL,
"firstSentAt" DATETIME NOT NULL,
"lastOutgoingAt" DATETIME NOT NULL,
"eligibleAt" DATETIME NOT NULL,
"checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
"status" TEXT NOT NULL DEFAULT 'waiting',
"reason" TEXT NOT NULL DEFAULT '',
"messageText" TEXT NOT NULL DEFAULT '',
"approvedAt" DATETIME,
"sentAt" DATETIME,
"dayKey" TEXT,
"lastError" TEXT NOT NULL DEFAULT '',
"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CaptureFollowup_leadId_key" ON "CaptureFollowup"("leadId");
CREATE INDEX "CaptureFollowup_sessionId_status_eligibleAt_idx" ON "CaptureFollowup"("sessionId","status","eligibleAt");
CREATE INDEX "CaptureFollowup_sessionId_dayKey_idx" ON "CaptureFollowup"("sessionId","dayKey");
