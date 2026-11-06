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

// ── POST /api/products ────────────────────────────────────────────────────
router.post(
  "/",
  requirePermission("products"),
  asyncHandler(async (req, res) => {
    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    const { price, originalPrice, ...rest } = parsed.data;
const [product] = await db.insert(productsTable).values({
  ...rest,
  price: String(price),
  ...(originalPrice != null ? { originalPrice: String(originalPrice) } : {}),
}).returning();
    const [cat] = await db
      .select({ name: mainCategoriesTable.name, slug: mainCategoriesTable.slug })
      .from(mainCategoriesTable)
      .where(eq(mainCategoriesTable.id, product.categoryId))
      .limit(1);

    logger.info({ productId: product.id, name: product.name }, "Product created");
    res.status(201).json(formatProduct(product, cat));
  }),
);

// ── PUT /api/products/:id ─────────────────────────────────────────────────
router.put(
  "/:id",
  requirePermission("products"),
  asyncHandler(async (req, res) => {
    const paramsParsed = UpdateProductParams.safeParse(req.params);
    if (!paramsParsed.success) {
      throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
    }

    const bodyParsed = UpdateProductBody.safeParse(req.body);
    if (!bodyParsed.success) {
      throw new AppError(400, bodyParsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    const { price, originalPrice, ...restUpdate } = bodyParsed.data;
const updateData = {
  ...restUpdate,
  ...(price != null ? { price: String(price) } : {}),
  ...(originalPrice != null ? { originalPrice: String(originalPrice) } : {}),
};
const [product] = await db
  .update(productsTable)
  .set(updateData)
  .where(eq(productsTable.id, paramsParsed.data.id))
  .returning();

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
