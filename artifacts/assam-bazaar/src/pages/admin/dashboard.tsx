import {
  useGetAdminStats,
  useGetRecentOrders,
  useGetTopProducts,
  useGetSalesByCategory,
  getGetAdminStatsQueryKey,
  getGetRecentOrdersQueryKey,
  getGetTopProductsQueryKey,
  getGetSalesByCategoryQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, ShoppingBag, Package, Users, IndianRupee, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped:    "bg-indigo-100 text-indigo-800",
  delivered:  "bg-green-100 text-green-800",
  cancelled:  "bg-red-100 text-red-800",
};

const CHART_COLORS = ["#2d6a4f", "#e05c2f", "#f4a22a", "#3b82f6", "#a855f7"];

// ─── FIX 1: safe Rupee formatter ─────────────────────────────────────────────
// font-serif (Playfair Display) lacks the ₹ glyph → renders as "Ro".
// We split the symbol out and give it an explicit sans-serif font so it
// always renders correctly, regardless of which heading font is active.
function RupeeValue({ amount }: { amount: number }) {
  return (
    <span>
      <span style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700 }}>₹</span>
      {amount.toLocaleString("en-IN")}
    </span>
  );
}

// ─── FIX 2: safe data normaliser ─────────────────────────────────────────────
// API may return { data: {...} } or the object directly — handle both.
function normalise<T>(raw: T | { data: T } | undefined | null): T | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "object" && "data" in (raw as object)) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

function normaliseArray<T>(raw: T[] | { data: T[] } | undefined | null): T[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) && typeof raw === "object" && "data" in (raw as object)) {
    const inner = (raw as { data: T[] }).data;
    return Array.isArray(inner) ? inner : [];
  }
  return Array.isArray(raw) ? raw : [];
}

export default function AdminDashboard() {
  const { data: statsRaw, isLoading: statsLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });
  const { data: recentOrdersRaw } = useGetRecentOrders(
    { limit: 8 },
    { query: { queryKey: getGetRecentOrdersQueryKey({ limit: 8 }) } }
  );
  const { data: topProductsRaw } = useGetTopProducts(
    { limit: 5 },
    { query: { queryKey: getGetTopProductsQueryKey({ limit: 5 }) } }
  );
  const { data: salesByCategoryRaw } = useGetSalesByCategory({
    query: { queryKey: getGetSalesByCategoryQueryKey() },
  });

  // FIX 2 applied — normalise all responses
  const stats            = normalise(statsRaw);
  const recentOrdersData = normaliseArray(recentOrdersRaw as any);
  const topProductsData  = normaliseArray(topProductsRaw as any);
  const salesData        = normaliseArray(salesByCategoryRaw as any);

  // FIX 3: explicit ?? 0 fallback on every numeric field
  const totalRevenue      = stats?.totalRevenue      ?? 0;
  const totalOrders       = stats?.totalOrders       ?? 0;
  const totalProducts     = stats?.totalProducts     ?? 0;
  const totalCustomers    = stats?.totalCustomers    ?? 0;
  const pendingOrders     = stats?.pendingOrders     ?? 0;
  const revenueThisMonth  = stats?.revenueThisMonth  ?? 0;

  const statCards = [
    {
      label: "Total Revenue",
      value: <RupeeValue amount={totalRevenue} />,
      raw: totalRevenue,
      icon: IndianRupee,
      color: "text-primary",
    },
    {
      label: "Total Orders",
      value: totalOrders.toLocaleString("en-IN"),
      raw: totalOrders,
      icon: ShoppingBag,
      color: "text-secondary",
    },
    {
      label: "Products",
      value: totalProducts.toLocaleString("en-IN"),
      raw: totalProducts,
      icon: Package,
      color: "text-accent",
    },
    {
      label: "Customers",
      value: totalCustomers.toLocaleString("en-IN"),
      raw: totalCustomers,
      icon: Users,
      color: "text-chart-4",
    },
    {
      label: "Pending Orders",
      value: pendingOrders.toLocaleString("en-IN"),
      raw: pendingOrders,
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      label: "This Month",
      value: <RupeeValue amount={revenueThisMonth} />,
      raw: revenueThisMonth,
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  return (
    <div className="page-enter p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back. Here's what's happening with your store.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-muted-foreground text-xs font-medium">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                // FIX 1: numeric value in a plain <span> (not font-serif) so ₹ renders correctly
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                  data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  {stat.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales by Category Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={salesData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="categoryName"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(val: number) => [
                      `₹${(val ?? 0).toLocaleString("en-IN")}`,
                      "Revenue",
                    ]}
                  />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {salesData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProductsData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No products yet</p>
              ) : (
                topProductsData.map((product: any, i: number) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs font-bold w-4">{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight line-clamp-1">{product.name}</p>
                      <p className="text-muted-foreground text-xs">{product.categoryName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        ₹{(product.revenue ?? 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-muted-foreground text-xs">{product.totalSold ?? 0} sold</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
          <Link href="/admin/orders">
            <span className="text-primary text-xs font-medium hover:underline cursor-pointer">
              View all
            </span>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Order</th>
                  <th className="text-left py-2 pr-4 font-medium">Customer</th>
                  <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Date</th>
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrdersData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No orders yet
                    </td>
                  </tr>
                ) : (
                  recentOrdersData.map((order: any) => (
                    <tr
                      key={order.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`row-order-${order.id}`}
                    >
                      <td className="py-3 pr-4">
                        <Link href="/admin/orders">
                          <span className="font-medium text-primary hover:underline cursor-pointer">
                            {order.orderNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-muted-foreground text-xs">{order.customerEmail}</p>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell text-muted-foreground text-xs">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN")
                          : "N/A"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          className={`text-xs ${statusColors[order.status] ?? "bg-gray-100 text-gray-700"}`}
                          variant="outline"
                        >
                          {order.status
                            ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
                            : "Unknown"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-semibold">
                        ₹{(order.total ?? 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
