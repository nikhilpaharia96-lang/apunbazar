/**
 * routes/staff.ts — Staff login + staff management (database backed)
 *
 * POST   /api/staff/login   public (rate limited)
 * GET    /api/staff         admin / staff-manager
 * POST   /api/staff         admin / staff-manager
 * PATCH  /api/staff/:id     admin / staff-manager
 * DELETE /api/staff/:id     admin / staff-manager
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, pool, staffTable, type StaffRow } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../app";
import { authLimiter, requirePermission, signStaffToken } from "../middleware/admin-auth";

const router = Router();

const ROLES = ["admin", "manager", "delivery", "marketing", "support", "custom"] as const;
const PERMS = [
  "dashboard","products","categories","orders","analytics","coupons","settings",
  "security","slider","banners","staff","delivery","campaigns","support_tickets","reports",
] as const;

// Same as the frontend ROLE_PERMISSIONS — a staff member can never exceed their role
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: PERMS,
  admin: ["dashboard","products","categories","orders","analytics","coupons","settings","slider","banners","staff","delivery","campaigns","support_tickets","reports"],
  manager: ["dashboard","products","categories","orders","analytics","coupons","reports","delivery"],
  delivery: ["dashboard","orders","delivery"],
  marketing: ["dashboard","campaigns","banners","slider","analytics","coupons"],
  support: ["dashboard","orders","support_tickets"],
  custom: ["dashboard"],
};

// Table is created automatically on first use — no manual migration needed
let tableReady: Promise<unknown> | null = null;
function ensureTable() {
  tableReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS staff_members (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL DEFAULT '',
      role text NOT NULL,
      permissions text NOT NULL DEFAULT '[]',
      department text NOT NULL DEFAULT '',
      whatsapp_number text,
      password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      is_blocked boolean NOT NULL DEFAULT false,
      created_by text NOT NULL DEFAULT 'admin',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_login timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS staff_email_idx ON staff_members (email);
  `).catch((e) => { tableReady = null; throw e; });
  return tableReady;
}

const normEmail = (e: string) => e.trim().toLowerCase();

function publicStaff(r: StaffRow) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role,
    permissions: JSON.parse(r.permissions || "[]") as string[],
    department: r.department, whatsappNumber: r.whatsappNumber ?? undefined,
    isActive: r.isActive, isBlocked: r.isBlocked, createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(), lastLogin: r.lastLogin?.toISOString(),
  };
}

function safePerms(role: string, perms: string[]) {
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return perms.filter((p) => allowed.includes(p));
}

// ── Login ──────────────────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = z.object({ email: z.string().min(3), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "Email and password required", "VALIDATION_ERROR");
    await ensureTable();

    const [row] = await db.select().from(staffTable).where(eq(staffTable.email, normEmail(parsed.data.email)));
    // Always run bcrypt so response time doesn't reveal whether the email exists
    const ok = await bcrypt.compare(
      parsed.data.password,
      row?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi",
    );
    if (!row || !ok) throw new AppError(401, "Invalid credentials", "AUTH_FAILED");
    if (row.isBlocked || !row.isActive) throw new AppError(403, "Your account is blocked or inactive. Contact admin.", "ACCOUNT_DISABLED");

    await db.update(staffTable).set({ lastLogin: new Date() }).where(eq(staffTable.id, row.id));
    const member = publicStaff(row);
    const permissions = safePerms(member.role, member.permissions);
    const token = signStaffToken(row.id, row.role, permissions);
    res.json({ token, member: { ...member, permissions } });
  }),
);

// ── Management (admin or staff with "staff" permission) ────────────────────
// Live DB check: blocked/deactivated staff or revoked permissions lose access immediately
router.use(requirePermission("staff"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    await ensureTable();
    const rows = await db.select().from(staffTable);
    res.json(rows.map(publicStaff));
  }),
);

const BaseSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().default(""),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMS)).default([]),
  department: z.string().default(""),
  whatsappNumber: z.string().optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    await ensureTable();
    const parsed = BaseSchema.extend({ password: z.string().min(6, "Password must be at least 6 characters") }).safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    const d = parsed.data;
    const email = normEmail(d.email);

    const [dup] = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.email, email));
    if (dup) throw new AppError(409, "Email already exists", "DUPLICATE");

    const [row] = await db.insert(staffTable).values({
      id: `staff_${Date.now()}`,
      name: d.name, email, phone: d.phone, role: d.role, department: d.department,
      whatsappNumber: d.whatsappNumber || null,
      permissions: JSON.stringify(safePerms(d.role, d.permissions)),
      passwordHash: await bcrypt.hash(d.password, 12),
    }).returning();
    res.status(201).json(publicStaff(row));
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await ensureTable();
    const id = String(req.params.id);
    const parsed = BaseSchema.partial().extend({
      password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
      isActive: z.boolean().optional(),
      isBlocked: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    const d = parsed.data;

    const [current] = await db.select().from(staffTable).where(eq(staffTable.id, id));
    if (!current) throw new AppError(404, "Staff member not found", "NOT_FOUND");

    const updates: Partial<typeof staffTable.$inferInsert> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.department !== undefined) updates.department = d.department;
    if (d.whatsappNumber !== undefined) updates.whatsappNumber = d.whatsappNumber || null;
    if (d.isActive !== undefined) updates.isActive = d.isActive;
    if (d.isBlocked !== undefined) updates.isBlocked = d.isBlocked;
    if (d.password) updates.passwordHash = await bcrypt.hash(d.password, 12);
    if (d.email !== undefined) {
      const email = normEmail(d.email);
      const [dup] = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.email, email));
      if (dup && dup.id !== id) throw new AppError(409, "Email already exists", "DUPLICATE");
      updates.email = email;
    }
    const role = d.role ?? current.role;
    if (d.role !== undefined || d.permissions !== undefined) {
      const base = d.permissions ?? (d.role && d.role !== current.role ? [...(ROLE_PERMISSIONS[role] ?? [])] : JSON.parse(current.permissions));
      updates.role = role;
      updates.permissions = JSON.stringify(safePerms(role, base));
    }

    const [row] = Object.keys(updates).length
      ? await db.update(staffTable).set(updates).where(eq(staffTable.id, id)).returning()
      : [current];
    res.json(publicStaff(row));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await ensureTable();
    await db.delete(staffTable).where(eq(staffTable.id, String(req.params.id)));
    res.json({ success: true });
  }),
);

export default router;
