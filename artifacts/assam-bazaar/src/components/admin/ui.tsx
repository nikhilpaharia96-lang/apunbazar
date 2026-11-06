/**
 * Shared admin / staff design system.
 * Used by BOTH the Admin Panel and the Staff Portal so they stay consistent.
 * Design tokens live in ./tokens.ts (colors, radius, shadow).
 */
import { useState, type ReactNode, type ElementType } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown,
  Inbox, Lock, RefreshCw, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { T } from "./tokens";

/* ── Formatting helpers ─────────────────────────────────────────────────── */
export const inr = (n: number) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
export const compactInr = (n: number) => {
  const v = n ?? 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
};

/* ── PageHeader ─────────────────────────────────────────────────────────── */
export function PageHeader({
  title, description, actions, eyebrow,
}: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.brand }}>{eyebrow}</p>}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 truncate">{title}</h1>
        {description && <p className="text-sm text-neutral-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/* ── DashboardCard (generic surface) ────────────────────────────────────── */
export function DashboardCard({
  title, subtitle, action, children, className, bodyClassName,
}: {
  title?: string; subtitle?: string; action?: ReactNode; children: ReactNode;
  className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("bg-white rounded-xl border border-neutral-200/80 min-w-0", className)} style={{ boxShadow: T.shadow }}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── StatCard ───────────────────────────────────────────────────────────── */
export function StatCard({
  label, value, icon: Icon, loading, hint, trend, href, tone = "brand",
}: {
  label: string; value: ReactNode; icon: ElementType; loading?: boolean;
  hint?: string; trend?: number | null; href?: string;
  tone?: "brand" | "amber" | "blue" | "violet" | "rose";
}) {
  const toneColor = { brand: T.brand, amber: "#b45309", blue: "#1d4ed8", violet: "#6d28d9", rose: "#be123c" }[tone];
  const body = (
    <div
      className={cn(
        "bg-white rounded-xl border border-neutral-200/80 p-3.5 sm:p-4 min-w-0 h-full",
        href && "transition-all hover:-translate-y-0.5 hover:border-neutral-300 active:scale-[0.99]",
      )}
      style={{ boxShadow: T.shadow }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] sm:text-xs font-medium text-neutral-500 truncate">{label}</p>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${toneColor}14`, color: toneColor }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-2.5" />
      ) : (
        <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums truncate">{value}</p>
      )}
      {!loading && (hint || trend != null) && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
          {trend != null && (
            <span className={cn("inline-flex items-center font-medium", trend >= 0 ? "text-emerald-700" : "text-rose-600")}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block min-w-0">{body}</Link> : body;
}

/* ── Loading skeleton blocks ────────────────────────────────────────────── */
export function LoadingSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/* ── EmptyState / ErrorState ────────────────────────────────────────────── */
export function EmptyState({
  title, description, icon: Icon = Inbox, action, compact,
}: { title: string; description?: string; icon?: ElementType; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14")}>
      <span className="w-11 h-11 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3"><Icon className="h-5 w-5" /></span>
      <p className="text-sm font-medium text-neutral-800">{title}</p>
      {description && <p className="text-xs text-neutral-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Couldn't load this data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10" role="alert">
      <span className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3"><AlertTriangle className="h-5 w-5" /></span>
      <p className="text-sm font-medium text-neutral-800">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 active:scale-95 transition">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

/* ── PermissionBadge ────────────────────────────────────────────────────── */
export function PermissionBadge({ label, allowed = true, color }: { label: string; allowed?: boolean; color?: string }) {
  const c = color ?? T.brand;
  return allowed ? (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium" style={{ background: `${c}14`, color: c }}>
      <CheckCircle2 className="h-3 w-3" />{label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-400">
      <Lock className="h-3 w-3" />{label}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
    processing: "bg-violet-50 text-violet-700 ring-violet-200",
    shipped: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  const s = status ?? "unknown";
  return (
    <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium ring-1 ring-inset capitalize", map[s] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200")}>
      {s}
    </span>
  );
}

/* ── SearchBar ──────────────────────────────────────────────────────────── */
export function SearchBar({
  value, onChange, placeholder = "Search…", className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 pl-9 pr-9 rounded-lg border border-neutral-200 bg-white text-sm placeholder:text-neutral-400 outline-none focus:border-[color:var(--ab-brand)] focus:ring-2 focus:ring-[color:var(--ab-brand)]/15 transition"
        style={{ ["--ab-brand" as any]: T.brand }}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 hover:text-neutral-700">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── FilterDropdown (native select — best touch UX on mobile) ──────────── */
export function FilterDropdown({
  value, onChange, options, label, className,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-800 outline-none focus:ring-2 focus:ring-emerald-700/15 focus:border-emerald-800 transition"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
    </div>
  );
}

/* ── ConfirmationDialog ─────────────────────────────────────────────────── */
export function ConfirmationDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string;
  confirmLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-rose-600 hover:bg-rose-700 text-white" : undefined}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── DataTable / ResponsiveTable ────────────────────────────────────────
 * Desktop: real table. Mobile (<sm): each row becomes a compact card, so
 * there is never any horizontal scrolling.
 */
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Show as the card's title on mobile */
  primary?: boolean;
  /** Hide this column on mobile cards */
  hideOnMobile?: boolean;
}

export function DataTable<Row>({
  columns, rows, rowKey, empty, loading, onRowClick,
}: {
  columns: Column<Row>[]; rows: Row[]; rowKey: (r: Row) => string | number;
  empty?: ReactNode; loading?: boolean; onRowClick?: (r: Row) => void;
}) {
  if (loading) return <LoadingSkeleton rows={5} />;
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" compact />}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-neutral-400">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn("transition-colors hover:bg-neutral-50/80", onRowClick && "cursor-pointer")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-3 align-middle", c.align === "right" && "text-right")}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="sm:hidden divide-y divide-neutral-100 -my-1">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("py-3", onRowClick && "active:bg-neutral-50")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-medium text-neutral-900">{primary.cell(r)}</div>
              {rest.find((c) => c.align === "right") && (
                <div className="text-sm font-semibold text-neutral-900 flex-shrink-0">{rest.find((c) => c.align === "right")!.cell(r)}</div>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              {rest.filter((c) => c.align !== "right").map((c) => <span key={c.key} className="min-w-0">{c.cell(r)}</span>)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
export const ResponsiveTable = DataTable;

/* ── useCollapsed (persisted sidebar state) ─────────────────────────────── */
export function usePersistedState(key: string, initial: boolean) {
  const [v, setV] = useState<boolean>(() => {
    try { const s = localStorage.getItem(key); return s === null ? initial : s === "1"; } catch { return initial; }
  });
  const set = (n: boolean) => { setV(n); try { localStorage.setItem(key, n ? "1" : "0"); } catch {} };
  return [v, set] as const;
}
