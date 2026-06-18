
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending';

