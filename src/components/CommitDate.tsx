import { useState } from "react";
import { Card, Button, inputCls } from "./ui";
import { Markdown } from "./Markdown";
import { ApiError } from "../lib/api";
import { aiCommitDate, type CommitDateResponse } from "../lib/ai";

/** UC2 — Service commit-date co-pilot. "Can we hit this date?" from parts on
 *  hand + open-PO ETAs + the binding constraint (ARAG narration). */
export function CommitDate({ workOrderId }: { workOrderId: string }) {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CommitDateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await aiCommitDate(workOrderId, target ? new Date(target).toISOString() : undefined));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? "AI is not configured on the server yet." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Commit-date co-pilot</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">Agentic RAG</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className={`${inputCls} flex-none`} style={{ width: "9.5rem" }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target date" />
          <Button variant={data ? "secondary" : "primary"} onClick={run} disabled={loading}>
            {loading ? "Checking…" : data ? "Re-check" : "Check"}
          </Button>
        </div>
      </div>
      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">Check whether this job can be committed by a date — from parts on hand, open-PO ETAs and the binding constraint, with alternatives.</p>
      )}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Binding: {data.bindingConstraint}</span>
            {data.recommendedDate ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Earliest commit: {data.recommendedDate}</span>
            ) : (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Blocked — raise a PO</span>
            )}
          </div>
          {data.parts.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-400"><th className="px-3 py-1">Part</th><th className="px-3 py-1">Need</th><th className="px-3 py-1">On hand</th><th className="px-3 py-1">Short</th><th className="px-3 py-1">PO ETA</th></tr></thead>
                <tbody>
                  {data.parts.map((p) => (
                    <tr key={p.item} className="border-t border-slate-100">
                      <td className="px-3 py-1">{p.item}</td>
                      <td className="px-3 py-1">{p.needed}</td>
                      <td className="px-3 py-1">{p.onHand}</td>
                      <td className={`px-3 py-1 ${p.shortfall > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{p.shortfall || "—"}</td>
                      <td className="px-3 py-1">{p.poEta ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><Markdown text={data.narrative} /></div>
        </div>
      )}
    </Card>
  );
}
