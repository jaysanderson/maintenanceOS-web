import { useRef, useState } from "react";
import { useList, useApiMutation } from "../lib/hooks";
import { api, currency, date } from "../lib/api";
import { aiExtractDocument } from "../lib/ai";
import { ApiError } from "../lib/api";
import {
  PurchaseOrder,
  InventoryLocation,
  Supplier,
  InventoryItem,
} from "../lib/types";
import {
  PageState,
  Card,
  Badge,
  Button,
  Modal,
  Field,
  inputCls,
} from "../components/ui";

interface DraftLine {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  /** Original text from an imported document (shown when unmatched). */
  extractedDescription?: string;
  /** How this line was matched on import (null = needs a manual pick). */
  matchBy?: "sku" | "name" | null;
}

export default function PurchaseOrders() {
  const query = useList<PurchaseOrder[]>("/purchase-orders");
  const locations = useList<InventoryLocation[]>("/inventory/locations");
  const suppliers = useList<Supplier[]>("/suppliers");
  const items = useList<InventoryItem[]>("/inventory/items");
  const [loc, setLoc] = useState("");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { inventoryItemId: "", quantity: 1, unitCost: 0 },
  ]);

  const receive = useApiMutation(
    (id: string) =>
      api.post(`/purchase-orders/${id}/receive`, { toLocationId: loc }),
    ["/purchase-orders", "/inventory", "/dashboard"]
  );

  const create = useApiMutation(
    (body: unknown) => api.post("/purchase-orders", body),
    ["/purchase-orders"]
  );

  // ── Import from document (J1) ──
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);

  const resetForm = () => {
    setSupplierId("");
    setExpectedDate("");
    setNotes("");
    setLines([{ inventoryItemId: "", quantity: 1, unitCost: 0 }]);
    setImportedFrom(null);
    setImportError(null);
    create.reset();
  };

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const r = await aiExtractDocument(file);
      if (!r.draft || r.lowConfidence) {
        setImportError(
          r.message ?? "Couldn't read a purchase order from that document."
        );
        return;
      }
      const d = r.draft;
      resetForm();
      setSupplierId(d.matchedSupplierId ?? "");
      setExpectedDate(d.expectedDate ? d.expectedDate.slice(0, 10) : "");
      setNotes(
        d.supplierRef ? `Imported from supplier ref ${d.supplierRef}` : ""
      );
      setLines(
        d.lines.length
          ? d.lines.map((l) => ({
              inventoryItemId: l.matchedItemId ?? "",
              quantity: l.quantity || 1,
              unitCost: l.unitCost || 0,
              extractedDescription: l.description,
              matchBy: l.matchBy,
            }))
          : [{ inventoryItemId: "", quantity: 1, unitCost: 0 }]
      );
      setImportedFrom(d.matchedSupplierName ?? d.supplierName ?? "document");
      setOpen(true);
    } catch (err) {
      setImportError(
        err instanceof ApiError && err.status === 503
          ? "Vision extraction isn't configured on the server (needs a NUA key)."
          : (err as Error).message
      );
    } finally {
      setImporting(false);
    }
  }

  const unmatchedCount = lines.filter(
    (l) => l.extractedDescription && !l.inventoryItemId
  ).length;

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const validLines = lines.filter(
    (l) => l.inventoryItemId && l.quantity > 0
  );
  const draftTotal = validLines.reduce(
    (s, l) => s + l.quantity * l.unitCost,
    0
  );

  const submit = () =>
    create.mutate(
      {
        supplierId,
        expectedDate: expectedDate
          ? new Date(expectedDate).toISOString()
          : undefined,
        notes: notes || undefined,
        lines: validLines,
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Receive into:</span>
          <select
            className={`${inputCls} max-w-xs`}
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
          >
            <option value="">Select location…</option>
            {(locations.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
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
            title="Upload a supplier PO or order confirmation; AI extracts a draft"
          >
            {importing ? "Reading document…" : "✶ Import from document"}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            + New Purchase Order
          </Button>
        </div>
      </div>
      {importError && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {importError}
        </div>
      )}

      <PageState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
        emptyLabel="No purchase orders yet. Create one to order stock."
      >
        <div className="space-y-3">
          {(query.data ?? []).map((po) => (
            <Card key={po.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-brand-600">
                    {po.poNumber}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    {po.supplier?.name} · expected {date(po.expectedDate)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge value={po.status} />
                  {po.status !== "RECEIVED" && po.status !== "CANCELLED" && (
                    <Button
                      variant="secondary"
                      disabled={!loc || receive.isPending}
                      onClick={() => receive.mutate(po.id)}
                    >
                      Receive Stock
                    </Button>
                  )}
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="py-1">Item</th>
                    <th className="py-1">Qty</th>
                    <th className="py-1">Received</th>
                    <th className="py-1">Unit Cost</th>
                    <th className="py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(po.lines ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="py-1">{l.inventoryItem?.name}</td>
                      <td className="py-1">{l.quantity}</td>
                      <td className="py-1">{l.receivedQty}</td>
                      <td className="py-1">{currency(l.unitCost)}</td>
                      <td className="py-1">{currency(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      </PageState>
      {receive.isError && (
        <p className="text-sm text-red-600">
          {(receive.error as Error).message}
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={importedFrom ? "Review imported purchase order" : "New Purchase Order"}
      >
        <div className="space-y-3">
          {importedFrom && (
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
              <span className="font-semibold">Extracted from {importedFrom}.</span>{" "}
              Review every line before creating.
              {unmatchedCount > 0 && (
                <span className="font-medium text-amber-700">
                  {" "}
                  {unmatchedCount} line{unmatchedCount > 1 ? "s" : ""} couldn't be
                  matched to your catalogue — pick an item or remove.
                </span>
              )}
            </div>
          )}
          <Field label="Supplier">
            <select
              className={inputCls}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected date">
              <input
                type="date"
                className={inputCls}
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <input
                className={inputCls}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Line items
              </span>
              <button
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={() =>
                  setLines((ls) => [
                    ...ls,
                    { inventoryItemId: "", quantity: 1, unitCost: 0 },
                  ])
                }
              >
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => {
                const unmatched = Boolean(
                  l.extractedDescription && !l.inventoryItemId
                );
                return (
                  <div key={i}>
                    {l.extractedDescription && (
                      <div className="mb-0.5 text-[11px] text-slate-400">
                        Document line: “{l.extractedDescription}”
                        {l.matchBy === "name" && !unmatched && (
                          <span className="ml-1 text-amber-600">(name match — confirm)</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <select
                        className={`${inputCls} flex-1 ${
                          unmatched ? "border-amber-400 ring-1 ring-amber-300" : ""
                        }`}
                        value={l.inventoryItemId}
                        onChange={(e) => {
                          const it = (items.data ?? []).find(
                            (x) => x.id === e.target.value
                          );
                          setLine(i, {
                            inventoryItemId: e.target.value,
                            unitCost: it ? it.unitCost : l.unitCost,
                          });
                        }}
                      >
                        <option value="">
                          {unmatched ? "⚠ Pick a matching item…" : "Item…"}
                        </option>
                        {(items.data ?? []).map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.sku} — {it.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className={`${inputCls} w-20`}
                        value={l.quantity}
                        min={1}
                        onChange={(e) =>
                          setLine(i, { quantity: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        className={`${inputCls} w-24`}
                        value={l.unitCost}
                        min={0}
                        step="0.01"
                        onChange={(e) =>
                          setLine(i, { unitCost: Number(e.target.value) })
                        }
                      />
                      {lines.length > 1 && (
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() =>
                            setLines((ls) => ls.filter((_, idx) => idx !== i))
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-right text-sm text-slate-500">
              Estimated total: {currency(draftTotal)}
            </div>
          </div>

          {create.isError && (
            <p className="text-sm text-red-600">
              {(create.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !supplierId || validLines.length === 0 || create.isPending
              }
              onClick={submit}
            >
              {create.isPending ? "Creating…" : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
