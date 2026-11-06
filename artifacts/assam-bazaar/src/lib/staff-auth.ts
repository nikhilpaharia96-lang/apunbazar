import { getAuthHeaders, isAdminLoggedIn } from "@/lib/admin-auth";

/**
 * staff-auth.ts — Role-Based Access Control (RBAC)
 * Staff sirf apne assigned permissions wale sections hi dekh sakta hai
 */

export type StaffRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "delivery"
  | "marketing"
  | "support"
  | "custom";

export type Permission =
  | "dashboard"
  | "products"
  | "categories"
  | "orders"
  | "analytics"
  | "coupons"
  | "settings"
  | "security"
  | "slider"
  | "banners"
  | "staff"
  | "delivery"
  | "campaigns"
  | "support_tickets"
  | "reports";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  permissions: Permission[];
  avatar?: string;
  department: string;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  lastLogin?: string;
  createdBy: string;
  whatsappNumber?: string;
  /** Only used in forms (set/change). Server never returns it. */
  password?: string;
}

export interface StaffActivity {
  id: string;
  staffId: string;
  staffName: string;
  action: string;
  details: string;
  page: string;
  timestamp: string;
}

export interface StaffSession {
  staffId: string;
  role: StaffRole;
  permissions: Permission[];
  name: string;
  email: string;
  loginTime: string;
  /** API token for staff-management calls */
  token?: string;
}

// ── Role Permissions — clearly defined, limited by role ──────────────────────
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  // Super Admin — sab kuch
  super_admin: [
    "dashboard","products","categories","orders","analytics",
    "coupons","settings","security","slider","banners",
    "staff","delivery","campaigns","support_tickets","reports",
  ],
  // Admin — security aur staff management nahi
  admin: [
    "dashboard","products","categories","orders","analytics",
    "coupons","settings","slider","banners","staff",
    "delivery","campaigns","support_tickets","reports",
  ],
  // Manager — operations manage karo, settings/security nahi
  manager: [
    "dashboard","products","categories","orders",
    "analytics","coupons","reports","delivery",
  ],
  // Delivery — sirf orders aur delivery
  delivery: [
    "dashboard","orders","delivery",
  ],
  // Marketing — content aur promotions
  marketing: [
    "dashboard","campaigns","banners","slider","analytics","coupons",
  ],
  // Support — sirf orders aur tickets
  support: [
    "dashboard","orders","support_tickets",
  ],
  // Custom — sirf dashboard, admin manually assign karega
  custom: [
    "dashboard",
  ],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
  manager:     "Manager",
  delivery:    "Delivery Staff",
  marketing:   "Marketing",
  support:     "Support",
  custom:      "Custom",
};

export const ROLE_COLORS: Record<StaffRole, string> = {
  super_admin: "#7c3aed",
  admin:       "#1a5c2a",
  manager:     "#0369a1",
  delivery:    "#c2410c",
  marketing:   "#be185d",
  support:     "#0f766e",
  custom:      "#6b7280",
};

// Role description — kya kar sakta hai
export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  super_admin: "Sab kuch — koi restriction nahi",
  admin:       "Almost sab kuch — security page nahi",
  manager:     "Products, categories, orders, analytics",
  delivery:    "Sirf orders aur delivery status",
  marketing:   "Banners, campaigns, coupons, analytics",
  support:     "Orders dekhna aur support tickets",
  custom:      "Admin manually permissions assign karega",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard:       "Dashboard",
  products:        "Products",
  categories:      "Categories",
  orders:          "Orders",
  analytics:       "Analytics",
  coupons:         "Coupons",
  settings:        "Settings",
  security:        "Security",
  slider:          "Hero Slider",
  banners:         "Banners",
  staff:           "Staff Mgmt",
  delivery:        "Delivery",
  campaigns:       "Campaigns",
  support_tickets: "Support",
  reports:         "Reports",
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Core", permissions: ["dashboard", "orders", "products", "categories"] },
  { label: "Content", permissions: ["slider", "banners", "campaigns"] },
  { label: "Business", permissions: ["analytics", "reports", "coupons"] },
  { label: "Operations", permissions: ["delivery", "support_tickets"] },
  { label: "Admin Only", permissions: ["settings", "security", "staff"] },
];

