import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "../db/index.js";
import { locations, locationCategoryEnum, locationImages } from "../db/schema.js";
import { getLocalUser } from "../lib/users.js";

export const locationsRouter = Router();

const imageInputSchema = z.object({
  imageUrl: z.string().url(),
  imageKitFileId: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const createLocationSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(5),
  city: z.string().min(2),
  address: z.string().min(3),
  category: z.enum(locationCategoryEnum.enumValues).default("studio"),
  priceCents: z.number().int().positive(),
  currency: z.string().min(1).default("EGP"),
  pricingUnit: z.enum(["hour", "day"]).default("hour"),
  capacity: z.number().int().positive().optional(),
  facilities: z.array(z.string()).optional(),
  rules: z.string().optional(),
  images: z.array(imageInputSchema).optional(),
});

locationsRouter.get("/", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
    const category =
      typeof req.query.category === "string" &&
      locationCategoryEnum.enumValues.includes(req.query.category as any)
        ? (req.query.category as (typeof locationCategoryEnum.enumValues)[number])
        : undefined;

    const conditions = [eq(locations.status, "published")];
    if (city) conditions.push(eq(locations.city, city));
    if (category) conditions.push(eq(locations.category, category));

    const rows = await db
      .select()
      .from(locations)
      .where(and(...conditions));

    const ids = rows.map((r) => r.id);
    const imgs =
      ids.length > 0
        ? await db.select().from(locationImages).where(inArray(locationImages.locationId, ids))
        : [];

    const data = rows.map((loc) => {
      const locImgs = imgs.filter((img) => img.locationId === loc.id);
      const primary = locImgs.find((i) => i.isPrimary) ?? locImgs[0] ?? null;
      return {
        ...loc,
        images: locImgs,
        primaryImageUrl: primary?.imageUrl ?? null,
      };
    });

    res.json({ data });
  } catch (err) {
    console.error("GET /api/locations error:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

locationsRouter.post("/", async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const currentUser = await getLocalUser(clerkUserId);
    if (!currentUser) {
      res.status(404).json({ error: "User not synced in database" });
      return;
    }

    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const { images, ...locationData } = parsed.data;

    const [created] = await db
      .insert(locations)
      .values({
        ...locationData,
        ownerId: currentUser.id,
        facilities: locationData.facilities ?? [],
        status: "published",
      })
      .returning();

    let savedImages: (typeof locationImages.$inferSelect)[] = [];
    if (images && images.length > 0) {
      savedImages = await db
        .insert(locationImages)
        .values(
          images.map((img, idx) => ({
            locationId: created.id,
            imageUrl: img.imageUrl,
            imageKitFileId: img.imageKitFileId,
            isPrimary: img.isPrimary ?? idx === 0,
          }))
        )
        .returning();
    }

    res.status(201).json({
      data: {
        ...created,
        images: savedImages,
        primaryImageUrl: savedImages[0]?.imageUrl ?? null,
      },
    });
  } catch (err) {
    console.error("POST /api/locations error:", err);
    res.status(500).json({ error: "Failed to create location" });
  }
});