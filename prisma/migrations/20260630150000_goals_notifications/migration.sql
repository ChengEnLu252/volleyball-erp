-- CreateEnum
CREATE TYPE "WeeklyGoalStatus" AS ENUM ('assigned', 'submitted', 'confirmed', 'returned');

-- CreateEnum
CREATE TYPE "WeeklyGoalSource" AS ENUM ('owner_assigned', 'manager_self');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('goal_submitted', 'goal_confirmed', 'goal_returned', 'order_placed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_WEEKLY_GOAL';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT_WEEKLY_GOAL';
ALTER TYPE "AuditAction" ADD VALUE 'CONFIRM_WEEKLY_GOAL';
ALTER TYPE "AuditAction" ADD VALUE 'RETURN_WEEKLY_GOAL';

-- CreateTable
CREATE TABLE "weekly_goals" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "source" "WeeklyGoalSource" NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "WeeklyGoalStatus" NOT NULL DEFAULT 'assigned',
    "evidence_id" TEXT,
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "return_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_href" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_goals_venue_id_week_start_idx" ON "weekly_goals"("venue_id", "week_start");

-- CreateIndex
CREATE INDEX "app_notifications_recipient_user_id_is_read_idx" ON "app_notifications"("recipient_user_id", "is_read");

