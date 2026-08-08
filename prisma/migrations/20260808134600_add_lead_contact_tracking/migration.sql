ALTER TABLE "Lead" ADD COLUMN "lastContactAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "lastContactKind" TEXT;
ALTER TABLE "Lead" ADD COLUMN "contactCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Lead_lastContactAt_idx" ON "Lead"("lastContactAt");
