-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'UPSERT_LEDGER';

-- CreateTable
CREATE TABLE "ledger_days" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '{}',
    "merch" INTEGER NOT NULL DEFAULT 0,
    "snacks" INTEGER NOT NULL DEFAULT 0,
    "drinks" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 0,
    "other" INTEGER NOT NULL DEFAULT 0,
    "season_fee" INTEGER NOT NULL DEFAULT 0,
    "private_prepay" INTEGER NOT NULL DEFAULT 0,
    "ac_fee" INTEGER NOT NULL DEFAULT 0,
    "refund" INTEGER NOT NULL DEFAULT 0,
    "ac_degrees" INTEGER NOT NULL DEFAULT 0,
    "booking_note" TEXT NOT NULL DEFAULT '',
    "refund_note" TEXT NOT NULL DEFAULT '',
    "merch_note" TEXT NOT NULL DEFAULT '',
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_days_venue_id_date_idx" ON "ledger_days"("venue_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_days_venue_id_date_key" ON "ledger_days"("venue_id", "date");

-- AddForeignKey
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_days_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_days_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

