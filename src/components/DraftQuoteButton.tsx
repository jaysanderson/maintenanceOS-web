import { useState } from "react";
import { Button, Modal } from "./ui";
import { currency } from "../lib/api";
import { aiDraftQuote, type QuoteDraft } from "../lib/ai";
import { ApiError } from "../lib/api";

/**
 * F3 — Site-Adaptive Quote Drafting. Drafts a quote for a work order,
 * grounded in comparable completed jobs, via Progress Agentic RAG
 * (server-side /api/ai/draft-quote). Proposal only — the user reviews and
 * creates the quote through the normal flow.
 */
export function DraftQuoteButton({ workOrderId }: { workOrderId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [comparables, setComparables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    if (loading) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await aiDraftQuote(workOrderId);
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
              Proposal only — totals (subtotal / GST) are computed server-side
              when you create the quote. Review before sending.
            </p>
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
