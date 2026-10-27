CREATE TABLE "CaptureApproval" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "leadId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL,
 "chatId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'draft',
 "messageText" TEXT NOT NULL DEFAULT '',
 "approvedAt" DATETIME,
 "sentAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CaptureApproval_leadId_key" ON "CaptureApproval"("leadId");
CREATE INDEX "CaptureApproval_sessionId_chatId_idx" ON "CaptureApproval"("sessionId","chatId");
CREATE INDEX "CaptureApproval_status_createdAt_idx" ON "CaptureApproval"("status","createdAt");
