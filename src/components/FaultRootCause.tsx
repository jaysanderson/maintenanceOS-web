import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button } from "./ui";
import { Markdown } from "./Markdown";
import { api, ApiError } from "../lib/api";
import { aiFaultRootCause, type FaultRootCauseResponse } from "../lib/ai";

/**
 * UC1A — Recurring-fault / callback root-cause explainer. Correlates the site's
 * job history (recurring issues, callbacks, labour overruns, parts usage) into
 * ranked root causes with cited evidence (Progress Agentic RAG), and offers a
 * HITL follow-up inspection job.
 */
export function FaultRootCause({ workOrderId }: { workOrderId: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FaultRootCauseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCreated(null);
    try {
      setData(await aiFaultRootCause(workOrderId));
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

  async function raiseFollowup() {
    const a = data?.proposedActions[0];
    if (!a) return;
    setBusy(true);
    try {
      const wo = await api.post<{ id: string; workOrderNumber: string }>("/work-orders", {
        accountId: a.accountId,
        siteId: a.siteId,
        title: a.title,
        jobType: a.jobType,
        priority: "NORMAL",
        status: "NEW",
        internalNotes: "Raised from AI recurring-fault analysis.",
      });
      setCreated(wo.workOrderNumber);
      qc.invalidateQueries({ queryKey: ["/work-orders"] });
      qc.invalidateQueries({ queryKey: ["/dashboard"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = data?.signals;
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Recurring-fault analysis</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Agentic RAG
          </span>
        </div>
        <Button variant={data ? "secondary" : "primary"} onClick={run} disabled={loading}>
          {loading ? "Analysing…" : data ? "Re-analyse" : "Analyse this site"}
        </Button>
      </div>

      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">
          Correlate this site's job history — recurring issues, callbacks, labour
          overruns and parts usage — into ranked root causes with the evidence
          for each, and raise a follow-up inspection in one click.
        </p>
      )}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Correlating this site's history…
        </div>
      )}

      {data && s && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            {data.site.name} · {data.site.account} — {s.totalJobs} jobs in the last {data.windowDays} days
          </div>

          {(s.recurring.length > 0 || s.callbacks.length > 0 || s.overruns.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {s.recurring.map((r) => (
                <span key={r.label} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  {r.label} ×{r.count}
                </span>
              ))}
              {s.callbacks.length > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                  {s.callbacks.length} callback{s.callbacks.length > 1 ? "s" : ""}
                </span>
              )}
              {s.overruns.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {s.overruns.length} labour overrun{s.overruns.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3">
            <Markdown text={data.narrative} />
          </div>

          {data.citations.length > 0 && (
            <div className="text-[11px] text-slate-400">Sources: {data.citations.slice(0, 4).join(" · ")}</div>
          )}

          {data.proposedActions.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="font-medium text-slate-700">Proposed follow-up</div>
                <div className="text-slate-500">{data.proposedActions[0].title}</div>
              </div>
              <div className="shrink-0">
                {created ? (
                  <button
                    className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:underline"
                    onClick={() => nav("/work-orders")}
                  >
                    ✓ Created {created} →
                  </button>
                ) : (
                  <Button variant="secondary" disabled={busy} onClick={raiseFollowup}>
                    {busy ? "Creating…" : "Create follow-up job"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
