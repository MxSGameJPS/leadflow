CREATE TABLE "RecoveryCommercial" ("id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "chatId" TEXT NOT NULL, "phase" TEXT NOT NULL, "meetingAt" DATETIME, "proposalAmount" INTEGER, "notes" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "RecoveryCommercial_sessionId_chatId_key" ON "RecoveryCommercial"("sessionId","chatId");
CREATE INDEX "RecoveryCommercial_sessionId_phase_idx" ON "RecoveryCommercial"("sessionId","phase");
