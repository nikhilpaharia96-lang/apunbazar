import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total?: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return total !== undefined ? <p className="text-xs text-neutral-500 pt-3">{total} total</p> : null;
  const btn = "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white disabled:opacity-40 hover:bg-neutral-50";
  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs text-neutral-500">{total !== undefined ? `${total} total · ` : ""}Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
