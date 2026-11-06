import { Link, useLocation } from "wouter";
import {
  Menu, X, LayoutDashboard, Package, ShoppingBag, Tag, ArrowLeft, LogOut, Settings, BarChart3,
  Ticket, Shield, SlidersHorizontal, Image, Layout, Users, FileText, UserRound, Megaphone, Truck,
  Headphones, KeyRound, ScrollText, PanelLeftClose, PanelLeftOpen, ExternalLink,
} from "lucide-react";
import { adminLogout, getAdminEmail, isAdminLoggedIn } from "@/lib/admin-auth";
import { getStaffSession, hasPermission, staffLogout, ROLE_LABELS, type Permission } from "@/lib/staff-auth";
import { useEffect, useRef, useState, type ElementType } from "react";
import { usePersistedState } from "@/components/admin/ui";
import { T } from "@/components/admin/tokens";

/**
 * Sidebar navigation.
 * - `permission` is the staff Permission needed to see/open the page (master admin bypasses it).
 * - `soon: true` items have no page yet: they are shown (master admin only) as disabled, never as broken links.
 * - Security is still enforced server-side; this is only the UI layer.
 */
interface NavItem {
  href: string; label: string; icon: ElementType; permission: Permission;
  exact?: boolean; soon?: boolean; badge?: string;
}
interface NavGroup { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  { title: "Overview", items: [
    { href: "/admin",           label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics" },
    { href: "/admin/reports",   label: "Reports",   icon: FileText,  permission: "reports", soon: true },
  ]},
  { title: "Store Management", items: [
    { href: "/admin/products",   label: "Products",   icon: Package,     permission: "products" },
    { href: "/admin/categories", label: "Categories", icon: Tag,         permission: "categories" },
    { href: "/admin/orders",     label: "Orders",     icon: ShoppingBag, permission: "orders" },
    { href: "/admin/customers",  label: "Customers",  icon: UserRound,   permission: "orders", soon: true },
    { href: "/admin/coupons",    label: "Coupons",    icon: Ticket,      permission: "coupons" },
  ]},
  { title: "Store Customization", items: [
    { href: "/admin/slider",           label: "Hero Slider",      icon: SlidersHorizontal, permission: "slider" },
    { href: "/admin/banners",          label: "Page Banners",     icon: Image,  permission: "banners" },
    { href: "/admin/category-banners", label: "Category Banners", icon: Layout, permission: "banners" },
  ]},
  { title: "Marketing", items: [
    { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns", soon: true },
  ]},
  { title: "Operations", items: [
    { href: "/admin/delivery", label: "Delivery", icon: Truck,      permission: "delivery", soon: true },
    { href: "/admin/support",  label: "Support",  icon: Headphones, permission: "support_tickets", soon: true },
  ]},
  { title: "Team Management", items: [
    { href: "/admin/staff",              label: "Staff Management", icon: Users,      permission: "staff" },
    { href: "/admin/permissions",        label: "Permissions",      icon: KeyRound,   permission: "staff", soon: true },
    { href: "/admin/staff#activity",     label: "Activity Logs",    icon: ScrollText, permission: "staff" },
  ]},
  { title: "System", items: [
    { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings" },
    { href: "/admin/security", label: "Security", icon: Shield,   permission: "security" },
  ]},
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items).filter(i => !i.soon);
const pathOf = (href: string) => href.split("#")[0];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedState("ab_admin_sidebar_collapsed", false);
  const [hash, setHash] = useState(typeof window !== "undefined" ? window.location.hash : "");

  useEffect(() => { setMenuOpen(false); setHash(window.location.hash); }, [location]);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // Lock body scroll + Esc-to-close while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const isMasterAdmin = isAdminLoggedIn();
  const staffSession  = !isMasterAdmin ? getStaffSession() : null;

  // Permission required by the current page (matched by path, ignoring #hash).
  const currentNavItem = ALL_ITEMS.find(item =>
    item.exact ? location === item.href : location.startsWith(pathOf(item.href))
  );

  useEffect(() => {
    if (isMasterAdmin) {
      const reset = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => { adminLogout(); navigate("/admin/login"); }, 30 * 60 * 1000);
      };
      reset();
      window.addEventListener("mousemove", reset);
      window.addEventListener("keydown", reset);
      window.addEventListener("click", reset);
      return () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        window.removeEventListener("mousemove", reset);
        window.removeEventListener("keydown", reset);
        window.removeEventListener("click", reset);
      };
    }
    if (!staffSession) { navigate("/admin/login"); return undefined; }
    const requiredPermission = currentNavItem?.permission ?? "dashboard";
    if (!hasPermission(requiredPermission)) { navigate("/staff/dashboard"); return undefined; }
    return undefined;
  }, [location, isMasterAdmin, staffSession?.staffId]);

  if (!isMasterAdmin) {
    if (!staffSession) return null;
    const requiredPermission = currentNavItem?.permission ?? "dashboard";
    if (!hasPermission(requiredPermission)) return null;
  }

  function handleLogout() {
    if (isMasterAdmin) { adminLogout(); navigate("/admin/login"); }
    else { staffLogout(); navigate("/staff/login"); }
  }

  // Staff only ever see sections their permissions cover; "soon" placeholders are master-admin only.
  const groups = NAV_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(i => isMasterAdmin ? true : (!i.soon && hasPermission(i.permission))),
    }))
    .filter(g => g.items.length > 0);

  const isActive = (item: NavItem) => {
    if (item.soon) return false;
    if (item.href.includes("#")) return location === pathOf(item.href) && hash === "#" + item.href.split("#")[1];
    if (item.exact) return location === item.href;
    // "Staff Management" is active on /admin/staff unless the Activity Logs tab is selected
    if (item.href === "/admin/staff") return location.startsWith("/admin/staff") && hash !== "#activity";
    return location.startsWith(item.href);
  };

  const who = isMasterAdmin ? (getAdminEmail() ?? "Admin") : (staffSession?.name ?? "Staff");
  const roleLabel = isMasterAdmin ? "Master Admin" : (staffSession ? ROLE_LABELS[staffSession.role] : "Staff");
  const initial = who.charAt(0).toUpperCase();
  const pageTitle = [...ALL_ITEMS].reverse().find(i => isActive(i))?.label ?? currentNavItem?.label ?? "Admin";

  function go(item: NavItem, e: React.MouseEvent) {
    if (!item.href.includes("#")) return;
    // wouter doesn't emit hashchange on pushState, so notify the page ourselves.
    e.preventDefault();
    navigate(item.href);
    window.setTimeout(() => window.dispatchEvent(new Event("hashchange")), 0);
  }

  const SidebarBody = ({ compact }: { compact: boolean }) => (
    <>
      <div className={`flex items-center gap-2.5 h-14 px-3 border-b ${compact ? "justify-center" : ""}`} style={{ borderColor: T.border }}>
        <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        {!compact && (
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-neutral-900 truncate">ApunBazar</p>
            <p className="text-[11px] text-neutral-500 truncate">{roleLabel}</p>
          </div>
        )}
        <button onClick={() => setMenuOpen(false)} aria-label="Close menu"
          className="lg:hidden ml-auto h-10 w-10 -mr-2 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-4" aria-label="Admin navigation">
        {groups.map(group => (
          <div key={group.title}>
            {!compact
              ? <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{group.title}</p>
              : <div className="mx-2 mb-1 border-t" style={{ borderColor: T.border }} />}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item);
                const base = `group relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors min-h-[40px] ${compact ? "justify-center px-0" : "px-2.5"}`;
                const inner = (
                  <>
                    <item.icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    {!compact && <span className="flex-1 truncate">{item.label}</span>}
                    {!compact && item.soon && <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-400">Soon</span>}
                  </>
                );
                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <div className={`${base} text-neutral-300 cursor-not-allowed`} title={`${item.label} — coming soon`} aria-disabled="true">{inner}</div>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={(e: React.MouseEvent) => go(item, e)}
                      title={compact ? item.label : undefined} aria-current={active ? "page" : undefined}
                      className={`${base} ${active ? "text-[color:var(--ab-brand)]" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
                      style={active ? { background: T.brandSoft, ["--ab-brand" as any]: T.brand } : undefined}>
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: T.brand }} />}
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {isMasterAdmin && (
          <div>
            <div className="mx-2 mb-1 border-t" style={{ borderColor: T.border }} />
            <Link href="/staff/login"
              className={`flex items-center gap-3 rounded-lg text-[13px] font-medium min-h-[40px] text-neutral-600 hover:bg-neutral-100 ${compact ? "justify-center" : "px-2.5"}`}
              title={compact ? "Staff Portal" : undefined}>
              <ExternalLink className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
              {!compact && <span className="flex-1 truncate">Staff Portal</span>}
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t p-2 space-y-0.5" style={{ borderColor: T.border }}>
        <Link href="/" title={compact ? "Back to Store" : undefined}
          className={`flex items-center gap-3 rounded-lg text-[13px] font-medium min-h-[40px] text-neutral-600 hover:bg-neutral-100 ${compact ? "justify-center" : "px-2.5"}`}>
          <ArrowLeft className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
          {!compact && <span>Back to Store</span>}
        </Link>
        <button onClick={handleLogout} title={compact ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-[13px] font-medium min-h-[40px] text-rose-600 hover:bg-rose-50 ${compact ? "justify-center" : "px-2.5"}`}>
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
          {!compact && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="ab-admin flex min-h-[100dvh]" style={{ background: T.surface }}>
      {/* Mobile overlay */}
      <div onClick={() => setMenuOpen(false)} aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-neutral-900/40 backdrop-blur-[1px] lg:hidden transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} />

      {/* Mobile drawer */}
      <aside role="dialog" aria-modal="true" aria-label="Navigation menu" aria-hidden={!menuOpen}
        className={`fixed inset-y-0 left-0 z-[61] w-[280px] max-w-[86vw] flex flex-col bg-[#fbfaf7] border-r shadow-2xl lg:hidden transition-transform duration-250 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ borderColor: T.border, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <SidebarBody compact={false} />
      </aside>

      {/* Desktop sidebar (collapsible) */}
      <aside className={`hidden lg:flex flex-col sticky top-0 h-[100dvh] flex-shrink-0 bg-[#fbfaf7] border-r transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-60"}`}
        style={{ borderColor: T.border }}>
        <SidebarBody compact={collapsed} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky header (mobile + desktop) */}
        <header className="sticky top-0 z-40 flex items-center gap-2 h-14 px-3 sm:px-5 bg-white/90 backdrop-blur border-b"
          style={{ borderColor: T.border, paddingTop: "env(safe-area-inset-top)" }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu"
            className="lg:hidden h-10 w-10 -ml-1.5 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100">
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
          <h1 className="text-[15px] font-semibold tracking-tight text-neutral-900 truncate">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <div className="hidden sm:block text-right leading-tight min-w-0">
              <p className="text-xs font-medium text-neutral-800 truncate max-w-[180px]">{who}</p>
              <p className="text-[11px] text-neutral-500">{roleLabel}</p>
            </div>
            <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: T.brand }}>{initial}</span>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
