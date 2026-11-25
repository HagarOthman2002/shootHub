import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "../db/index.js";
import { locations, locationCategoryEnum } from "../db/schema.js";
import { getLocalUser } from "../lib/users.js";

export const locationsRouter = Router();

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

    res.json({ data: rows });
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

    const [created] = await db
      .insert(locations)
      .values({
        ...parsed.data,
        ownerId: currentUser.id,
        facilities: parsed.data.facilities ?? [],
        status: "published",
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    console.error("POST /api/locations error:", err);
    res.status(500).json({ error: "Failed to create location" });
  }
});