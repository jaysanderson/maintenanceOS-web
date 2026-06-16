import { useRef, useState } from "react";
import { useList, useApiMutation } from "../lib/hooks";
import { api, currency, date, openAuthed } from "../lib/api";
import { Invoice, SupplierBill, Supplier } from "../lib/types";
import {
  PageState,
  DataTable,
  Badge,
  Button,
  Field,
  inputCls,
  Modal,
  Tabs,
} from "../components/ui";
import { Markdown } from "../components/Markdown";
import { aiDunningDraft, aiExtractDocumentStream } from "../lib/ai";

const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"];
const BILL_STATUSES = ["DRAFT", "APPROVED", "PAID", "DISPUTED", "VOID"];

export default function Invoices() {
  return (
    <Tabs
      tabs={[
        { label: "Customer invoices", content: <CustomerInvoices /> },
        { label: "Supplier bills (AP)", content: <SupplierBills /> },
      ]}
    />
  );
}

/* ── Customer invoices (accounts receivable) ────────────────────────────── */
function CustomerInvoices() {
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
        {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                      {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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

/* ── Supplier bills (accounts payable) ──────────────────────────────────── */
interface BillLine {
  inventoryItemId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  matchBy?: "sku" | "name" | "fuzzy" | null;
  matchedLabel?: string;
}

function isOverdue(b: SupplierBill): boolean {
  if (!b.dueDate || b.status === "PAID" || b.status === "VOID") return false;
  return new Date(b.dueDate).getTime() < Date.now();
}

function SupplierBills() {
  const query = useList<SupplierBill[]>("/supplier-bills");
  const suppliers = useList<Supplier[]>("/suppliers");

  const setBillStatus = useApiMutation(
    ({ id, status }: { id: string; status: string }) =>
      api.put(`/supplier-bills/${id}`, { status }),
    ["/supplier-bills", "/dashboard"]
  );
  const create = useApiMutation(
    (body: unknown) => api.post("/supplier-bills", body),
    ["/supplier-bills"]
  );

  // Review/create modal state.
  const [open, setOpen] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([
    { inventoryItemId: null, description: "", quantity: 1, unitCost: 0 },
  ]);

  const resetForm = () => {
    setImportedFrom(null);
    setSupplierId("");
    setSupplierRef("");
    setIssueDate("");
    setDueDate("");
    setTax(0);
    setNotes("");
    setLines([{ inventoryItemId: null, description: "", quantity: 1, unitCost: 0 }]);
    create.reset();
  };

  const setLine = (i: number, patch: Partial<BillLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const validLines = lines.filter((l) => l.description.trim() && l.quantity > 0);
  const subtotal = validLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const total = subtotal + (Number(tax) || 0);

  // ── Import bill from document (AI) ──
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [procOpen, setProcOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);

  const closeProc = () => {
    setProcOpen(false);
    setImporting(false);
    setSteps([]);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(file), type: file.type, name: file.name });
    setImporting(true);
    setImportError(null);
    setSteps(["Uploading the document…"]);
    setProcOpen(true);
    const base = (s: string) => s.replace(/\s*\(\d+s\)\s*$/, "");
    aiExtractDocumentStream(file, {
      onProgress: (m) =>
        setSteps((s) =>
          s.length && base(s[s.length - 1]) === base(m) ? [...s.slice(0, -1), m] : [...s, m]
        ),
      onError: (m) => {
        setImportError(m);
        setImporting(false);
      },
      onResult: (r) => {
        setImporting(false);
        if (!r.draft || r.lowConfidence) {
          setImportError(r.message ?? "Couldn't read a supplier bill from that document.");
          return;
        }
        const d = r.draft;
        resetForm();
        setSupplierId(d.matchedSupplierId ?? "");
        setSupplierRef(d.supplierRef ?? "");
        setIssueDate(d.orderDate ? d.orderDate.slice(0, 10) : "");
        setDueDate(d.expectedDate ? d.expectedDate.slice(0, 10) : "");
        setLines(
          d.lines.length
            ? d.lines.map((l) => ({
                inventoryItemId: l.matchedItemId,
                description: l.description,
                quantity: l.quantity || 1,
                unitCost: l.unitCost || 0,
                matchBy: l.matchBy,
                matchedLabel: l.matchedItemName
                  ? `${l.matchedSku ?? ""} ${l.matchedItemName}`.trim()
                  : undefined,
              }))
            : [{ inventoryItemId: null, description: "", quantity: 1, unitCost: 0 }]
        );
        setImportedFrom(d.matchedSupplierName ?? d.supplierName ?? "document");
        closeProc();
        setOpen(true);
      },
    });
  }

  const submit = () =>
    create.mutate(
      {
        supplierId,
        supplierRef: supplierRef || undefined,
        issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        tax: Number(tax) || 0,
        notes: notes || undefined,
        lines: validLines.map((l) => ({
          inventoryItemId: l.inventoryItemId || undefined,
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      }
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-500">
          Bills received from suppliers (what you owe). Drop in a supplier
          invoice and AI reads it — supplier, dates and line items — into a draft
          to review and approve.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={onImportFile}
          />
          <Button
            variant="secondary"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
            title="Upload a supplier invoice/bill; AI extracts a draft"
          >
            {importing ? "Importing…" : "✶ Import bill from document"}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            + New bill
          </Button>
        </div>
      </div>

      <PageState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
        emptyLabel="No supplier bills yet. Import one from a document to get started."
      >
        {query.data && (
          <DataTable
            rows={query.data}
            rowKey={(b) => b.id}
            columns={[
              { header: "Bill #", cell: (b) => <span className="font-medium text-brand-600">{b.billNumber}</span> },
              { header: "Supplier", cell: (b) => b.supplier?.name ?? "—" },
              { header: "Supplier ref", cell: (b) => b.supplierRef ?? "—" },
              { header: "Issued", cell: (b) => date(b.issueDate) },
              {
                header: "Due",
                cell: (b) => (
                  <span className={isOverdue(b) ? "font-medium text-red-600" : ""}>
                    {date(b.dueDate)}{isOverdue(b) && " ⚠"}
                  </span>
                ),
              },
              { header: "Total", cell: (b) => <span className="font-medium">{currency(b.total)}</span> },
              {
                header: "Status",
                cell: (b) => <Badge value={isOverdue(b) ? "OVERDUE" : b.status} />,
              },
              {
                header: "Action",
                cell: (b) => (
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    value={b.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setBillStatus.mutate({ id: b.id, status: e.target.value })}
                  >
                    {BILL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ),
              },
            ]}
          />
        )}
      </PageState>

      {/* Processing modal — uploaded document + live progress. */}
      <Modal open={procOpen} onClose={closeProc} title="Reading your document">
        <div className="space-y-4">
          {preview && <div className="truncate text-xs text-slate-500">{preview.name}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50" style={{ height: 320 }}>
              {preview?.type?.startsWith("image/") ? (
                <img src={preview.url} alt="Uploaded document" className="h-full w-full object-contain" />
              ) : preview ? (
                <embed src={preview.url} type="application/pdf" className="h-full w-full" />
              ) : null}
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-slate-700">
                {importError ? "We hit a snag" : "AI is reading your document"}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Extracting the supplier, dates and line items, then matching to your catalogue. This can take up to a minute.
              </p>
              <ol className="mt-3 space-y-1.5">
                {steps.map((s, i) => {
                  const last = i === steps.length - 1;
                  const active = importing && last && !importError;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {active ? (
                        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                      ) : (
                        <span className="shrink-0 text-green-600">✓</span>
                      )}
                      <span className={active ? "text-slate-700" : "text-slate-400"}>{s}</span>
                    </li>
                  );
                })}
              </ol>
              {importError && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{importError}</div>
              )}
              {!importing && (
                <div className="mt-auto pt-3">
                  <Button variant="secondary" onClick={closeProc}>Close</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Review / create modal. */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="2xl"
        title={importedFrom ? "Review supplier bill" : "New supplier bill"}
      >
        <div className="space-y-3">
          {importedFrom && (
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
              <span className="font-semibold">Extracted from {importedFrom}.</span>{" "}
              Review every line before approving.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <select
                className={inputCls}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select supplier…</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Supplier invoice #">
              <input
                className={inputCls}
                value={supplierRef}
                placeholder="e.g. INV-10293"
                onChange={(e) => setSupplierRef(e.target.value)}
              />
            </Field>
            <Field label="Issue date">
              <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Line items</span>
              <button
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={() =>
                  setLines((ls) => [...ls, { inventoryItemId: null, description: "", quantity: 1, unitCost: 0 }])
                }
              >
                + Add line
              </button>
            </div>
            <div className="mb-1 flex items-center gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="min-w-0 flex-1">Description</span>
              <span className="flex-none text-center" style={{ width: "4.5rem" }}>Qty</span>
              <span className="flex-none text-right" style={{ width: "6rem" }}>Unit cost</span>
              <span className="flex-none" style={{ width: "1.25rem" }} aria-hidden />
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i}>
                  {(l.matchBy === "sku" || l.matchBy === "name") && (
                    <div className="mb-0.5 text-[11px] text-green-600">✓ matched to catalogue: {l.matchedLabel}</div>
                  )}
                  {l.matchBy === "fuzzy" && (
                    <div className="mb-0.5 text-[11px] text-amber-600">≈ close catalogue match: {l.matchedLabel} — confirm</div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      className={`${inputCls} min-w-0 flex-1`}
                      value={l.description}
                      placeholder="Line description…"
                      aria-label="Description"
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      className={`${inputCls} flex-none`}
                      style={{ width: "4.5rem" }}
                      aria-label="Quantity"
                      value={l.quantity}
                      min={1}
                      onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      className={`${inputCls} flex-none`}
                      style={{ width: "6rem" }}
                      aria-label="Unit cost"
                      value={l.unitCost}
                      min={0}
                      step="0.01"
                      onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })}
                    />
                    <div className="flex flex-none justify-center" style={{ width: "1.25rem" }}>
                      {lines.length > 1 && (
                        <button
                          className="text-xs text-red-600 hover:underline"
                          aria-label="Remove line"
                          onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-3 text-sm">
              <span className="text-slate-500">Subtotal {currency(subtotal)}</span>
              <label className="flex items-center gap-1 text-slate-500">
                Tax
                <input
                  type="number"
                  className={`${inputCls} flex-none`}
                  style={{ width: "6rem" }}
                  aria-label="Tax"
                  value={tax}
                  min={0}
                  step="0.01"
                  onChange={(e) => setTax(Number(e.target.value))}
                />
              </label>
              <span className="font-medium text-slate-700">Total {currency(total)}</span>
            </div>
          </div>

          {create.isError && (
            <p className="text-sm text-red-600">{(create.error as Error).message}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!supplierId || validLines.length === 0 || create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Saving…" : "Create bill"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
