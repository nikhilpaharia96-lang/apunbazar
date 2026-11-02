import { Link, useLocation } from "wouter";
import { Menu, X, LayoutDashboard, Package, ShoppingBag, Tag, ArrowLeft, LogOut, User, Settings, BarChart3, Ticket, Shield, SlidersHorizontal, Image, Layout, Users } from "lucide-react";
import { adminLogout, getAdminEmail, isAdminLoggedIn } from "@/lib/admin-auth";
import { getStaffSession, hasPermission, staffLogout, type Permission } from "@/lib/staff-auth";
import { useEffect, useRef, useState } from "react";

// Each nav item is tagged with the staff Permission required to view it.
// Master admin (isAdminLoggedIn) always bypasses this and sees everything.
const navItems: { href: string; label: string; icon: any; exact?: boolean; badge?: string; badgeClass?: string; permission: Permission }[] = [
  { href: "/admin",                  label: "Dashboard",        icon: LayoutDashboard, exact: true, permission: "dashboard" },
  { href: "/admin/products",         label: "Products",         icon: Package,         permission: "products" },
  { href: "/admin/categories",       label: "Categories",       icon: Tag,             permission: "categories" },
  { href: "/admin/orders",           label: "Orders",           icon: ShoppingBag,     permission: "orders" },
  { href: "/admin/analytics",        label: "Analytics",        icon: BarChart3,       permission: "analytics" },
  { href: "/admin/slider",           label: "Hero Slider",      icon: SlidersHorizontal, badge: "NEW", badgeClass: "bg-amber-500 text-black", permission: "slider" },
  { href: "/admin/banners",          label: "Page Banners",     icon: Image,             badge: "NEW", badgeClass: "bg-amber-500 text-black", permission: "banners" },
  { href: "/admin/category-banners", label: "Category Banners", icon: Layout,            badge: "NEW", badgeClass: "bg-amber-500 text-black", permission: "banners" },
  { href: "/admin/staff",            label: "Staff",            icon: Users,             badge: "NEW", badgeClass: "bg-purple-500 text-white", permission: "staff" },
  { href: "/admin/coupons",          label: "Coupons",          icon: Ticket,          permission: "coupons" },
  { href: "/admin/settings",         label: "Settings",         icon: Settings,        permission: "settings" },
  { href: "/admin/security",         label: "Security",         icon: Shield,          permission: "security" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the page changes.
  useEffect(() => { setMenuOpen(false); }, [location]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isMasterAdmin = isAdminLoggedIn();
  const staffSession  = !isMasterAdmin ? getStaffSession() : null;

  // Find the nav item matching the current location, to know which
  // permission this specific page requires for a staff session.
  const currentNavItem = navItems.find(item =>
    item.exact ? location === item.href : location.startsWith(item.href)
  );

  useEffect(() => {
    if (isMasterAdmin) {
      // Master admin — full access, same inactivity-logout behavior as before.
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

    // Not master admin — must be a staff session with permission for this page.
    if (!staffSession) { navigate("/admin/login"); return; }
    const requiredPermission = currentNavItem?.permission ?? "dashboard";
    if (!hasPermission(requiredPermission)) { navigate("/staff/dashboard"); return; }
  }, [location, isMasterAdmin, staffSession?.staffId]);

  // While redirect effects above are settling, don't flash protected content.
  if (!isMasterAdmin) {
    if (!staffSession) return null;
    const requiredPermission = currentNavItem?.permission ?? "dashboard";
    if (!hasPermission(requiredPermission)) return null;
  }

  function handleLogout() {
    if (isMasterAdmin) { adminLogout(); navigate("/admin/login"); }
    else { staffLogout(); navigate("/staff/login"); }
  }

  // Staff only ever see the sections their permissions cover.
  const visibleNavItems = isMasterAdmin
    ? navItems
    : navItems.filter(item => hasPermission(item.permission));

  return (
    <div className="flex min-h-[100dvh]">
      {/* Mobile overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar: slide-in drawer on mobile, static column on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-[61] w-64 max-w-[85vw] transform transition-transform duration-200 ease-out
        lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 lg:flex-shrink-0
        bg-gray-950 text-white flex flex-col border-r border-gray-800
        ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-4 border-b border-gray-800 relative">
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu"
            className="lg:hidden absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
          <p className="font-serif font-bold text-white text-sm">Awesomeassam</p>
          <p className="text-gray-500 text-xs">{isMasterAdmin ? "Master Admin" : "Staff Access"}</p>
          <Link href="/">
            <p className="text-gray-500 text-xs mt-2 flex items-center gap-1 hover:text-gray-300 transition-colors cursor-pointer">
              <ArrowLeft className="h-3 w-3" /> Back to Store
            </p>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive ? "bg-primary text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}>
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.badgeClass}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Staff Portal shortcut */}
          <div className="pt-2 mt-2 border-t border-gray-800">
            <Link href="/staff/login">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-purple-400 hover:bg-purple-900/30 cursor-pointer transition-all">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">Staff Portal</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500 text-white flex-shrink-0">↗</span>
              </div>
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-gray-400 truncate">
              {isMasterAdmin ? getAdminEmail() : staffSession?.name}
            </p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors w-full">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        {/* Mobile top bar with menu button */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 h-12 px-3 bg-gray-950 text-white border-b border-gray-800">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu"
            className="p-2 -ml-1 rounded-lg hover:bg-gray-800 active:bg-gray-800">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold truncate">{currentNavItem?.label ?? "Admin"}</span>
        </div>
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
