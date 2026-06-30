-- CreateTable
CREATE TABLE "manager_salaries" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "person_name" TEXT NOT NULL,
    "base_salary" INTEGER NOT NULL DEFAULT 0,
    "design_pay" INTEGER NOT NULL DEFAULT 0,
    "bonuses" JSONB NOT NULL DEFAULT '[]',
    "include_off_peak_bonus" BOOLEAN NOT NULL DEFAULT true,
    "insurance_self" INTEGER NOT NULL DEFAULT 0,
    "leave_days" INTEGER NOT NULL DEFAULT 0,
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manager_salaries_venue_id_month_idx" ON "manager_salaries"("venue_id", "month");

-- AddForeignKey
ALTER TABLE "manager_salaries" ADD CONSTRAINT "manager_salaries_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_salaries" ADD CONSTRAINT "manager_salaries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

