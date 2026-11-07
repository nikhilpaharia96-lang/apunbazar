import { cn } from "@/lib/utils";

interface Props {
  from: string; to: string;
  onFrom: (v: string) => void; onTo: (v: string) => void;
  onPreset: (days: number) => void;
}

const PRESETS = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }];

/** Date range picker with quick presets. Native date inputs = best touch UX on phones. */
export function DateRange({ from, to, onFrom, onTo, onPreset }: Props) {
  const input = "h-10 px-2.5 rounded-lg border border-neutral-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-700/15 focus:border-emerald-800";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5" role="group" aria-label="Quick ranges">
        {PRESETS.map((p) => (
          <button key={p.days} type="button" onClick={() => onPreset(p.days)}
            className="h-9 px-3 text-xs font-medium rounded-md text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200">
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <label className="sr-only" htmlFor="range-from">From date</label>
        <input id="range-from" type="date" value={from} max={to} onChange={(e) => e.target.value && onFrom(e.target.value)} className={cn(input, "flex-1 min-w-0")} />
        <span className="text-neutral-400 text-sm" aria-hidden>→</span>
        <label className="sr-only" htmlFor="range-to">To date</label>
        <input id="range-to" type="date" value={to} min={from} onChange={(e) => e.target.value && onTo(e.target.value)} className={cn(input, "flex-1 min-w-0")} />
      </div>
    </div>
  );
}
