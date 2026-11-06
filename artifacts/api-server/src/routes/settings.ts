/**
 * routes/settings.ts — Shipping configuration (database-backed, single source of truth)
 *   GET /api/settings/shipping   public  — storefront shows the same fees the server charges
 *   PUT /api/settings/shipping   permission: settings
 */
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { requirePermission } from "../middleware/admin-auth";
import { getShippingConfig, saveShippingConfig } from "../services/settings-service";

const router = Router();

router.get("/shipping", asyncHandler(async (_req, res) => {
  res.json(await getShippingConfig());
}));

const ShippingSchema = z.object({
  shippingFee: z.number().min(0).max(5000),
  freeShippingAbove: z.number().min(0).max(1_000_000),
  codFee: z.number().min(0).max(5000),
  codEnabled: z.boolean(),
  freeShippingEnabled: z.boolean(),
});

router.put("/shipping", requirePermission("settings"), asyncHandler(async (req, res) => {
  const body = ShippingSchema.safeParse(req.body);
  if (!body.success) throw new AppError(400, body.error.issues[0]?.message ?? "Invalid request", "VALIDATION_ERROR");
  await saveShippingConfig(body.data);
  res.json(await getShippingConfig());
}));

export default router;
