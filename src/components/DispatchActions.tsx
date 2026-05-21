import { useState } from "react";
import { Card, Button } from "./ui";
import { aiDispatchActions, type DispatchAction } from "../lib/ai";
import { ApiError } from "../lib/api";

const ACTION_STYLE: Record<DispatchAction["action"], string> = {
  ASSIGN: "bg-green-100 text-green-700",
  ESCALATE: "bg-red-100 text-red-700",
  RESCHEDULE: "bg-amber-100 text-amber-700",
};

/**
 * F5 — Dispatcher Next-Best-Action. Ranks the unassigned queue into concrete
 * actions (assign a skill-matched tech / escalate / reschedule) via Progress
 * Agentic RAG (server-side /api/ai/dispatch-actions).
 */
export function DispatchActions() {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<DispatchAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiDispatchActions();
      setActions(res.actions ?? []);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? "AI is not configured on the server yet."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">AI Next-Best-Actions</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Agentic RAG
          </span>
        </div>
        <Button variant={actions ? "secondary" : "primary"} onClick={run} disabled={loading}>
          {loading ? "Ranking…" : actions ? "Refresh" : "Suggest actions"}
        </Button>
      </div>

      {!actions && !loading && !error && (
        <p className="text-sm text-slate-500">
          Rank the unassigned queue into next-best actions — which job to
          assign and to whom (skill &amp; territory matched), which to escalate
          or reschedule — each with a reason. Proposals only; you apply them.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Matching jobs to technicians…
        </div>
      )}

      {actions && actions.length === 0 && (
        <p className="text-sm text-slate-500">No unassigned jobs to action. 🎉</p>
      )}

      {actions && actions.length > 0 && (
        <div className="divide-y divide-slate-100">
          {actions.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <span
                className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${ACTION_STYLE[a.action] ?? "bg-slate-100 text-slate-600"}`}
              >
                {a.action}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium text-slate-800">
                  {a.workOrder}
                  {a.recommendedTechnician && (
                    <span className="font-normal text-slate-500"> → {a.recommendedTechnician}</span>
                  )}
                </div>
                <div className="text-slate-500">{a.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
