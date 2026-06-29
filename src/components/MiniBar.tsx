/**
 * Dependency-free horizontal bar chart for small inline data viz (margin by
 * job type, account risk scores, etc.). No charting library — just divs.
 */
export interface MiniBarDatum {
  label: string;
  value: number;
  /** Optional right-aligned display string; defaults to value + unit. */
  display?: string;
  /** Optional per-bar colour override (Tailwind bg-*). */
  color?: string;
}

export function MiniBar({
  data,
  unit = "",
  color = "bg-brand-500",
  max,
}: {
  data: MiniBarDatum[];
  unit?: string;
  color?: string;
  max?: number;
}) {
  if (!data.length) return null;
  const m = max ?? Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-28 shrink-0 truncate text-xs text-slate-500" title={d.label}>
            {d.label}
          </div>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className={`h-full rounded ${d.color ?? color} transition-[width] duration-500`}
              style={{ width: `${Math.max(2, (Math.abs(d.value) / m) * 100)}%` }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
            {d.display ?? `${d.value}${unit}`}
          </div>
        </div>
      ))}
    </div>
  );
}
