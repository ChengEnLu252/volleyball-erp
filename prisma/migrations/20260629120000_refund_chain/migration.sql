-- P2.1d 退費鏈：Registration.refundDecision + RefundDecision enum + AuditAction 兩值

-- CreateEnum
CREATE TYPE "RefundDecision" AS ENUM ('refunded', 'waived');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ISSUE_REFUND';
ALTER TYPE "AuditAction" ADD VALUE 'WAIVE_REFUND';

-- AlterTable（nullable，對既有列安全）
ALTER TABLE "registrations" ADD COLUMN "refund_decision" "RefundDecision";