// ── Storage keys ──────────────────────────────────────────────────────────────
const SK = {
  session:    "apunbazar_staff_session",
  activities: "apunbazar_staff_activities",
  attendance: "apunbazar_staff_attendance",
};

// ── API helpers ───────────────────────────────────────────────────────────────
// Staff ab database mein save hota hai (har device se login chalega)
const API_URL = import.meta.env.VITE_API_URL || "https://apunbazar.onrender.com";

function authHeaders(): Record<string, string> {
  if (isAdminLoggedIn()) return getAuthHeaders();
  const t = getStaffSession()?.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/staff${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(auth ? authHeaders() : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new Error("Could not connect to server. Please try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || "Request failed");
  return body as T;
}

// ── CRUD (admin ya "staff" permission wale staff ke liye) ─────────────────────
export function fetchStaff(): Promise<StaffMember[]> {
  return api<StaffMember[]>("");
}

export function addStaffMember(
  member: Omit<StaffMember, "id" | "createdAt">,
): Promise<StaffMember> {
  return api<StaffMember>("", { method: "POST", body: JSON.stringify(member) });
}

export function updateStaffMember(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
  return api<StaffMember>(`/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export function deleteStaffMember(id: string): Promise<{ success: boolean }> {
  return api(`/${id}`, { method: "DELETE" });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function staffLogin(
  email: string,
  password: string,
): Promise<{ ok: true; member: StaffMember } | { ok: false; error: string }> {
  try {
    const { token, member } = await api<{ token: string; member: StaffMember }>(
      "/login",
      { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) },
      false,
    );
    const session: StaffSession = {
      staffId:     member.id,
      role:        member.role,
      permissions: member.permissions.filter(p => ROLE_PERMISSIONS[member.role].includes(p)),
      name:        member.name,
      email:       member.email,
      loginTime:   new Date().toISOString(),
      token,
    };
    localStorage.setItem(SK.session, JSON.stringify(session));
    logActivity(member.id, member.name, "LOGIN", "Staff logged in", "login");
    logAttendance(member.id);
    return { ok: true, member };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login failed" };
  }
}

export function staffLogout(): void {
  const s = getStaffSession();
  if (s) logActivity(s.staffId, s.name, "LOGOUT", "Staff logged out", "logout");
  localStorage.removeItem(SK.session);
}

export function getStaffSession(): StaffSession | null {
  try {
    const s = localStorage.getItem(SK.session);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function isStaffLoggedIn(): boolean {
  return !!getStaffSession();
}

// Permission check — session mein hai ya nahi
export function hasPermission(permission: Permission): boolean {
  const session = getStaffSession();
  if (!session) return false;
  // Super admin always has all permissions
  if (session.role === "super_admin") return true;
  return session.permissions.includes(permission);
}

// Check multiple permissions (any one)
export function hasAnyPermission(...permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(p));
}

// Check multiple permissions (all required)
export function hasAllPermissions(...permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(p));
}

// ── Activity Log ──────────────────────────────────────────────────────────────
export function loadActivities(): StaffActivity[] {
  try {
    const s = localStorage.getItem(SK.activities);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function logActivity(
  staffId: string, staffName: string,
  action: string, details: string, page: string
): void {
  const activities = loadActivities();
  const entry: StaffActivity = {
    id: `act_${Date.now()}`,
    staffId, staffName, action, details, page,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(SK.activities, JSON.stringify([entry, ...activities].slice(0, 500)));
}

// ── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  staffId: string; date: string; loginTime: string;
  logoutTime?: string; hoursWorked?: number;
  status: "present" | "absent" | "half_day";
}

export function logAttendance(staffId: string): void {
  const today = new Date().toISOString().split("T")[0];
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(SK.attendance) || "[]");
  if (!records.find(r => r.staffId === staffId && r.date === today)) {
    records.push({ staffId, date: today, loginTime: new Date().toISOString(), status: "present" });
    localStorage.setItem(SK.attendance, JSON.stringify(records));
  }
}

export function loadAttendance(): AttendanceRecord[] {
  try { return JSON.parse(localStorage.getItem(SK.attendance) || "[]"); }
  catch { return []; }
}
