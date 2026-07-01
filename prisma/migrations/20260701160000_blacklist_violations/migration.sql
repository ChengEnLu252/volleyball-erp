-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('no_show', 'unpaid', 'manual');

-- CreateEnum
CREATE TYPE "LineNotificationType" AS ENUM ('blacklist');

-- CreateEnum
CREATE TYPE "LineNotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "banned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customer_violations" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "venue_id" TEXT,
    "type" "ViolationType" NOT NULL,
    "reason" TEXT,
    "session_id" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_notifications" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "venue_id" TEXT,
    "type" "LineNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "owed_amount" INTEGER NOT NULL DEFAULT 0,
    "status" "LineNotificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "line_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_violations_customer_id_resolved_at_idx" ON "customer_violations"("customer_id", "resolved_at");

-- CreateIndex
CREATE INDEX "line_notifications_status_idx" ON "line_notifications"("status");

-- AddForeignKey
ALTER TABLE "customer_violations" ADD CONSTRAINT "customer_violations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

