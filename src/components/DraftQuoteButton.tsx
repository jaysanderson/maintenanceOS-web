import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Modal } from "./ui";
import { api, currency, ApiError } from "../lib/api";
import { useApiMutation } from "../lib/hooks";
import { aiDraftQuote, type QuoteDraft } from "../lib/ai";

/**
 * F3 — Site-Adaptive Quote Drafting. Drafts a quote for a work order,
 * grounded in comparable completed jobs, via Progress Agentic RAG
 * (server-side /api/ai/draft-quote). Proposal only — the user reviews and
 * creates the quote through the normal flow.
 */
export function DraftQuoteButton({ workOrderId }: { workOrderId: string }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [comparables, setComparables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState<string | null>(null);

  // Create a real DRAFT quote on this work order from the AI draft.
  const createQuote = useApiMutation(
    (body: Record<string, unknown>) => api.post<{ id: string }>("/quotes", body),
    [`/work-orders/${workOrderId}`, "/quotes", "/dashboard"]
  );

  function create() {
    if (!draft) return;
    createQuote.mutate(
      {
        workOrderId,
        labourHours: draft.labourHours,
        labourRate: draft.labourRate,
        materialCost: draft.materialCost,
        subcontractorCost: draft.subcontractorCost,
        equipmentCost: draft.equipmentCost,
        travelCost: draft.travelCost,
        disposalCost: draft.disposalCost,
        marginPercent: draft.marginPercent,
        notes: draft.reasoning ? `AI-drafted. ${draft.reasoning}` : "AI-drafted quote.",
      },
      {
        onSuccess: (q) => {
          setOpen(false);
          nav(`/quotes/${q.id}`);
        },
      }
    );
  }

  async function run() {
    setOpen(true);
    if (loading) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    setLowConfidence(null);
    try {
      const res = await aiDraftQuote(workOrderId);
      if (res.lowConfidence || !res.draft) {
        setLowConfidence(
          res.message ??
            "Not enough comparable jobs to draft a confident quote — please quote manually."
        );
        return;
      }
      setDraft(res.draft);
      setComparables((res.comparables ?? []).map((c) => c.workOrder));
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

  const labourTotal = draft ? draft.labourHours * draft.labourRate : 0;

  return (
    <>
      <Button variant="secondary" onClick={run}>
        ✶ Draft with AI
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="AI Quote Draft">
        {loading && (
          <div className="flex items-center gap-3 py-6 text-sm text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Reviewing comparable jobs…
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {lowConfidence && !loading && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-4 text-sm text-amber-800">
            <span aria-hidden>⚠</span>
            <span>{lowConfidence}</span>
          </div>
        )}
        {draft && (
          <div className="space-y-4 text-sm">
            <Row label="Labour" value={`${draft.labourHours} h @ ${currency(draft.labourRate)} = ${currency(labourTotal)}`} />
            <Row label="Materials" value={currency(draft.materialCost)} />
            {draft.subcontractorCost > 0 && <Row label="Subcontractor" value={currency(draft.subcontractorCost)} />}
            {draft.equipmentCost > 0 && <Row label="Equipment" value={currency(draft.equipmentCost)} />}
            {draft.travelCost > 0 && <Row label="Travel" value={currency(draft.travelCost)} />}
            {draft.disposalCost > 0 && <Row label="Disposal" value={currency(draft.disposalCost)} />}
            <Row label="Margin" value={`${draft.marginPercent}%`} />
            {draft.reasoning && (
              <div className="rounded-lg bg-slate-50 p-3 text-slate-600">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reasoning
                </div>
                {draft.reasoning}
              </div>
            )}
            {comparables.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Anchored on
                </div>
                <div className="flex flex-wrap gap-2">
                  {comparables.map((c) => (
                    <span key={c} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Totals (subtotal / GST) are computed server-side. Creating it
              saves a <strong>DRAFT</strong> quote you can review and send.
            </p>
            {createQuote.isError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Couldn't create quote: {(createQuote.error as Error).message}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <Button onClick={create} disabled={createQuote.isPending}>
                {createQuote.isPending ? "Creating…" : "Create quote"}
              </Button>
              <Button variant="secondary" onClick={run} disabled={loading}>
                Regenerate
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
