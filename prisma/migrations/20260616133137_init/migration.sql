-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "VenueRole" AS ENUM ('manager', 'staff');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('E', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S*');

-- CreateEnum
CREATE TYPE "NetHeight" AS ENUM ('female', 'male', 'adjustable');

-- CreateEnum
CREATE TYPE "SeasonRentalStatus" AS ENUM ('pending', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('male_only', 'male_mixed', 'male_position', 'female_only', 'female_mixed', 'female_position', 'rental');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('open', 'full', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('registered', 'waitlist', 'cancelled', 'attended');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('season_player', 'season_substitute', 'walk_in');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('staff', 'captain', 'self');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'online');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'partial', 'refunded', 'unpaid');

-- CreateEnum
CREATE TYPE "ProductTransactionType" AS ENUM ('purchase_in', 'sale', 'gift', 'adjustment');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE_REGISTRATION', 'CANCEL_REGISTRATION', 'UPDATE_PAYMENT', 'ADD_PAYMENT', 'ADD_PRODUCT_SALE', 'ADD_PRODUCT_GIFT', 'ADJUST_STOCK', 'UPDATE_SESSION', 'CANCEL_SESSION', 'CAPTAIN_LOGIN', 'MARK_ATTENDANCE_BY_CAPTAIN', 'ADD_WALKIN_BY_CAPTAIN', 'SELF_PAYMENT_REPORT', 'CREATE_SEASON_RENTAL', 'UPDATE_SEASON_RENTAL', 'CANCEL_SEASON_RENTAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('gift_ratio', 'revenue_drop', 'low_stock', 'unpaid_excess', 'signup_drop');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('warning', 'critical');

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "global_role" "GlobalRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_venue_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "role" "VenueRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_venue_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "skill_level" "SkillLevel",
    "preferred_net_height" "NetHeight",
    "notes" TEXT,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "num_weeks" INTEGER NOT NULL DEFAULT 12,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeslots" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "label" VARCHAR(100),
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "court" VARCHAR(50),
    "default_net_height" "NetHeight" NOT NULL,
    "default_session_type" "SessionType" NOT NULL,
    "default_min_skill_required" "SkillLevel",
    "default_max_skill_allowed" "SkillLevel",
    "default_max_capacity" INTEGER NOT NULL DEFAULT 18,
    "default_court_fee" INTEGER NOT NULL,
    "is_hot_zone" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeslots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_rentals" (
    "id" TEXT NOT NULL,
    "timeslot_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "captain_id" TEXT NOT NULL,
    "price_per_session" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "access_token" VARCHAR(64) NOT NULL,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" "SeasonRentalStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "timeslot_id" TEXT,
    "season_rental_id" TEXT,
    "created_by" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "court" VARCHAR(50),
    "net_height" "NetHeight" NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "court_fee" INTEGER NOT NULL,
    "ac_fee" INTEGER NOT NULL DEFAULT 0,
    "ac_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_capacity" INTEGER NOT NULL,
    "min_skill_required" "SkillLevel",
    "max_skill_allowed" "SkillLevel",
    "status" "SessionStatus" NOT NULL DEFAULT 'open',
    "is_unattended" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "RegistrationType" NOT NULL,
    "registered_by" TEXT,
    "registered_by_source" "RegistrationSource" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'registered',
    "notes" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "self_reported_paid" BOOLEAN NOT NULL DEFAULT false,
    "self_payment_method" "PaymentMethod",
    "self_payment_evidence" TEXT,
    "self_reported_at" TIMESTAMP(3),

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'paid',
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "sku" VARCHAR(50),
    "unit_price" INTEGER NOT NULL,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_transactions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "operated_by" TEXT NOT NULL,
    "type" "ProductTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER,
    "total_amount" INTEGER,
    "customer_id" TEXT,
    "session_id" TEXT,
    "notes" TEXT,
    "operated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_alerts" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_venue_roles_user_id_venue_id_key" ON "user_venue_roles"("user_id", "venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "timeslots_venue_id_day_of_week_idx" ON "timeslots"("venue_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "season_rentals_access_token_key" ON "season_rentals"("access_token");

-- CreateIndex
CREATE INDEX "season_rentals_timeslot_id_season_id_idx" ON "season_rentals"("timeslot_id", "season_id");

-- CreateIndex
CREATE INDEX "season_rentals_captain_id_idx" ON "season_rentals"("captain_id");

-- CreateIndex
CREATE INDEX "sessions_venue_id_session_date_idx" ON "sessions"("venue_id", "session_date");

-- CreateIndex
CREATE INDEX "sessions_timeslot_id_idx" ON "sessions"("timeslot_id");

-- CreateIndex
CREATE INDEX "sessions_season_rental_id_idx" ON "sessions"("season_rental_id");

-- CreateIndex
CREATE INDEX "registrations_session_id_idx" ON "registrations"("session_id");

-- CreateIndex
CREATE INDEX "registrations_customer_id_idx" ON "registrations"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_session_id_customer_id_key" ON "registrations"("session_id", "customer_id");

-- CreateIndex
CREATE INDEX "product_transactions_product_id_idx" ON "product_transactions"("product_id");

-- CreateIndex
CREATE INDEX "product_transactions_venue_id_operated_at_idx" ON "product_transactions"("venue_id", "operated_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "user_venue_roles" ADD CONSTRAINT "user_venue_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_venue_roles" ADD CONSTRAINT "user_venue_roles_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_rentals" ADD CONSTRAINT "season_rentals_timeslot_id_fkey" FOREIGN KEY ("timeslot_id") REFERENCES "timeslots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_rentals" ADD CONSTRAINT "season_rentals_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_rentals" ADD CONSTRAINT "season_rentals_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_timeslot_id_fkey" FOREIGN KEY ("timeslot_id") REFERENCES "timeslots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_season_rental_id_fkey" FOREIGN KEY ("season_rental_id") REFERENCES "season_rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transactions" ADD CONSTRAINT "product_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transactions" ADD CONSTRAINT "product_transactions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transactions" ADD CONSTRAINT "product_transactions_operated_by_fkey" FOREIGN KEY ("operated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transactions" ADD CONSTRAINT "product_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transactions" ADD CONSTRAINT "product_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_alerts" ADD CONSTRAINT "anomaly_alerts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
