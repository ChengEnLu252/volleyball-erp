-- AlterTable：加 updated_at（樂觀鎖用）。
-- 既有列回填為「最後一次有意義變動」時間（self_reported_at 優先，否則 registered_at），
-- 再設 NOT NULL + 預設 now()；之後由 Prisma @updatedAt 於每次 update 自動 bump。
ALTER TABLE "registrations" ADD COLUMN "updated_at" TIMESTAMP(3);
UPDATE "registrations" SET "updated_at" = COALESCE("self_reported_at", "registered_at");
ALTER TABLE "registrations" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "registrations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
