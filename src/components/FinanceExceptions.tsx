import { AiInfo } from "./AiInfo";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button } from "./ui";
import { api, ApiError } from "../lib/api";
import {
  aiFinanceExceptions,
  type FinanceExceptionsResponse,
  type FinanceExceptionItem,
} from "../lib/ai";

const SEV: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

/**
 * UC1B/UC7 — Finance exception explainer + auto-fix. Scans invoices (AR) and
 * supplier bills (AP) for posting/match exceptions, grouped by root cause and
 * explained against the KB finance policy, with one-click HITL fixes where the
 * resolution is unambiguous (e.g. link a bill to its matching PO).
 */
export function FinanceExceptions() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FinanceExceptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [rowErr, setRowErr] = useState<Record<string, string>>({});

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setApplied({});
    setRowErr({});
    try {
      setData(await aiFinanceExceptions());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function applyFix(item: FinanceExceptionItem) {
    if (!item.fix) return;
    setBusy(item.id);
    setRowErr((r) => ({ ...r, [item.id]: "" }));
    try {
      await api.put(`/supplier-bills/${item.id}`, { purchaseOrderId: item.fix.purchaseOrderId });
      setApplied((m) => ({ ...m, [item.id]: item.fix!.poNumber }));
      qc.invalidateQueries({ queryKey: ["/supplier-bills"] });
    } catch (e) {
      setRowErr((r) => ({ ...r, [item.id]: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  const totalExceptions = data?.groups.reduce((s, g) => s + g.items.length, 0) ?? 0;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">AI Finance Exceptions</h3>
          <AiInfo id="finance-exceptions" />
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Agentic RAG
          </span>
        </div>
        <Button variant={data ? "secondary" : "primary"} onClick={run} disabled={loading}>
          {loading ? "Scanning…" : data ? "Rescan" : "Scan for exceptions"}
        </Button>
      </div>

      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">
          Scan invoices and supplier bills for posting & 3-way-match exceptions —
          PO-total mismatches, disputed or overdue bills, overdue invoices,
          unlinked bills and missing dates — each explained against the finance
          policy, with one-click fixes where the resolution is clear.
        </p>
      )}

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Scanning bills & invoices…
        </div>
      )}

      {data && totalExceptions === 0 && (
        <p className="text-sm text-slate-500">No finance exceptions found. 🎉</p>
      )}

      {data && totalExceptions > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            {totalExceptions} exception{totalExceptions > 1 ? "s" : ""} across{" "}
            {data.scanned.bills} bills and {data.scanned.invoices} invoices.
          </p>
          {data.groups.map((g) => (
            <div key={g.kind} className="rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${SEV[g.severity]}`}>
                  {g.severity}
                </span>
                <span className="text-sm font-medium text-slate-800">{g.title}</span>
                <span className="text-xs text-slate-400">· {g.items.length}</span>
              </div>
              <div className="px-3 py-2">
                <p className="mb-2 text-xs text-slate-500">{g.explanation}</p>
                <div className="divide-y divide-slate-50">
                  {g.items.map((it) => (
                    <div key={`${it.type}-${it.id}-${g.kind}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-700">{it.ref}</span>{" "}
                        <span className="text-slate-500">· {it.party}</span>
                        <div className="text-xs text-slate-500">{it.detail}</div>
                        {rowErr[it.id] && <div className="text-xs text-red-600">{rowErr[it.id]}</div>}
                      </div>
                      <div className="shrink-0">
                        {applied[it.id] ? (
                          <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                            ✓ Linked {applied[it.id]}
                          </span>
                        ) : it.fix ? (
                          <Button variant="secondary" disabled={busy === it.id} onClick={() => applyFix(it)}>
                            {busy === it.id ? "Linking…" : `Link ${it.fix.poNumber}`}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {data.policy && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="font-medium text-slate-600">Policy basis:</span> {data.policy.answer}
              {data.policy.citations.length > 0 && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Sources: {data.policy.citations.slice(0, 4).join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
