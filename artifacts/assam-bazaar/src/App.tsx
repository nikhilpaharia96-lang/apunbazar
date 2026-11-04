import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState } from "react";
import { initAnalytics } from "@/lib/analytics";
import { usePageTracking } from "@/hooks/use-analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

// ── Critical path — eagerly loaded ────────────────────────────────────────
import Home from "@/pages/home";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import BottomNav from "@/components/layout/bottom-nav";
import AdminLayout from "@/components/layout/admin-layout";
import { ApunBazarLoader } from "@/components/ApunBazarLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ── Animation components ───────────────────────────────────────────────────
import { ScrollProgress } from "@/components/animations/ScrollProgress";
import { MouseGlow } from "@/components/animations/MouseGlow";
import { BlurOrbs } from "@/components/animations/BlurOrbs";
import { WhatsAppFloat } from "@/components/WhatsAppButtons";
import InstallAppPrompt from "@/components/InstallAppPrompt";

// ── Public pages — lazy loaded ─────────────────────────────────────────────
const Products      = lazy(() => import("@/pages/products/index"));
const ProductDetail = lazy(() => import("@/pages/products/id"));
const Cart          = lazy(() => import("@/pages/cart"));
const Wishlist      = lazy(() => import("@/pages/wishlist"));
const Checkout      = lazy(() => import("@/pages/checkout"));
const Orders        = lazy(() => import("@/pages/orders"));
const OrderDetail   = lazy(() => import("@/pages/orders/id"));
const CategoryPage  = lazy(() => import("@/pages/category"));
const AboutUs       = lazy(() => import("@/pages/about"));
const ContactUs     = lazy(() => import("@/pages/contact"));
const RefundPolicy  = lazy(() => import("@/pages/refund-policy"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const Terms         = lazy(() => import("@/pages/terms"));
const NotFound      = lazy(() => import("@/pages/not-found"));

// ── Admin pages — lazy loaded ──────────────────────────────────────────────
const AdminLogin            = lazy(() => import("@/pages/admin/login"));
const AdminDashboard        = lazy(() => import("@/pages/admin/dashboard"));
const AdminProducts         = lazy(() => import("@/pages/admin/products"));
const AdminOrders           = lazy(() => import("@/pages/admin/orders"));
const AdminCategories       = lazy(() => import("@/pages/admin/categories"));
const AdminAnalytics        = lazy(() => import("@/pages/admin/analytics"));
const AdminCoupons          = lazy(() => import("@/pages/admin/coupons"));
const AdminSettings         = lazy(() => import("@/pages/admin/settings"));
const AdminSecurity         = lazy(() => import("@/pages/admin/security"));
const SliderManager         = lazy(() => import("@/pages/admin/slider"));
const BannerManager         = lazy(() => import("@/pages/admin/banner-manager"));
const CategoryBannerManager = lazy(() => import("@/pages/admin/category-banner-manager"));
const StaffManagement       = lazy(() => import("@/pages/admin/staff-management"));
const StaffLogin            = lazy(() => import("@/pages/staff/login"));
const StaffDashboard        = lazy(() => import("@/pages/staff/dashboard"));

// ── Page loading skeleton ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="container mx-auto px-4 py-10">
      <Skeleton className="h-8 w-1/3 rounded-xl mb-3" />
      <Skeleton className="h-4 w-1/2 rounded-lg mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Optimized QueryClient ──────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

// ── Page transition variants ───────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  enter: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, y: -6, filter: "blur(2px)",
    transition: { duration: 0.2 },
  },
};

// ── Animated page wrapper ──────────────────────────────────────────────────
function PageWrapper({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return <>{children}</>;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main layout wrapper ────────────────────────────────────────────────────
function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Navbar />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────
function Router() {
  const [location] = useLocation();
  const isAdmin = location === "/admin" || location.startsWith("/admin/");
  const isStaff = location.startsWith("/staff/");

  // ── Scroll to top on every page navigation ──────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);

  useEffect(() => { initAnalytics(); }, []);
  usePageTracking();

  if (isStaff) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/staff/login"     component={StaffLogin} />
          <Route path="/staff/dashboard" component={StaffDashboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isAdmin) {
    if (location === "/admin/login") {
      return (
        <Suspense fallback={<PageLoader />}>
          <AdminLogin />
        </Suspense>
      );
    }
    return (
      <AdminLayout>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/admin"                  component={AdminDashboard} />
            <Route path="/admin/products"         component={AdminProducts} />
            <Route path="/admin/categories"       component={AdminCategories} />
            <Route path="/admin/orders"           component={AdminOrders} />
            <Route path="/admin/analytics"        component={AdminAnalytics} />
            <Route path="/admin/coupons"          component={AdminCoupons} />
            <Route path="/admin/settings"         component={AdminSettings} />
            <Route path="/admin/security"         component={AdminSecurity} />
            <Route path="/admin/slider"           component={SliderManager} />
            <Route path="/admin/banners"          component={BannerManager} />
            <Route path="/admin/category-banners" component={CategoryBannerManager} />
            <Route path="/admin/staff"            component={StaffManagement} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AdminLayout>
    );
  }

  return (
    <MainLayout>
      <PageWrapper>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/"               component={Home} />
            <Route path="/products"       component={Products} />
            <Route path="/products/:id"   component={ProductDetail} />
            <Route path="/category/:slug" component={CategoryPage} />
            <Route path="/cart"           component={Cart} />
            <Route path="/wishlist"       component={Wishlist} />
            <Route path="/checkout"       component={Checkout} />
            <Route path="/orders"         component={Orders} />
            <Route path="/orders/:id"     component={OrderDetail} />
            <Route path="/about"          component={AboutUs} />
            <Route path="/contact"        component={ContactUs} />
            <Route path="/refund-policy"  component={RefundPolicy} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms"          component={Terms} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </PageWrapper>
    </MainLayout>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

  const [loading, setLoading] = useState(() => {
    try {
      const visited = sessionStorage.getItem("ab_visited");
      if (visited) return false;
      return true;
    } catch { return false; }
  });

  if (loading) {
    return (
      <ApunBazarLoader
        onComplete={() => {
          try { sessionStorage.setItem("ab_visited", "1"); } catch {}
          setLoading(false);
        }}
        duration={2000}
      />
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ScrollProgress />
          <BlurOrbs />
          <MouseGlow />
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <WhatsAppFloatWrapper />
          <InstallPromptWrapper />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function WhatsAppFloatWrapper() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isStaff = location.startsWith("/staff");
  if (isAdmin || isStaff) return null;
  return <WhatsAppFloat />;
}

// Install prompt sirf homepage par (left side)
function InstallPromptWrapper() {
  const [location] = useLocation();
  if (location !== "/") return null;
  return <InstallAppPrompt />;
}
