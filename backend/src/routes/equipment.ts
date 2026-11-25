import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "../db/index.js";
import { equipment, equipmentCategoryEnum, equipmentConditionEnum } from "../db/schema.js";
import { getLocalUser } from "../lib/users.js";

export const equipmentRouter = Router();

const createEquipmentSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(5),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.enum(equipmentCategoryEnum.enumValues),
  condition: z.enum(equipmentConditionEnum.enumValues).default("excellent"),
  priceCents: z.number().int().positive(),
  currency: z.string().min(1).default("EGP"),
  pricingUnit: z.enum(["hour", "day"]).default("day"),
  depositCents: z.number().int().min(0).default(0),
  city: z.string().min(2),
  pickupLocation: z.string().optional(),
  deliveryAvailable: z.boolean().default(false),
});

equipmentRouter.get("/", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
    const category =
      typeof req.query.category === "string" &&
      equipmentCategoryEnum.enumValues.includes(req.query.category as any)
        ? (req.query.category as (typeof equipmentCategoryEnum.enumValues)[number])
        : undefined;

    const conditions = [eq(equipment.status, "published")];
    if (city) conditions.push(eq(equipment.city, city));
    if (category) conditions.push(eq(equipment.category, category));

    const rows = await db
      .select()
      .from(equipment)
      .where(and(...conditions));

    res.json({ data: rows });
  } catch (err) {
    console.error("GET /api/equipment error:", err);
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

equipmentRouter.post("/", async (req, res) => {
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

    const parsed = createEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const [created] = await db
      .insert(equipment)
      .values({
        ...parsed.data,
        ownerId: currentUser.id,
        status: "published",
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    console.error("POST /api/equipment error:", err);
    res.status(500).json({ error: "Failed to create equipment" });
  }
});