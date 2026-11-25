import "dotenv/config"
import express from "express"
import cors from "cors"

import fs from "node:fs"
import path from "node:path"

import { locationsRouter } from "./routes/locations";
import { equipmentRouter } from "./routes/equipment";
import { freelancersRouter } from "./routes/freelancers";
import { bookingsRouter } from "./routes/bookings";
import { uploadsRouter } from "./routes/uploads.js";


import {clerkMiddleware} from "@clerk/express"
import {clerkWebhookHandler} from "./webhooks/clerk"
import {getEnv} from "./lib/env"

const env = getEnv()
const app = express()

app.use(cors())

const rawJson = express.raw({ type: "application/json" , limit :"10mb" })

app.post("/webhooks/clerk", rawJson,(req, res) => {
  void clerkWebhookHandler(req, res)
})

app.use(express.json({ limit: "10mb" }));

app.use(clerkMiddleware())





app.use("/api/locations", locationsRouter);
app.use("/api/equipment", equipmentRouter);
app.use("/api/freelancers", freelancersRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/uploads", uploadsRouter);

const publicDir = path.join(process.cwd(), "public")
if(fs.existsSync(publicDir)){
  app.use(express.static(publicDir))

  app.get("/{*path}", (req, res,next) => {
    if(req.method !== "GET" && req.method !== "HEAD"){
      next()
      return
      
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")){
      next()
      return
    }
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err))
  })
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const anyErr = err as { status?: number; statusCode?: number; type?: string; message?: string };
  const status = anyErr?.status ?? anyErr?.statusCode ?? 500;
  console.error("Express error:", {
    method: req.method,
    url: req.originalUrl,
    contentLength: req.headers["content-length"],
    status,
    type: anyErr?.type,
    message: anyErr?.message,
  });
  res.status(status).json({ error: status === 413 ? "Payload too large" : "Internal server error" });
});

app.listen(env.PORT, ()=> console.log("listening on port:" , env.PORT))

