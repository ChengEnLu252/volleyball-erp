-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('online', 'backend');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('pickup', 'shipping');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('cash_on_pickup', 'cash_on_delivery', 'online_gateway');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "shop_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "compare_at_price" INTEGER,
    "online_stock" INTEGER NOT NULL DEFAULT 0,
    "is_listed" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '🏐',
    "sizes" TEXT[],
    "colors" JSONB NOT NULL DEFAULT '[]',
    "source_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_product_variants" (
    "id" TEXT NOT NULL,
    "shop_product_id" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "sku" VARCHAR(50),
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shop_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_product_images" (
    "id" TEXT NOT NULL,
    "shop_product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,

    CONSTRAINT "shop_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_product_categories" (
    "shop_product_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "shop_product_categories_pkey" PRIMARY KEY ("shop_product_id","category_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_id" TEXT,
    "placed_by_user_id" TEXT,
    "item_total" INTEGER NOT NULL,
    "shipping_fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "fulfillment" "FulfillmentType" NOT NULL,
    "pickup_venue_id" TEXT,
    "shipping" JSONB,
    "payment_channel" "PaymentChannel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "tracking_number" TEXT,
    "shipping_provider" TEXT,
    "shipped_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "image_url" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_categories_slug_key" ON "shop_categories"("slug");

-- CreateIndex
CREATE INDEX "shop_product_variants_shop_product_id_idx" ON "shop_product_variants"("shop_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_product_variants_shop_product_id_size_color_key" ON "shop_product_variants"("shop_product_id", "size", "color");

-- CreateIndex
CREATE INDEX "shop_product_images_shop_product_id_idx" ON "shop_product_images"("shop_product_id");

-- CreateIndex
CREATE INDEX "shop_product_categories_category_id_idx" ON "shop_product_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- AddForeignKey
ALTER TABLE "shop_product_variants" ADD CONSTRAINT "shop_product_variants_shop_product_id_fkey" FOREIGN KEY ("shop_product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_product_images" ADD CONSTRAINT "shop_product_images_shop_product_id_fkey" FOREIGN KEY ("shop_product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_product_categories" ADD CONSTRAINT "shop_product_categories_shop_product_id_fkey" FOREIGN KEY ("shop_product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_product_categories" ADD CONSTRAINT "shop_product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "shop_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

