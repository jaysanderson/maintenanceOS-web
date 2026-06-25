import { useState, useEffect } from "react";
import { Card, Button, inputCls } from "./ui";
import { ApiError } from "../lib/api";
import { aiLots, aiLotTrace, type LotTraceResponse } from "../lib/ai";

/** UC9 — Part/lot trace. Forward (which jobs/accounts a lot was consumed on)
 *  and backward (where it was received). Deterministic over stock movements. */
export function LotTrace() {
  const [lots, setLots] = useState<{ lot: string; item: string; consumedOnJobs: number }[]>([]);
  const [lot, setLot] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LotTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiLots().then((r) => setLots(r.lots)).catch(() => {});
  }, []);

  async function run(l: string) {
    if (!l || loading) return;
    setLot(l);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await aiLotTrace(l));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Part / lot trace</h3>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">Recall-ready</span>
      </div>
      <p className="text-sm text-slate-500">Pick a lot to trace it forward (which jobs and customers received it) and backward (where it was received) — the FSMA-style recall trace.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} max-w-md`} value={lot} onChange={(e) => run(e.target.value)}>
          <option value="">Select a lot…</option>
          {lots.map((l) => (
            <option key={l.lot} value={l.lot}>{l.lot} — {l.item} ({l.consumedOnJobs} job{l.consumedOnJobs === 1 ? "" : "s"})</option>
          ))}
        </select>
        {data && <Button variant="secondary" onClick={() => run(lot)} disabled={loading}>Re-trace</Button>}
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-slate-400">Tracing…</div>}
      {data && (
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{data.summary}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Backward — received</div>
              {data.received.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
                <ul className="space-y-1 text-sm">
                  {data.received.map((r, i) => (
                    <li key={i} className="text-slate-600">{r.date} · {r.quantity} into {r.location ?? "—"} <span className="text-slate-400">({r.ref})</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Forward — consumed on jobs</div>
              {data.consumed.length === 0 ? <p className="text-sm text-slate-400">Not yet consumed</p> : (
                <ul className="space-y-1 text-sm">
                  {data.consumed.map((c, i) => (
                    <li key={i} className="text-slate-600"><span className="font-medium text-slate-700">{c.workOrder}</span> · {c.account} · {c.site} <span className="text-slate-400">(×{c.quantity})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
