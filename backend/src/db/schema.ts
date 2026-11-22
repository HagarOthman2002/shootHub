import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. ENUMS & TYPES
// ==========================================

export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "owner",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending",
  "published",
  "rejected",
  "archived",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "completed",
]);

export const pricingUnitEnum = pgEnum("pricing_unit", [
  "hour",
  "day",
]);

export const locationCategoryEnum = pgEnum("location_category", [
  "villa",
  "studio",
  "desert",
  "beach",
  "historical",
  "rooftop",
  "garden",
  "other",
]);

export const equipmentCategoryEnum = pgEnum("equipment_category", [
  "camera",
  "lens",
  "lighting",
  "tripod",
  "audio",
  "stabilizer",
  "accessory",
  "other",
]);

export const equipmentConditionEnum = pgEnum("equipment_condition", [
  "new",
  "excellent",
  "good",
  "fair",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "booking_request",
  "booking_approved",
  "booking_rejected",
  "booking_cancelled",
  "booking_completed",
  "new_review",
]);

export type UserRole =
  (typeof userRoleEnum.enumValues)[number];

export type BookingStatus =
  (typeof bookingStatusEnum.enumValues)[number];

export type ListingStatus =
  (typeof listingStatusEnum.enumValues)[number];

// ==========================================
// 2. USERS
// ==========================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  clerkUserId: text("clerk_user_id")
    .notNull()
    .unique(),

  email: text("email").notNull().unique(),

  displayName: text("display_name"),

  phone: text("phone"),

  avatarUrl: text("avatar_url"),

  imageKitFileId: text("image_kit_file_id"),

  bio: text("bio"),

  role: userRoleEnum("role").notNull().default("customer"),

  isAdmin: boolean("is_admin").notNull().default(false),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==========================================
// 3. LOCATIONS
// ==========================================

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    name: text("name").notNull(),

    slug: text("slug").notNull().unique(),

    description: text("description").notNull(),

    city: text("city").notNull(),

    address: text("address").notNull(),

    latitude: text("latitude"),

    longitude: text("longitude"),

    category: locationCategoryEnum("category")
      .notNull(),

    priceCents: integer("price_cents").notNull(),

    currency: text("currency").notNull().default("EGP"),

    pricingUnit: pricingUnitEnum("pricing_unit")
      .notNull().default("hour"),

    capacity: integer("capacity"),

    facilities: jsonb("facilities")
      .$type<string[]>()
      .notNull()
      .default([]),

    rules: text("rules"),

    status: listingStatusEnum("status")
      .notNull().default("draft"),

    featured: boolean("featured").notNull().default(false),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("locations_owner_idx").on(table.ownerId),
    index("locations_city_idx").on(table.city),
    index("locations_category_idx").on(table.category),
    index("locations_status_idx").on(table.status),
  ]
);

// ==========================================
// 4. LOCATION IMAGES
// ==========================================

export const locationImages = pgTable("location_images", {
  id: uuid("id").defaultRandom().primaryKey(),

  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),

  imageUrl: text("image_url").notNull(),

  imageKitFileId: text("image_kit_file_id"),

  isPrimary: boolean("is_primary").notNull().default(false),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});

// ==========================================
// 5. EQUIPMENT
// ==========================================

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    name: text("name").notNull(),

    slug: text("slug").notNull().unique(),

    description: text("description").notNull(),

    brand: text("brand"),

    model: text("model"),

    category: equipmentCategoryEnum("category")
      .notNull(),

    condition: equipmentConditionEnum("condition")
      .notNull(),

    priceCents: integer("price_cents").notNull(),

    currency: text("currency").notNull().default("EGP"),

    pricingUnit: pricingUnitEnum("pricing_unit")
      .notNull().default("day"),

    depositCents: integer("deposit_cents").notNull().default(0),

    city: text("city").notNull(),

    pickupLocation: text("pickup_location"),

    deliveryAvailable: boolean("delivery_available")
      .notNull().default(false),

    status: listingStatusEnum("status")
      .notNull().default("draft"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("equipment_owner_idx").on(table.ownerId),
    index("equipment_city_idx").on(table.city),
    index("equipment_category_idx").on(table.category),
    index("equipment_status_idx").on(table.status),
  ]
);

