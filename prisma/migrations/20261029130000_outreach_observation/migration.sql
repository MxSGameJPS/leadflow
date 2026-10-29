CREATE TABLE "OutreachObservation" ("id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "channel" TEXT NOT NULL, "chatId" TEXT NOT NULL, "leadId" TEXT, "messageText" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'unverified', "category" TEXT NOT NULL DEFAULT 'unclassified', "evidence" TEXT NOT NULL DEFAULT '', "replyAt" DATETIME, "checkedAt" DATETIME, "lastError" TEXT NOT NULL DEFAULT '', "updatedAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "OutreachObservation_sessionId_channel_chatId_key" ON "OutreachObservation"("sessionId","channel","chatId");
CREATE INDEX "OutreachObservation_sessionId_channel_status_idx" ON "OutreachObservation"("sessionId","channel","status");
CREATE INDEX "OutreachObservation_sessionId_replyAt_idx" ON "OutreachObservation"("sessionId","replyAt");
