import { useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import {
  getStaffSession, staffLogout, hasPermission, ROLE_LABELS, ROLE_COLORS, ROLE_DESCRIPTIONS,
  PERMISSION_LABELS, loadActivities, type Permission,
} from "@/lib/staff-auth";
import {
  LogOut, Package, ShoppingBag, BarChart3, Truck, Users, Image, SlidersHorizontal, Ticket, Settings,
  Shield, Tag, Megaphone, Headphones, FileText, Clock, Lock, ArrowUpRight, Mail, LogIn, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { DashboardCard, EmptyState, PermissionBadge } from "@/components/admin/ui";
import { T } from "@/components/admin/tokens";

/**
 * Every module a staff member could have. `p` is the module's own permission;
 * `target` is the permission of the admin page the card opens (the admin layout
 * enforces it, and the API enforces it again server-side). A card is only
 * "accessible" when BOTH are granted, so staff never click into a bounce.
 */
interface Module { p: Permission; target: Permission; label: string; icon: LucideIcon; href: string; desc: string }
const MODULES: Module[] = [
  { p: "orders",          target: "orders",     label: "Orders",      icon: ShoppingBag,       href: "/admin/orders",     desc: "View and manage orders" },
  { p: "products",        target: "products",   label: "Products",    icon: Package,           href: "/admin/products",   desc: "Add and edit products" },
  { p: "categories",      target: "categories", label: "Categories",  icon: Tag,               href: "/admin/categories", desc: "Organise the catalogue" },
  { p: "delivery",        target: "orders",     label: "Delivery",    icon: Truck,             href: "/admin/orders",     desc: "Track deliveries" },
  { p: "support_tickets", target: "orders",     label: "Support",     icon: Headphones,        href: "/admin/orders",     desc: "Help customers with orders" },
  { p: "analytics",       target: "analytics",  label: "Analytics",   icon: BarChart3,         href: "/admin/analytics",  desc: "Sales and traffic insights" },
  { p: "reports",         target: "analytics",  label: "Reports",     icon: FileText,          href: "/admin/analytics",  desc: "Business reports" },
  { p: "coupons",         target: "coupons",    label: "Coupons",     icon: Ticket,            href: "/admin/coupons",    desc: "Discount codes" },
  { p: "slider",          target: "slider",     label: "Hero Slider", icon: SlidersHorizontal, href: "/admin/slider",     desc: "Homepage slider" },
  { p: "banners",         target: "banners",    label: "Banners",     icon: Image,             href: "/admin/banners",    desc: "Page and category banners" },
  { p: "campaigns",       target: "banners",    label: "Campaigns",   icon: Megaphone,         href: "/admin/banners",    desc: "Marketing campaigns" },
  { p: "staff",           target: "staff",      label: "Staff",       icon: Users,             href: "/admin/staff",      desc: "Manage team members" },
  { p: "settings",        target: "settings",   label: "Settings",    icon: Settings,          href: "/admin/settings",   desc: "Store settings" },
  { p: "security",        target: "security",   label: "Security",    icon: Shield,            href: "/admin/security",   desc: "Security controls" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function StaffDashboard() {
  const [, navigate] = useLocation();
  const session = getStaffSession();

  useEffect(() => { if (!session) navigate("/staff/login"); }, []);

  const activities = useMemo(
    () => (session ? loadActivities().filter(a => a.staffId === session.staffId).slice(0, 6) : []),
    [session?.staffId],
  );

  if (!session) return null;

  const accessible = MODULES.filter(m => hasPermission(m.p) && hasPermission(m.target));
  const restricted = MODULES.filter(m => !(hasPermission(m.p) && hasPermission(m.target)));
  const roleColor = ROLE_COLORS[session.role];
  const firstName = session.name.split(" ")[0];

  return (
    <div className="ab-admin min-h-[100dvh]" style={{ background: T.surface }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b" style={{ borderColor: T.border, paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-3.5 sm:px-5 h-14 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-neutral-900">ApunBazar</p>
            <p className="text-[11px] text-neutral-500">Staff Portal</p>
          </div>
          <button onClick={() => { staffLogout(); navigate("/staff/login"); }}
            className="ml-auto inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-[13px] font-medium text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition">
            <LogOut className="h-4 w-4" /> <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3.5 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Welcome + profile */}
        <section className="rounded-2xl p-4 sm:p-6 bg-white border" style={{ borderColor: T.border, boxShadow: T.shadow }}>
          <div className="flex items-start gap-3.5">
            <span className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-lg font-semibold text-white flex-shrink-0" style={{ background: roleColor }}>
              {session.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">{greeting()}</p>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-neutral-900 truncate">Namaste, {firstName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold" style={{ background: `${roleColor}14`, color: roleColor }}>
                  <ShieldCheck className="h-3 w-3" />{ROLE_LABELS[session.role]}
                </span>
                <span className="text-xs text-neutral-500">{ROLE_DESCRIPTIONS[session.role]}</span>
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 min-w-0">
              <Mail className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <div className="min-w-0"><dt className="text-neutral-400">Email</dt><dd className="font-medium text-neutral-800 truncate">{session.email}</dd></div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 min-w-0">
              <LogIn className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <div className="min-w-0"><dt className="text-neutral-400">Signed in</dt>
                <dd className="font-medium text-neutral-800 truncate">{new Date(session.loginTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</dd></div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 min-w-0">
              <ShieldCheck className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <div className="min-w-0"><dt className="text-neutral-400">Access</dt>
                <dd className="font-medium text-neutral-800">{accessible.length} open · {restricted.length} restricted</dd></div>
            </div>
          </dl>
        </section>

        {/* Quick access */}
        <section aria-labelledby="qa">
          <h2 id="qa" className="text-sm font-semibold text-neutral-900 mb-2.5">Quick access</h2>
          {accessible.length === 0 ? (
            <DashboardCard>
              <EmptyState icon={Lock} title="No modules assigned yet" description="Ask your admin to grant you access to the sections you need." />
            </DashboardCard>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {accessible.map(m => (
                <Link key={m.p} href={m.href}
                  className="group relative block rounded-xl bg-white border p-3.5 sm:p-4 min-w-0 transition-all hover:-translate-y-0.5 hover:border-neutral-300 active:scale-[0.98]"
                  style={{ borderColor: T.border, boxShadow: T.shadow }}>
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center mb-3" style={{ background: T.brandSoft, color: T.brand }}><m.icon className="h-[18px] w-[18px]" /></span>
                  <ArrowUpRight className="absolute top-3.5 right-3.5 h-4 w-4 text-neutral-300 group-hover:text-neutral-600 transition-colors" />
                  <p className="text-sm font-semibold text-neutral-900 truncate">{m.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{m.desc}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Permissions */}
        <DashboardCard title="Your permissions" subtitle="What your role lets you do">
          <div className="flex flex-wrap gap-1.5">
            {session.permissions.length === 0
              ? <p className="text-xs text-neutral-500">No permissions assigned.</p>
              : session.permissions.map(p => <PermissionBadge key={p} label={PERMISSION_LABELS[p]} color={roleColor} />)}
          </div>
        </DashboardCard>

        {/* Restricted */}
        {restricted.length > 0 && (
          <details className="group rounded-xl border bg-white/60" style={{ borderColor: T.border }}>
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 min-h-[48px] text-sm font-semibold text-neutral-600 [&::-webkit-details-marker]:hidden">
              <Lock className="h-3.5 w-3.5" /> Restricted modules ({restricted.length})
              <span className="ml-auto text-xs font-normal text-neutral-400 group-open:hidden">Show</span>
              <span className="ml-auto text-xs font-normal text-neutral-400 hidden group-open:inline">Hide</span>
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 p-3 pt-0">
              {restricted.map(m => (
                <div key={m.p} aria-disabled="true" className="rounded-xl border border-dashed bg-white/60 p-3.5 min-w-0 select-none" style={{ borderColor: "#d8d5cd" }}>
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center mb-3 bg-neutral-100 text-neutral-400"><Lock className="h-4 w-4" /></span>
                  <p className="text-sm font-medium text-neutral-400 truncate">{m.label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Ask admin for access</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Activity */}
        <DashboardCard title="Recent activity" subtitle="Your latest actions on this device">
          {activities.length === 0 ? (
            <EmptyState icon={Clock} title="No activity yet" description="Your actions will be listed here." compact />
          ) : (
            <ul className="divide-y divide-neutral-100 -my-2">
              {activities.map(a => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 flex-shrink-0">{a.action}</span>
                  <span className="text-[13px] text-neutral-700 flex-1 min-w-0 truncate">{a.details}</span>
                  <span className="text-[11px] text-neutral-400 flex-shrink-0">
                    {new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </main>
    </div>
  );
}
