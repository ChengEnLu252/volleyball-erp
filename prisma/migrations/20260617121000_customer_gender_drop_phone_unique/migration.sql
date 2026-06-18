
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'undisclosed');

-- DropIndex
DROP INDEX "customers_phone_key";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "gender" "Gender";

