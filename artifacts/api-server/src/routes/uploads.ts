/**
 * routes/uploads.ts — Product image uploads (strictly validated)
 *   POST /api/uploads/product-image   permission: products   body = raw image bytes
 *   GET  /api/uploads/:id             public, immutable cache
 */
import express, { Router } from "express";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";
import { db, uploadedImagesTable } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { MAX_IMAGE_BYTES, inspectImage } from "../lib/image-validate";
import { requirePermission } from "../middleware/admin-auth";
import sharp from "sharp";
import { logger } from "../lib/logger";

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many uploads. Please wait a minute." },
});

router.post(
  "/product-image",
  uploadLimiter,
  requirePermission("products"),
  // Only these content types are even read; anything else arrives as an empty body and is rejected below
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_IMAGE_BYTES }),
  asyncHandler(async (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError(415, "Send the image as the raw request body with Content-Type image/jpeg, image/png or image/webp.", "UNSUPPORTED_MEDIA");
    }
    const info = inspectImage(body, req.get("content-type") ?? undefined);
    if (typeof info === "string") throw new AppError(400, info, "INVALID_IMAGE");

    const id = nanoid(16);
    await db.insert(uploadedImagesTable).values({
      id, contentType: info.contentType, size: body.length, width: info.width, height: info.height, data: body,
    });
    res.status(201).json({ url: `/api/uploads/${id}`, width: info.width, height: info.height, size: body.length, contentType: info.contentType });
  }),
);

// ── Resized variants ───────────────────────────────────────────────────────
// ?w=320|480|640|800|1000 → WebP at that width (never enlarged). Cached in memory (bounded) and
// by browsers/CDN forever, because an upload id is immutable.
const WIDTHS = new Set([320, 480, 640, 800, 1000]);
const variantCache = new Map<string, Buffer>();
const VARIANT_CACHE_MAX = 300;

async function variant(id: string, original: Buffer, width: number): Promise<Buffer | null> {
  const key = `${id}:${width}`;
  const hit = variantCache.get(key);
  if (hit) return hit;
  try {
    const out = await sharp(original, { limitInputPixels: 36_000_000 })
      .rotate() // honour EXIF orientation from phone cameras
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    if (variantCache.size >= VARIANT_CACHE_MAX) variantCache.delete(variantCache.keys().next().value as string);
    variantCache.set(key, out);
    return out;
  } catch (err) {
    logger.warn({ err, id }, "Image resize failed — serving original");
    return null;
  }
}

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) throw new AppError(404, "Not found", "NOT_FOUND");
    const [img] = await db.select().from(uploadedImagesTable).where(eq(uploadedImagesTable.id, id));
    if (!img) throw new AppError(404, "Not found", "NOT_FOUND");

    let body: Buffer = img.data;
    let type: string = img.contentType;
    const w = Number(req.query.w);
    if (req.query.w !== undefined) {
      if (!WIDTHS.has(w)) throw new AppError(400, "w must be one of 320, 480, 640, 800, 1000", "VALIDATION_ERROR");
      const resized = await variant(id, img.data, w);
      if (resized) { body = resized; type = "image/webp"; }
    }
    res.set({
      "Content-Type": type,
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-site",
    });
    res.send(body);
  }),
);

export default router;
