import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "../db/index.js";
import { freelancers } from "../db/schema.js";
import { getLocalUser } from "../lib/users.js";

export const freelancersRouter = Router();

const upsertFreelancerSchema = z.object({
  specialty: z.string().min(2),
  bio: z.string().optional(),
  city: z.string().min(2),
  priceCents: z.number().int().positive(),
  currency: z.string().min(1).default("EGP"),
  pricingUnit: z.enum(["hour", "day"]).default("day"),
  portfolioUrls: z.array(z.string().url()).optional(),
  isAvailable: z.boolean().default(true),
});

freelancersRouter.get("/", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
    const specialty = typeof req.query.specialty === "string" ? req.query.specialty.trim() : undefined;

    const conditions = [eq(freelancers.isAvailable, true)];
    if (city) conditions.push(eq(freelancers.city, city));
    if (specialty) conditions.push(eq(freelancers.specialty, specialty));

    const rows = await db
      .select()
      .from(freelancers)
      .where(and(...conditions));

    res.json({ data: rows });
  } catch (err) {
    console.error("GET /api/freelancers error:", err);
    res.status(500).json({ error: "Failed to fetch freelancers" });
  }
});

freelancersRouter.put("/me", async (req, res) => {
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

    const parsed = upsertFreelancerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const [saved] = await db
      .insert(freelancers)
      .values({
        ...parsed.data,
        userId: currentUser.id,
        portfolioUrls: parsed.data.portfolioUrls ?? [],
      })
      .onConflictDoUpdate({
        target: freelancers.userId,
        set: {
          ...parsed.data,
          portfolioUrls: parsed.data.portfolioUrls ?? [],
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ data: saved });
  } catch (err) {
    console.error("PUT /api/freelancers/me error:", err);
    res.status(500).json({ error: "Failed to save freelancer profile" });
  }
});