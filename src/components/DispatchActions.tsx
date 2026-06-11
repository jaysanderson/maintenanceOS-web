import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button } from "./ui";
import { aiDispatchActions, type DispatchAction } from "../lib/ai";
import { api, ApiError } from "../lib/api";

const ACTION_STYLE: Record<DispatchAction["action"], string> = {
  ASSIGN: "bg-green-100 text-green-700",
  ESCALATE: "bg-red-100 text-red-700",
  RESCHEDULE: "bg-amber-100 text-amber-700",
};

/**
 * F5 — Dispatcher Next-Best-Action. Ranks the unassigned queue into concrete
 * actions (assign a skill-matched tech / escalate / reschedule) via Progress
 * Agentic RAG, and lets the dispatcher APPLY each one in a click.
 */
export function DispatchActions() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<DispatchAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row state: which work order is being assigned, and which were applied.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setAppliedIds({});
    setRowError({});
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

  async function applyAssign(a: DispatchAction, key: string) {
    if (!a.workOrderId || !a.recommendedTechnicianId) return;
    setBusyId(key);
    setRowError((r) => ({ ...r, [key]: "" }));
    try {
      await api.patch(`/work-orders/${a.workOrderId}/assign`, {
        assignedEmployeeId: a.recommendedTechnicianId,
      });
      setAppliedIds((m) => ({ ...m, [key]: a.recommendedTechnician ?? "technician" }));
      qc.invalidateQueries({ queryKey: ["/work-orders"] });
      qc.invalidateQueries({ queryKey: ["/dashboard"] });
    } catch (e) {
      setRowError((r) => ({ ...r, [key]: (e as Error).message }));
    } finally {
      setBusyId(null);
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
          or reschedule — each with a reason. Apply an assignment in one click.
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
          {actions.map((a, i) => {
            const key = `${a.workOrder}-${i}`;
            const applied = appliedIds[key];
            const canAssign =
              a.action === "ASSIGN" && a.workOrderId && a.recommendedTechnicianId;
            return (
              <div key={key} className="flex items-start gap-3 py-3">
                <span
                  className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${ACTION_STYLE[a.action] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {a.action}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-slate-800">
                    {a.workOrderId ? (
                      <Link to={`/work-orders/${a.workOrderId}`} className="text-brand-600 hover:underline">
                        {a.workOrder}
                      </Link>
                    ) : (
                      a.workOrder
                    )}
                    {a.recommendedTechnician && (
                      <span className="font-normal text-slate-500"> → {a.recommendedTechnician}</span>
                    )}
                  </div>
                  <div className="text-slate-500">{a.reason}</div>
                  {rowError[key] && (
                    <div className="mt-1 text-xs text-red-600">{rowError[key]}</div>
                  )}
                </div>
                <div className="shrink-0">
                  {applied ? (
                    <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      ✓ Assigned to {applied.split(" ")[0]}
                    </span>
                  ) : canAssign ? (
                    <Button
                      variant="secondary"
                      disabled={busyId === key}
                      onClick={() => applyAssign(a, key)}
                    >
                      {busyId === key
                        ? "Assigning…"
                        : `Assign ${a.recommendedTechnician?.split(" ")[0] ?? ""}`}
                    </Button>
                  ) : a.workOrderId ? (
                    <Link
                      to={`/work-orders/${a.workOrderId}`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
