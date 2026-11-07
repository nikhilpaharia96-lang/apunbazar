/**
 * routes/products.ts — Product catalog endpoints
 *
 * Problems fixed vs original:
 * - console.error replaced with structured pino logger
 * - All handlers use asyncHandler (consistent with other routes)
 * - AppError thrown instead of inline res.status().json() for errors
 * - formatProduct return type is explicit (no implicit any)
 * - Search string length validated to prevent memory pressure
 * - Category lookup batched correctly for all list endpoints
 */

import { Router } from "express";
import { z } from "zod";
import { eq, ilike, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  mainCategoriesTable,
  type Product,
  type MainCategory,
} from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductBody,
  UpdateProductParams,
  DeleteProductParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { requirePermission } from "../middleware/admin-auth";
import { isAllowedImageRef } from "../lib/image-validate";
import { logMovement } from "../services/order-lifecycle";
import { logger } from "../lib/logger";

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────
interface FormattedProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice: number | null;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  imageUrl: string;
  images: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  featured: boolean;
  artisan: string | null;
  origin: string | null;
  tags: string[];
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatProduct(
  p: Product,
  category: Pick<MainCategory, "name" | "slug"> | undefined,
): FormattedProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: Number(p.price),
    originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
    categoryId: p.categoryId,
    categoryName: category?.name ?? "",
    categorySlug: category?.slug ?? "",
    imageUrl: p.imageUrl,
    images: p.images ?? [],
    stock: p.stock,
    rating: Number(p.rating),
    reviewCount: p.reviewCount,
    featured: p.featured,
    artisan: p.artisan ?? null,
    origin: p.origin ?? null,
    tags: p.tags ?? [],
    createdAt: p.createdAt.toISOString(),
  };
}

async function buildCategoryMap(
  products: Product[],
): Promise<Map<number, Pick<MainCategory, "name" | "slug">>> {
  const categoryIds = [...new Set(products.map((p) => p.categoryId))];
  if (!categoryIds.length) return new Map();

  const categories = await db
    .select({ id: mainCategoriesTable.id, name: mainCategoriesTable.name, slug: mainCategoriesTable.slug })
    .from(mainCategoriesTable)
    .where(inArray(mainCategoriesTable.id, categoryIds));

  return new Map(categories.map((c) => [c.id, { name: c.name, slug: c.slug }]));
}

// ── GET /api/products/featured ─────────────────────────────────────────────
router.get(
  "/featured",
  asyncHandler(async (_req, res) => {
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.featured, true))
      .limit(8);

    const catMap = await buildCategoryMap(products);

    res.json(products.map((p) => formatProduct(p, catMap.get(p.categoryId))));
  }),
);

// ── GET /api/products ──────────────────────────────────────────────────────
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = ListProductsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    const { category, search, minPrice, maxPrice, sort, page, limit, featured } =
      parsed.data;

    const conditions = [];

    if (search) {
      // Max length enforced in Zod schema (see api-zod); extra guard here
      conditions.push(ilike(productsTable.name, `%${search.slice(0, 100)}%`));
    }
    if (minPrice !== undefined)
      conditions.push(gte(productsTable.price, String(minPrice)));
    if (maxPrice !== undefined)
      conditions.push(lte(productsTable.price, String(maxPrice)));
    if (featured !== undefined)
      conditions.push(eq(productsTable.featured, featured));

    if (category) {
      const [cat] = await db
        .select({ id: mainCategoriesTable.id })
        .from(mainCategoriesTable)
        .where(eq(mainCategoriesTable.slug, category))
        .limit(1);
      if (cat) conditions.push(eq(productsTable.categoryId, cat.id));
      // If category not found, return empty results (conditions unsatisfiable)
      else conditions.push(eq(productsTable.id, -1));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const orderBy =
      sort === "price_asc"
        ? asc(productsTable.price)
        : sort === "price_desc"
          ? desc(productsTable.price)
          : sort === "rating"
            ? desc(productsTable.rating)
            : desc(productsTable.createdAt);

    const pageNum = page ?? 1;
    const pageSize = limit ?? 20;
    const offset = (pageNum - 1) * pageSize;

    const [products, countResult] = await Promise.all([
      db
        .select()
        .from(productsTable)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(where),
    ]);

    const catMap = await buildCategoryMap(products);
    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      products: products.map((p) => formatProduct(p, catMap.get(p.categoryId))),
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }),
);

