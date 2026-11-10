/**
 * routes/customers.ts — Customer accounts
 *   POST  /api/customers/register   create account → token
 *   POST  /api/customers/login      email + password → token
 *   GET   /api/customers/me         profile
 *   PATCH /api/customers/me         update name/phone/saved address
 *   GET   /api/customers/me/orders  order history
 *
 * Emails are not verified, so order history requires the order's email AND phone to match the
 * account (the same two-factor rule as public order tracking) — registering with someone else's
 * email does not expose their orders.
 */
import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, customersTable, ordersTable, type Customer } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { authLimiter } from "../middleware/admin-auth";

const router = Router();
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

const secret = () => {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 32) throw new AppError(500, "Server auth is not configured", "CONFIG_ERROR");
  return s;
};
const sign = (c: Customer) => jwt.sign({ sub: String(c.id), typ: "customer" }, secret(), { expiresIn: "14d", issuer: "apunbazar-api" });
const digits10 = (v: string) => v.replace(/\D/g, "").slice(-10);
const issue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid request";

const profile = (c: Customer) => ({
  id: c.id, email: c.email, name: c.name, phone: c.phone,
  address: c.address, city: c.city, state: c.state, pincode: c.pincode,
});

async function requireCustomer(req: Request): Promise<Customer> {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) throw new AppError(401, "Please log in to continue.", "AUTH_MISSING");
  let payload: { sub?: string; typ?: string };
  try {
    payload = jwt.verify(h.slice(7), secret(), { issuer: "apunbazar-api" }) as { sub?: string; typ?: string };
  } catch {
    throw new AppError(401, "Your session has expired. Please log in again.", "AUTH_INVALID");
  }
  if (payload.typ !== "customer" || !payload.sub) throw new AppError(401, "Please log in to continue.", "AUTH_INVALID");
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, Number(payload.sub)));
  if (!c) throw new AppError(401, "Please log in again.", "AUTH_INVALID");
  return c;
}

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  phone: z.string().trim().transform(digits10).refine((p) => /^[6-9]\d{9}$/.test(p), "Enter a valid 10-digit mobile number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
  const p = RegisterSchema.safeParse(req.body);
  if (!p.success) throw new AppError(400, issue(p.error), "VALIDATION_ERROR");
  const passwordHash = await bcrypt.hash(p.data.password, ROUNDS);
  try {
    const [c] = await db.insert(customersTable).values({ name: p.data.name, email: p.data.email, phone: p.data.phone, passwordHash, lastLoginAt: new Date() }).returning();
    res.status(201).json({ token: sign(c), customer: profile(c) });
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    // Drizzle wraps the driver error, so the Postgres code may be on .cause
    if (e.code === "23505" || e.cause?.code === "23505") throw new AppError(409, "An account with this email already exists. Please log in.", "DUPLICATE");
    throw err;
  }
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const p = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!p.success) throw new AppError(400, "Enter your email and password", "VALIDATION_ERROR");
  const [c] = await db.select().from(customersTable).where(eq(customersTable.email, p.data.email));
  const ok = await bcrypt.compare(p.data.password, c?.passwordHash ?? DUMMY_HASH);
  if (!c || !ok) throw new AppError(401, "Invalid email or password", "AUTH_INVALID");
  await db.update(customersTable).set({ lastLoginAt: new Date() }).where(eq(customersTable.id, c.id));
  res.json({ token: sign(c), customer: profile(c) });
}));

router.get("/me", asyncHandler(async (req, res) => { res.json(profile(await requireCustomer(req))); }));

const UpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().transform(digits10).refine((p) => /^[6-9]\d{9}$/.test(p), "Enter a valid 10-digit mobile number").optional(),
  address: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(100).nullish(),
  state: z.string().trim().max(100).nullish(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Invalid pincode").nullish().or(z.literal("")),
});

router.patch("/me", asyncHandler(async (req, res) => {
  const c = await requireCustomer(req);
  const p = UpdateSchema.safeParse(req.body);
  if (!p.success) throw new AppError(400, issue(p.error), "VALIDATION_ERROR");
  const set: Partial<typeof customersTable.$inferInsert> = {};
  for (const [k, v] of Object.entries(p.data)) if (v !== undefined) (set as Record<string, unknown>)[k] = v === "" ? null : v;
  if (!Object.keys(set).length) throw new AppError(400, "Nothing to update", "VALIDATION_ERROR");
  const [u] = await db.update(customersTable).set(set).where(eq(customersTable.id, c.id)).returning();
  res.json(profile(u));
}));

router.get("/me/orders", asyncHandler(async (req, res) => {
  const c = await requireCustomer(req);
  const rows = await db.select().from(ordersTable)
    .where(and(
      eq(sql`lower(${ordersTable.customerEmail})`, c.email),
      sql`right(regexp_replace(${ordersTable.customerPhone}, '\D', '', 'g'), 10) = ${c.phone}`,
    ))
    .orderBy(desc(ordersTable.createdAt)).limit(100);
  res.json({
    orders: rows.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, total: Number(o.total), status: o.status, paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus, createdAt: o.createdAt.toISOString(), itemCount: (o.items as unknown[]).length,
    })),
  });
}));

export default router;
