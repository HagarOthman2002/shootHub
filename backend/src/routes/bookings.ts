import { Router } from "express";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db } from "../db/index.js";
import {
  equipment,
  equipmentBookings,
  freelancerBookings,
  freelancers,
  locationBookings,
  locations,
} from "../db/schema.js";
import { getLocalUser } from "../lib/users.js";

export const bookingsRouter = Router();

const createLocationBookingSchema = z.object({
  locationId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

const createEquipmentBookingSchema = z.object({
  equipmentId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

const createFreelancerBookingSchema = z.object({
  freelancerId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

function calculateTotalCents(
  priceCents: number,
  pricingUnit: "hour" | "day",
  start: Date,
  end: Date
): number {
  const diffMs = end.getTime() - start.getTime();
  const hourMs = 1000 * 60 * 60;
  const dayMs = hourMs * 24;

  if (pricingUnit === "hour") {
    const hours = Math.max(1, Math.ceil(diffMs / hourMs));
    return hours * priceCents;
  }

  const days = Math.max(1, Math.ceil(diffMs / dayMs));
  return days * priceCents;
}

function parseDateRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return { start, end };
}

bookingsRouter.get("/my", async (req, res) => {
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

    const [myLocationBookings, myEquipmentBookings, myFreelancerBookings] = await Promise.all([
      db.select().from(locationBookings).where(eq(locationBookings.userId, currentUser.id)),
      db.select().from(equipmentBookings).where(eq(equipmentBookings.userId, currentUser.id)),
      db.select().from(freelancerBookings).where(eq(freelancerBookings.userId, currentUser.id)),
    ]);

    res.json({
      data: {
        locations: myLocationBookings,
        equipment: myEquipmentBookings,
        freelancers: myFreelancerBookings,
      },
    });
  } catch (err) {
    console.error("GET /api/bookings/my error:", err);
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

bookingsRouter.post("/locations", async (req, res) => {
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

    const parsed = createLocationBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid booking data", details: parsed.error.flatten() });
      return;
    }

    const range = parseDateRange(parsed.data.startAt, parsed.data.endAt);
    if (!range) {
      res.status(400).json({ error: "endAt must be after startAt" });
      return;
    }
    const { start, end } = range;

    const [loc] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, parsed.data.locationId))
      .limit(1);

    if (!loc || loc.status !== "published") {
      res.status(404).json({ error: "Location not found or unavailable" });
      return;
    }

    // Overlap condition: existing.startAt < new.endAt AND existing.endAt > new.startAt
    const overlapping = await db
      .select({ id: locationBookings.id })
      .from(locationBookings)
      .where(
        and(
          eq(locationBookings.locationId, loc.id),
          inArray(locationBookings.status, ["pending", "approved"]),
          lt(locationBookings.startAt, end),
          gt(locationBookings.endAt, start)
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      res.status(409).json({ error: "Selected time range overlaps with an existing booking" });
      return;
    }

    const totalPriceCents = calculateTotalCents(loc.priceCents, loc.pricingUnit, start, end);

    const [created] = await db
      .insert(locationBookings)
      .values({
        userId: currentUser.id,
        locationId: loc.id,
        startAt: start,
        endAt: end,
        totalPriceCents,
        currency: loc.currency,
        notes: parsed.data.notes,
        status: "pending",
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    console.error("POST /api/bookings/locations error:", err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

bookingsRouter.post("/equipment", async (req, res) => {
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

    const parsed = createEquipmentBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid booking data", details: parsed.error.flatten() });
      return;
    }

    const range = parseDateRange(parsed.data.startAt, parsed.data.endAt);
    if (!range) {
      res.status(400).json({ error: "endAt must be after startAt" });
      return;
    }
    const { start, end } = range;

    const [item] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, parsed.data.equipmentId))
      .limit(1);

    if (!item || item.status !== "published") {
      res.status(404).json({ error: "Equipment not found or unavailable" });
      return;
    }

    const overlapping = await db
      .select({ id: equipmentBookings.id })
      .from(equipmentBookings)
      .where(
        and(
          eq(equipmentBookings.equipmentId, item.id),
          inArray(equipmentBookings.status, ["pending", "approved"]),
          lt(equipmentBookings.startAt, end),
          gt(equipmentBookings.endAt, start)
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      res.status(409).json({ error: "Selected time range overlaps with an existing booking" });
      return;
    }

    const totalPriceCents = calculateTotalCents(item.priceCents, item.pricingUnit, start, end);

    const [created] = await db
      .insert(equipmentBookings)
      .values({
        userId: currentUser.id,
        equipmentId: item.id,
        startAt: start,
        endAt: end,
        totalPriceCents,
        depositCents: item.depositCents,
        currency: item.currency,
        notes: parsed.data.notes,
        status: "pending",
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    console.error("POST /api/bookings/equipment error:", err);
    res.status(500).json({ error: "Failed to create equipment booking" });
  }
});

bookingsRouter.post("/freelancers", async (req, res) => {
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

    const parsed = createFreelancerBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid booking data", details: parsed.error.flatten() });
      return;
    }

    const range = parseDateRange(parsed.data.startAt, parsed.data.endAt);
    if (!range) {
      res.status(400).json({ error: "endAt must be after startAt" });
      return;
    }
    const { start, end } = range;

    const [freelancer] = await db
      .select()
      .from(freelancers)
      .where(eq(freelancers.id, parsed.data.freelancerId))
      .limit(1);

    if (!freelancer || !freelancer.isAvailable) {
      res.status(404).json({ error: "Freelancer not found or unavailable" });
      return;
    }

    const overlapping = await db
      .select({ id: freelancerBookings.id })
      .from(freelancerBookings)
      .where(
        and(
          eq(freelancerBookings.freelancerId, freelancer.id),
          inArray(freelancerBookings.status, ["pending", "approved"]),
          lt(freelancerBookings.startAt, end),
          gt(freelancerBookings.endAt, start)
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      res.status(409).json({ error: "Selected time range overlaps with an existing booking" });
      return;
    }

    const totalPriceCents = calculateTotalCents(
      freelancer.priceCents,
      freelancer.pricingUnit,
      start,
      end
    );

    const [created] = await db
      .insert(freelancerBookings)
      .values({
        userId: currentUser.id,
        freelancerId: freelancer.id,
        startAt: start,
        endAt: end,
        totalPriceCents,
        currency: freelancer.currency,
        notes: parsed.data.notes,
        status: "pending",
      })
      .returning();

    res.status(201).json({ data: created });
  } catch (err) {
    console.error("POST /api/bookings/freelancers error:", err);
    res.status(500).json({ error: "Failed to create freelancer booking" });
  }
});

const updateStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled", "completed"]),
});

// 1. جلب الحجوزات الواردة للمالك أو الفريلانس
bookingsRouter.get("/incoming", async (req, res) => {
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

    const [ownedLocations, ownedEquipment, [freelancerProfile]] = await Promise.all([
      db.select({ id: locations.id }).from(locations).where(eq(locations.ownerId, currentUser.id)),
      db.select({ id: equipment.id }).from(equipment).where(eq(equipment.ownerId, currentUser.id)),
      db.select({ id: freelancers.id }).from(freelancers).where(eq(freelancers.userId, currentUser.id)).limit(1),
    ]);

    const locationIds = ownedLocations.map((l) => l.id);
    const equipmentIds = ownedEquipment.map((e) => e.id);

    const [incomingLocations, incomingEquipment, incomingFreelancer] = await Promise.all([
      locationIds.length > 0
        ? db.select().from(locationBookings).where(inArray(locationBookings.locationId, locationIds))
        : Promise.resolve([]),
      equipmentIds.length > 0
        ? db.select().from(equipmentBookings).where(inArray(equipmentBookings.equipmentId, equipmentIds))
        : Promise.resolve([]),
      freelancerProfile
        ? db.select().from(freelancerBookings).where(eq(freelancerBookings.freelancerId, freelancerProfile.id))
        : Promise.resolve([]),
    ]);

    res.json({
      data: {
        locations: incomingLocations,
        equipment: incomingEquipment,
        freelancers: incomingFreelancer,
      },
    });
  } catch (err) {
    console.error("GET /api/bookings/incoming error:", err);
    res.status(500).json({ error: "Failed to load incoming bookings" });
  }
});

// 2. قبول / رفض / إلغاء / إكمال الحجز
bookingsRouter.patch("/:type/:id/status", async (req, res) => {
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

    const { type, id } = req.params;
    if (!["locations", "equipment", "freelancers"].includes(type)) {
      res.status(400).json({ error: "Invalid booking type" });
      return;
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status", details: parsed.error.flatten() });
      return;
    }

    const nextStatus = parsed.data.status;

    if (type === "locations") {
      const [booking] = await db.select().from(locationBookings).where(eq(locationBookings.id, id)).limit(1);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const [loc] = await db.select().from(locations).where(eq(locations.id, booking.locationId)).limit(1);
      const isRenter = booking.userId === currentUser.id;
      const isOwner = loc?.ownerId === currentUser.id;

      if (!isRenter && !isOwner) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (isRenter && !isOwner && nextStatus !== "cancelled") {
        res.status(403).json({ error: "Renters can only cancel their bookings" });
        return;
      }

      const [updated] = await db
        .update(locationBookings)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(locationBookings.id, id))
        .returning();

      res.json({ data: updated });
      return;
    }

    if (type === "equipment") {
      const [booking] = await db.select().from(equipmentBookings).where(eq(equipmentBookings.id, id)).limit(1);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const [item] = await db.select().from(equipment).where(eq(equipment.id, booking.equipmentId)).limit(1);
      const isRenter = booking.userId === currentUser.id;
      const isOwner = item?.ownerId === currentUser.id;

      if (!isRenter && !isOwner) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (isRenter && !isOwner && nextStatus !== "cancelled") {
        res.status(403).json({ error: "Renters can only cancel their bookings" });
        return;
      }

      const [updated] = await db
        .update(equipmentBookings)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(equipmentBookings.id, id))
        .returning();

      res.json({ data: updated });
      return;
    }

    // type === "freelancers"
    const [booking] = await db.select().from(freelancerBookings).where(eq(freelancerBookings.id, id)).limit(1);
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const [fl] = await db.select().from(freelancers).where(eq(freelancers.id, booking.freelancerId)).limit(1);
    const isRenter = booking.userId === currentUser.id;
    const isFreelancer = fl?.userId === currentUser.id;

    if (!isRenter && !isFreelancer) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (isRenter && !isFreelancer && nextStatus !== "cancelled") {
      res.status(403).json({ error: "Clients can only cancel their bookings" });
      return;
    }

    const [updated] = await db
      .update(freelancerBookings)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(freelancerBookings.id, id))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/bookings/:type/:id/status error:", err);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});