// ── GET /api/products/:id ─────────────────────────────────────────────────
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = GetProductParams.safeParse(req.params);
    if (!parsed.success) {
      throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.id))
      .limit(1);

    if (!product) {
      throw new AppError(404, "Product not found", "NOT_FOUND");
    }

    const [cat] = await db
      .select({ name: mainCategoriesTable.name, slug: mainCategoriesTable.slug })
      .from(mainCategoriesTable)
      .where(eq(mainCategoriesTable.id, product.categoryId))
      .limit(1);

    res.json(formatProduct(product, cat));
  }),
);

// ── Strict write validation (replaces the permissive generated schema) ─────
const imageRef = z.string().trim().refine(isAllowedImageRef, "Image must be an https:// URL or an uploaded image");
const ProductWriteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  price: z.number().positive("Price must be greater than 0").max(10_000_000),
  originalPrice: z.number().positive().max(10_000_000).nullish(),
  categoryId: z.number().int().positive(),
  imageUrl: imageRef,
  images: z.array(imageRef).max(10, "At most 10 gallery images").optional(),
  stock: z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative").max(1_000_000),
  featured: z.boolean().optional(),
  artisan: z.string().trim().max(100).nullish(),
  origin: z.string().trim().max(100).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).refine((p) => p.originalPrice == null || p.originalPrice >= p.price, {
  message: "Original price cannot be lower than the selling price", path: ["originalPrice"],
});

async function assertCategoryExists(categoryId: number): Promise<void> {
  const [c] = await db.select({ id: mainCategoriesTable.id }).from(mainCategoriesTable).where(eq(mainCategoriesTable.id, categoryId)).limit(1);
  if (!c) throw new AppError(400, "Selected category does not exist", "VALIDATION_ERROR");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ── POST /api/products ────────────────────────────────────────────────────
router.post(
  "/",
  requirePermission("products"),
  asyncHandler(async (req, res) => {
    const parsed = ProductWriteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid product", "VALIDATION_ERROR");
    const { price, originalPrice, ...rest } = parsed.data;
    await assertCategoryExists(rest.categoryId);

    const product = await db.transaction(async (tx) => {
      const [created] = await tx.insert(productsTable).values({
        ...rest,
        slug: await uniqueSlug(rest.name),
        price: String(price),
        ...(originalPrice != null ? { originalPrice: String(originalPrice) } : {}),
      }).returning();
      if (created.stock > 0) await logMovement(tx, { productId: created.id, delta: created.stock, reason: "manual", note: "Initial stock", actor: "admin" });
      return created;
    });
    const [cat] = await db.select({ name: mainCategoriesTable.name, slug: mainCategoriesTable.slug }).from(mainCategoriesTable).where(eq(mainCategoriesTable.id, product.categoryId)).limit(1);

    logger.info({ productId: product.id, name: product.name }, "Product created");
    res.status(201).json(formatProduct(product, cat));
  }),
);

// ── PUT /api/products/:id ─────────────────────────────────────────────────
router.put(
  "/:id",
  requirePermission("products"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
    const parsed = ProductWriteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid product", "VALIDATION_ERROR");
    const { price, originalPrice, ...rest } = parsed.data;
    await assertCategoryExists(rest.categoryId);

    const product = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(productsTable).where(eq(productsTable.id, id)).for("update");
      if (!before) throw new AppError(404, "Product not found", "NOT_FOUND");
      const [updated] = await tx.update(productsTable).set({
        ...rest,
        price: String(price),
        originalPrice: originalPrice != null ? String(originalPrice) : null, // null clears it
        ...(before.slug ? {} : { slug: await uniqueSlug(rest.name) }),
      }).where(eq(productsTable.id, id)).returning();
      if (updated.stock !== before.stock) {
        await logMovement(tx, { productId: id, delta: updated.stock - before.stock, reason: "product_edit", actor: "admin" });
      }
      return updated;
    });
    const [cat] = await db.select({ name: mainCategoriesTable.name, slug: mainCategoriesTable.slug }).from(mainCategoriesTable).where(eq(mainCategoriesTable.id, product.categoryId)).limit(1);
    res.json(formatProduct(product, cat));
  }),
);

// ── DELETE /api/products/:id ──────────────────────────────────────────────
router.delete(
  "/:id",
  requirePermission("products"),
  asyncHandler(async (req, res) => {
    const parsed = DeleteProductParams.safeParse(req.params);
    if (!parsed.success) {
      throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
    }

    const [deleted] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, parsed.data.id))
      .returning({ id: productsTable.id });

    if (!deleted) {
      throw new AppError(404, "Product not found", "NOT_FOUND");
    }

    res.status(204).send();
  }),
);

export default router;
