-- CreateTable
CREATE TABLE "part_timer_sheets" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "revenue_override" INTEGER,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_timer_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_timer_sheets_venue_id_month_idx" ON "part_timer_sheets"("venue_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "part_timer_sheets_venue_id_month_key" ON "part_timer_sheets"("venue_id", "month");

-- AddForeignKey
ALTER TABLE "part_timer_sheets" ADD CONSTRAINT "part_timer_sheets_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_timer_sheets" ADD CONSTRAINT "part_timer_sheets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

