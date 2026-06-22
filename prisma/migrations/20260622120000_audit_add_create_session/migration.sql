
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CREATE_SESSION';

-- AlterTable
ALTER TABLE "registrations" ALTER COLUMN "updated_at" DROP DEFAULT;