// ==========================================
// 6. EQUIPMENT IMAGES
// ==========================================

export const equipmentImages = pgTable("equipment_images", {
  id: uuid("id").defaultRandom().primaryKey(),

  equipmentId: uuid("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "cascade" }),

  imageUrl: text("image_url").notNull(),

  imageKitFileId: text("image_kit_file_id"),

  isPrimary: boolean("is_primary").notNull().default(false),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});

// ==========================================
// 7. LOCATION BOOKINGS
// ==========================================

export const locationBookings = pgTable(
  "location_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),

    startAt: timestamp("start_at", {
      withTimezone: true,
    }).notNull(),

    endAt: timestamp("end_at", {
      withTimezone: true,
    }).notNull(),

    totalPriceCents: integer("total_price_cents").notNull(),

    currency: text("currency").notNull().default("EGP"),

    notes: text("notes"),

    status: bookingStatusEnum("status")
      .notNull().default("pending"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("location_bookings_user_idx").on(table.userId),
    index("location_bookings_location_idx").on(table.locationId),
    index("location_bookings_status_idx").on(table.status),
  ]
);

// ==========================================
// 8. EQUIPMENT BOOKINGS
// ==========================================

export const equipmentBookings = pgTable(
  "equipment_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "restrict" }),

    startAt: timestamp("start_at", {
      withTimezone: true,
    }).notNull(),

    endAt: timestamp("end_at", {
      withTimezone: true,
    }).notNull(),

    totalPriceCents: integer("total_price_cents").notNull(),

    depositCents: integer("deposit_cents").notNull().default(0),

    currency: text("currency").notNull().default("EGP"),

    notes: text("notes"),

    status: bookingStatusEnum("status")
      .notNull().default("pending"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("equipment_bookings_user_idx").on(table.userId),
    index("equipment_bookings_equipment_idx").on(table.equipmentId),
    index("equipment_bookings_status_idx").on(table.status),
  ]
);

// ==========================================
// 9. FAVORITES
// ==========================================

export const locationFavorites = pgTable(
  "location_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("location_favorites_unique_idx")
      .on(table.userId, table.locationId),
  ]
);

export const equipmentFavorites = pgTable(
  "equipment_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("equipment_favorites_unique_idx")
      .on(table.userId, table.equipmentId),
  ]
);

// ==========================================
// 10. REVIEWS
// ==========================================

export const locationReviews = pgTable(
  "location_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => locationBookings.id, { onDelete: "restrict" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    rating: integer("rating").notNull(),

    comment: text("comment"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  }
);

export const equipmentReviews = pgTable(
  "equipment_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => equipmentBookings.id, { onDelete: "restrict" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    rating: integer("rating").notNull(),

    comment: text("comment"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  }
);

// ==========================================
// 11. NOTIFICATIONS
// ==========================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    type: notificationTypeEnum("type").notNull(),

    title: text("title").notNull(),

    message: text("message").notNull(),

    isRead: boolean("is_read").notNull().default(false),

    // Optional metadata such as bookingId or listingId
    data: jsonb("data").$type<Record<string, string>>(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
  ]
);

export const locationBlockedPeriods = pgTable(
  "location_blocked_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),

    startAt: timestamp("start_at", {
      withTimezone: true,
    }).notNull(),

    endAt: timestamp("end_at", {
      withTimezone: true,
    }).notNull(),

    reason: text("reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  }
);

export const equipmentBlockedPeriods = pgTable(
  "equipment_blocked_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),

    startAt: timestamp("start_at", {
      withTimezone: true,
    }).notNull(),

    endAt: timestamp("end_at", {
      withTimezone: true,
    }).notNull(),

    reason: text("reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  }
);