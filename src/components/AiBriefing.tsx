import { useState } from "react";
import { Card, Button } from "./ui";
import { Markdown } from "./Markdown";
import { aiBriefing } from "../lib/ai";
import { ApiError } from "../lib/api";

/**
 * F4 — Daily Operations Briefing. Generates a prioritised morning briefing
 * from live ERP KPIs, narrated by Progress Agentic RAG (server-side
 * /api/ai/briefing).
 */
export function AiBriefing() {
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiBriefing();
      setBriefing(res.briefing);
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
          <h3 className="font-semibold">AI Daily Briefing</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Agentic RAG
          </span>
        </div>
        <Button variant={briefing ? "secondary" : "primary"} onClick={run} disabled={loading}>
          {loading ? "Generating…" : briefing ? "Regenerate" : "Generate briefing"}
        </Button>
      </div>

      {!briefing && !loading && !error && (
        <p className="text-sm text-slate-500">
          A prioritised, plain-English summary of today's operation — SLA
          breaches, unassigned jobs, overdue invoices and margin risk — with
          the work orders and invoices to action.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Reviewing today's KPIs…
        </div>
      )}

      {briefing && <Markdown text={briefing} />}
    </Card>
  );
}
