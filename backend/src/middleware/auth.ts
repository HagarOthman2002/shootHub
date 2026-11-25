import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getLocalUser } from "../lib/users.js";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getLocalUser(clerkUserId);
    if (!user) {
      res.status(404).json({ error: "User record not found in database" });
      return;
    }

    (req as Request & { currentUser: typeof user }).currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}