CREATE TYPE "public"."booking_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."equipment_category" AS ENUM('camera', 'lens', 'lighting', 'tripod', 'audio', 'stabilizer', 'accessory', 'other');--> statement-breakpoint
CREATE TYPE "public"."equipment_condition" AS ENUM('new', 'excellent', 'good', 'fair');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."location_category" AS ENUM('villa', 'studio', 'desert', 'beach', 'historical', 'rooftop', 'garden', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_request', 'booking_approved', 'booking_rejected', 'booking_cancelled', 'booking_completed', 'new_review');--> statement-breakpoint
CREATE TYPE "public"."pricing_unit" AS ENUM('hour', 'day');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'owner');--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"brand" text,
	"model" text,
	"category" "equipment_category" NOT NULL,
	"condition" "equipment_condition" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'day' NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"city" text NOT NULL,
	"pickup_location" text,
	"delivery_available" boolean DEFAULT false NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "equipment_blocked_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"total_price_cents" integer NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"notes" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"image_kit_file_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "freelancer_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"freelancer_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"total_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"notes" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freelancers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"specialty" text NOT NULL,
	"bio" text,
	"city" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'day' NOT NULL,
	"portfolio_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freelancers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "location_blocked_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"total_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"notes" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"image_kit_file_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"latitude" text,
	"longitude" text,
	"category" "location_category" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'hour' NOT NULL,
	"capacity" integer,
	"facilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rules" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"phone" text,
	"avatar_url" text,
	"image_kit_file_id" text,
	"bio" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_blocked_periods" ADD CONSTRAINT "equipment_blocked_periods_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_bookings" ADD CONSTRAINT "equipment_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_bookings" ADD CONSTRAINT "equipment_bookings_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_favorites" ADD CONSTRAINT "equipment_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_favorites" ADD CONSTRAINT "equipment_favorites_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_images" ADD CONSTRAINT "equipment_images_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_reviews" ADD CONSTRAINT "equipment_reviews_booking_id_equipment_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."equipment_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_reviews" ADD CONSTRAINT "equipment_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_bookings" ADD CONSTRAINT "freelancer_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_bookings" ADD CONSTRAINT "freelancer_bookings_freelancer_id_freelancers_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."freelancers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancers" ADD CONSTRAINT "freelancers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_blocked_periods" ADD CONSTRAINT "location_blocked_periods_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_bookings" ADD CONSTRAINT "location_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_bookings" ADD CONSTRAINT "location_bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_favorites" ADD CONSTRAINT "location_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_favorites" ADD CONSTRAINT "location_favorites_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_images" ADD CONSTRAINT "location_images_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_reviews" ADD CONSTRAINT "location_reviews_booking_id_location_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."location_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_reviews" ADD CONSTRAINT "location_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_owner_idx" ON "equipment" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "equipment_city_idx" ON "equipment" USING btree ("city");--> statement-breakpoint
CREATE INDEX "equipment_category_idx" ON "equipment" USING btree ("category");--> statement-breakpoint
CREATE INDEX "equipment_status_idx" ON "equipment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "equipment_bookings_user_idx" ON "equipment_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equipment_bookings_equipment_idx" ON "equipment_bookings" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "equipment_bookings_status_idx" ON "equipment_bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_favorites_unique_idx" ON "equipment_favorites" USING btree ("user_id","equipment_id");--> statement-breakpoint
CREATE INDEX "freelancer_bookings_user_idx" ON "freelancer_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "freelancer_bookings_freelancer_idx" ON "freelancer_bookings" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "freelancer_bookings_status_idx" ON "freelancer_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "freelancers_city_idx" ON "freelancers" USING btree ("city");--> statement-breakpoint
CREATE INDEX "freelancers_available_idx" ON "freelancers" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "location_bookings_user_idx" ON "location_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "location_bookings_location_idx" ON "location_bookings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "location_bookings_status_idx" ON "location_bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "location_favorites_unique_idx" ON "location_favorites" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE INDEX "locations_owner_idx" ON "locations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "locations_city_idx" ON "locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "locations_category_idx" ON "locations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "locations_status_idx" ON "locations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");