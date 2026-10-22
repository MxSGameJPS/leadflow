CREATE TABLE "WhatsAppLeadLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "WhatsAppLeadLink_sessionId_chatId_key" ON "WhatsAppLeadLink"("sessionId", "chatId");
CREATE INDEX "WhatsAppLeadLink_leadId_idx" ON "WhatsAppLeadLink"("leadId");
