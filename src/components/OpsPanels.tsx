import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "./ui";
import { AiInfo } from "./AiInfo";
import { Markdown } from "./Markdown";
import { ApiError } from "../lib/api";
import {
  aiRiskWatchlist,
  aiCostExceptions,
  aiComplianceReadiness,
  type RiskWatchlistResponse,
  type CostExceptionsResponse,
  type ComplianceReadinessResponse,
} from "../lib/ai";

function useRun<T>(fn: () => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? "AI is not configured on the server yet." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return { loading, data, error, run };
}

function Header({ title, data, loading, onRun, label, infoId }: { title: string; data: unknown; loading: boolean; onRun: () => void; label: string; infoId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">Agentic RAG</span>
        {infoId && <AiInfo id={infoId} />}
      </div>
      <Button variant={data ? "secondary" : "primary"} onClick={onRun} disabled={loading}>
        {loading ? "Working…" : data ? "Refresh" : label}
      </Button>
    </div>
  );
}

/** UC6 — composite multi-factor account risk watchlist. */
export function RiskWatchlist() {
  const { loading, data, error, run } = useRun<RiskWatchlistResponse>(aiRiskWatchlist);
  return (
    <Card className="space-y-3 p-5">
      <Header title="Risk watchlist" infoId="risk-watchlist" data={data} loading={loading} onRun={run} label="Build watchlist" />
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">Rank accounts by a composite risk score across SLA-risk jobs, overdue $ and open jobs — the students-on-a-caseload pattern, for accounts.</p>
      )}
      {data && (
        <div className="space-y-3">
          {data.accounts.length === 0 ? (
            <p className="text-sm text-slate-500">No accounts showing elevated risk. 🎉</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.accounts.map((a, i) => (
                <div key={a.accountId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link to={`/accounts/${a.accountId}`} className="font-medium text-brand-600 hover:underline">{i + 1}. {a.account}</Link>
                    <div className="text-xs text-slate-500">{a.factors.join(" · ")}</div>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">score {a.score}</span>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><Markdown text={data.narrative} /></div>
        </div>
      )}
    </Card>
  );
}

/** UC8 — completed-job cost variances, pre-labelled. */
export function CostExceptions() {
  const { loading, data, error, run } = useRun<CostExceptionsResponse>(aiCostExceptions);
  const sev: Record<string, string> = { unresolved: "bg-red-100 text-red-700", partial: "bg-amber-100 text-amber-700" };
  return (
    <Card className="space-y-3 p-5">
      <Header title="Cost-variance exceptions" infoId="cost-exceptions" data={data} loading={loading} onRun={run} label="Scan jobs" />
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">Pre-label completed-job cost variances Unresolved / Partial so you review exceptions instead of investigating every job.</p>
      )}
      {data && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{data.items.length} exception{data.items.length === 1 ? "" : "s"} across {data.scanned} completed jobs.</p>
          <div className="divide-y divide-slate-100">
            {data.items.slice(0, 12).map((it) => (
              <div key={it.workOrder} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">{it.workOrder}</span> <span className="text-slate-500">· {it.account}</span>
                  <div className="text-xs text-slate-500">{it.detail}</div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${sev[it.label]}`}>{it.label}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><Markdown text={data.narrative} /></div>
        </div>
      )}
    </Card>
  );
}

/** UC10 — compliance readiness + policy-vs-practice. */
export function ComplianceReadiness() {
  const { loading, data, error, run } = useRun<ComplianceReadinessResponse>(aiComplianceReadiness);
  return (
    <Card className="space-y-3 p-5">
      <Header title="Compliance readiness" infoId="compliance-readiness" data={data} loading={loading} onRun={run} label="Assess" />
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">Compare the written finance policy against the live configuration and records, and flag policy-vs-practice gaps.</p>
      )}
      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{data.metrics.overdueInvoices} overdue invoices</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{data.metrics.disputedBillsOpen} disputed bills</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{data.metrics.invoicesMissingDueDate} missing due dates</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">GST {data.metrics.gstRatePct}% · terms {data.metrics.defaultPaymentTerms}</span>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><Markdown text={data.narrative} /></div>
          {data.citations.length > 0 && <div className="text-[11px] text-slate-400">Sources: {data.citations.slice(0, 4).join(" · ")}</div>}
        </div>
      )}
    </Card>
  );
}
