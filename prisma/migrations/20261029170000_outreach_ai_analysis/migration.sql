ALTER TABLE "OutreachObservation" ADD COLUMN "aiCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachObservation" ADD COLUMN "aiReasoning" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachObservation" ADD COLUMN "aiRecommendation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OutreachObservation" ADD COLUMN "aiAnalyzedReplyAt" DATETIME;
