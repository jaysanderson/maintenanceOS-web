import { useState } from "react";
import { useList, useApiMutation } from "../lib/hooks";
import { api, currency, date, openAuthed } from "../lib/api";
import { Invoice } from "../lib/types";
import { PageState, DataTable, Badge, inputCls, Modal } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { aiDunningDraft } from "../lib/ai";

const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"];

export default function Invoices() {
  const [status, setStatus] = useState("");
  const query = useList<Invoice[]>(`/invoices${status ? `?status=${status}` : ""}`);
  const setStatusM = useApiMutation(
    ({ id, status }: { id: string; status: string }) =>
      api.patch(`/invoices/${id}/status`, { status }),
    ["/invoices", "/dashboard"]
  );

  // I3 — dunning draft modal
  const [dunning, setDunning] = useState<{ invoice: string; account: string; daysOverdue: number; draft: string } | null>(null);
  const [dunningOpen, setDunningOpen] = useState(false);
  const [dunningLoading, setDunningLoading] = useState(false);
  async function draftReminder(id: string) {
    setDunningOpen(true);
    setDunning(null);
    setDunningLoading(true);
    try {
      setDunning(await aiDunningDraft(id));
    } finally {
      setDunningLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <select className={`${inputCls} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <PageState loading={query.isLoading} error={query.error} empty={query.data?.length === 0}>
        {query.data && (
          <DataTable
            rows={query.data}
            rowKey={(i) => i.id}
            columns={[
              {
                header: "Invoice #",
                cell: (i) => (
                  <button
                    className="font-medium text-brand-600 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAuthed(`/invoices/${i.id}/pdf`);
                    }}
                    title="Download PDF"
                  >
                    {i.invoiceNumber}
                  </button>
                ),
              },
              { header: "Account", cell: (i) => i.account?.name ?? "—" },
              { header: "Work Order", cell: (i) => i.workOrder?.workOrderNumber ?? "—" },
              { header: "Subtotal", cell: (i) => currency(i.subtotal) },
              { header: "Total", cell: (i) => <span className="font-medium">{currency(i.total)}</span> },
              { header: "Issued", cell: (i) => date(i.issuedAt) },
              {
                header: "Due",
                cell: (i) => (
                  <span className={i.overdue ? "font-medium text-red-600" : ""}>
                    {date(i.dueAt)}{i.overdue && " ⚠"}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (i) => (
                  <Badge value={i.overdue && i.status !== "PAID" ? "OVERDUE" : i.status} />
                ),
              },
              {
                header: "Action",
                cell: (i) => (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={i.status}
                      onChange={(e) => setStatusM.mutate({ id: i.id, status: e.target.value })}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {i.overdue && i.status !== "PAID" && (
                      <button
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        onClick={() => draftReminder(i.id)}
                        title="Draft an AI payment reminder"
                      >
                        ✶ Remind
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </PageState>

      <Modal open={dunningOpen} onClose={() => setDunningOpen(false)} title="AI payment reminder (draft)">
        {dunningLoading && <div className="text-sm text-slate-400">Drafting…</div>}
        {dunning && (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">
              {dunning.invoice} · {dunning.account} · {dunning.daysOverdue} days overdue
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <Markdown text={dunning.draft} />
            </div>
            <p className="text-xs text-slate-400">Review before sending — this is a draft.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
