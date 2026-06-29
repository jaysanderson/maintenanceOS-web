import { AiInfo } from "./AiInfo";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, Modal } from "./ui";
import { api, ApiError, currency, dateTime, date } from "../lib/api";
import {
  aiBriefing,
  type BriefingData,
  type BriefingSlaBreach,
  type BriefingOverdueInvoice,
  type BriefingMarginJob,
} from "../lib/ai";

/**
 * F4 — Daily Operations Briefing.
 *
 * The server gathers a structured snapshot of today's operation
 * (SLA breaches, overdue invoices, margin risk, low stock) from Prisma
 * and asks Progress Agentic RAG to write a short executive headline
 * for it. The headline lives at the top of the card; the snapshot
 * itself becomes an *interactive* dashboard — every work order /
 * invoice / margin row is clickable and opens a quick-detail modal
 * over the live REST API. No fabricated numbers.
 */
export function AiBriefing() {
  const [loading, setLoading] = useState(false);
  const [headline, setHeadline] = useState<string | null>(null);
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openWo, setOpenWo] = useState<string | null>(null);
  const [openInv, setOpenInv] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiBriefing();
      setHeadline(res.briefing);
      setData(res.data);
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
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="font-semibold">AI Daily Briefing</h3>
          <AiInfo id="briefing" />
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Live data + ARAG
          </span>
        </div>
        <Button
          variant={data ? "secondary" : "primary"}
          onClick={run}
          disabled={loading}
        >
          {loading ? "Generating…" : data ? "Regenerate" : "Generate briefing"}
        </Button>
      </div>

      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">
          A prioritised, plain-English summary of today's operation — SLA
          breaches, unassigned jobs, overdue invoices and margin risk — with
          every work order and invoice clickable for full detail.
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

      {data && (
        <div className="space-y-4">
          {headline && (
            <div className="rounded-lg border-l-4 border-brand-500 bg-brand-50/60 p-3 text-sm leading-relaxed text-slate-800">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                AI take
              </div>
              {headline}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKpi
              label="Open jobs"
              value={data.openWorkOrders}
              tone="default"
            />
            <MiniKpi
              label="Unassigned"
              value={data.unassignedJobs}
              tone={data.unassignedJobs > 0 ? "warn" : "default"}
            />
            <MiniKpi
              label="Due today"
              value={data.jobsDueToday}
              tone={data.jobsDueToday > 0 ? "warn" : "default"}
            />
            <MiniKpi
              label="SLA breaches"
              value={data.slaBreaches}
              tone={data.slaBreaches > 0 ? "danger" : "good"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Urgent · SLA breaches"
              empty={
                data.slaBreachedJobs.length === 0
                  ? "Nothing breached. Nice."
                  : null
              }
              tone="danger"
              count={data.slaBreachedJobs.length}
            >
              {data.slaBreachedJobs.map((w) => (
                <SlaBreachRow
                  key={w.id}
                  item={w}
                  onClick={() => setOpenWo(w.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              title="Financial · overdue invoices"
              empty={
                data.overdueInvoices.length === 0
                  ? "Nothing overdue."
                  : null
              }
              tone="warn"
              count={data.overdueInvoices.length}
            >
              {data.overdueInvoices.map((i) => (
                <OverdueInvoiceRow
                  key={i.id}
                  item={i}
                  onClick={() => setOpenInv(i.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              title="Margin risk · recently completed"
              empty={
                data.worstMarginJobs.length === 0
                  ? "No costed jobs yet."
                  : null
              }
              tone="warn"
              count={data.worstMarginJobs.length}
            >
              {data.worstMarginJobs.map((m) => (
                <MarginRow
                  key={m.workOrder}
                  item={m}
                  onClick={() => setOpenWo(m.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              title="Stock · running low"
              empty={
                data.lowStockItems.length === 0
                  ? "Stock levels healthy."
                  : null
              }
              tone="warn"
              count={data.lowStockItems.length}
            >
              {data.lowStockItems.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className="text-xs text-slate-500">
                    {s.available} on hand · reorder at {s.reorderPoint}
                  </span>
                </div>
              ))}
            </SectionCard>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Revenue this month:{" "}
            <span className="font-semibold text-slate-700">
              {currency(data.revenueThisMonthAud)}
            </span>{" "}
            · Click any work order or invoice for full detail.
          </div>
        </div>
      )}

      <WorkOrderQuickModal
        id={openWo}
        onClose={() => setOpenWo(null)}
      />
      <InvoiceQuickModal id={openInv} onClose={() => setOpenInv(null)} />
    </Card>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function MiniKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "default" | "warn" | "danger" | "good";
}) {
  const toneCls =
    tone === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneCls}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: "danger" | "warn" | "default";
  empty: string | null;
  children: React.ReactNode;
}) {
  const dotCls =
    tone === "danger"
      ? "bg-red-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-slate-400";
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotCls}`} aria-hidden />
          <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {count}
        </span>
      </div>
      <div className="space-y-1 p-2">
        {empty ? (
          <div className="px-2 py-3 text-xs text-slate-500">{empty}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SlaBreachRow({
  item,
  onClick,
}: {
  item: BriefingSlaBreach;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
    >
      <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
        {item.workOrder}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">
          {item.title}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {item.account} · breached {dateTime(item.slaDueAt)}
        </span>
      </span>
      <PriorityBadge value={item.priority} />
    </button>
  );
}

function OverdueInvoiceRow({
  item,
  onClick,
}: {
  item: BriefingOverdueInvoice;
  onClick: () => void;
}) {
  const days = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(item.dueAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
    >
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
        {item.invoice}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">
          {item.account}
        </span>
        <span className="block text-xs text-slate-500">
          due {date(item.dueAt)} · {days}d overdue
        </span>
      </span>
      <span className="text-sm font-semibold text-amber-700">
        {currency(item.total)}
      </span>
    </button>
  );
}

function MarginRow({
  item,
  onClick,
}: {
  item: BriefingMarginJob;
  onClick?: () => void;
}) {
  const negative = item.grossMarginPercent < 0;
  const inner = (
    <>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
        {item.workOrder}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
        {item.title}
      </span>
      <span className="text-xs text-slate-500">{currency(item.revenue)}</span>
      <span
        className={`min-w-[55px] text-right text-sm font-semibold ${
          negative ? "text-red-600" : "text-amber-700"
        }`}
      >
        {item.grossMarginPercent}%
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left">
      {inner}
    </div>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const cls =
    value === "URGENT"
      ? "bg-red-100 text-red-700"
      : value === "HIGH"
      ? "bg-amber-100 text-amber-700"
      : value === "LOW"
      ? "bg-slate-100 text-slate-500"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {value}
    </span>
  );
}

function SparkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-brand-600"
    >
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}

// ── Quick-detail modals ──────────────────────────────────────────────────

interface WorkOrderDetail {
  id: string;
  workOrderNumber: string;
  title: string;
  description?: string | null;
  jobType: string;
  priority: string;
  status: string;
  slaDueAt: string | null;
  scheduledStart: string | null;
  estimatedHours: number | null;
  account: { name: string };
  site: { name: string; address: string; suburb: string; state: string };
  assignedEmployee?: { firstName: string; lastName: string } | null;
  requiredSkills?: { skill: { name: string } }[];
  customerNotes?: string | null;
  internalNotes?: string | null;
  slaBreached?: boolean;
}

function WorkOrderQuickModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [wo, setWo] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fetch on open / id change. The cancel flag guards against the
  // user clicking a different row before the first request returns.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setWo(null);
    api
      .get<WorkOrderDetail>(`/work-orders/${id}`)
      .then((d) => {
        if (!cancelled) setWo(d);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Modal
      open={!!id}
      onClose={() => {
        setWo(null);
        onClose();
      }}
      title={wo ? `${wo.workOrderNumber} · ${wo.title}` : "Work order"}
    >
      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Loading…
        </div>
      )}
      {err && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>
      )}
      {wo && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge value={wo.priority} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {wo.status}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {wo.jobType}
            </span>
            {wo.slaBreached && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                SLA BREACHED
              </span>
            )}
          </div>

          {wo.description && (
            <p className="text-slate-700">{wo.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Detail label="Account" value={wo.account.name} />
            <Detail
              label="Site"
              value={`${wo.site.name} — ${wo.site.address}, ${wo.site.suburb} ${wo.site.state}`}
            />
            <Detail
              label="SLA due"
              value={wo.slaDueAt ? dateTime(wo.slaDueAt) : "—"}
            />
            <Detail
              label="Scheduled"
              value={wo.scheduledStart ? dateTime(wo.scheduledStart) : "—"}
            />
            <Detail
              label="Assigned"
              value={
                wo.assignedEmployee
                  ? `${wo.assignedEmployee.firstName} ${wo.assignedEmployee.lastName}`
                  : "Unassigned"
              }
            />
            <Detail
              label="Estimated"
              value={wo.estimatedHours ? `${wo.estimatedHours}h` : "—"}
            />
          </div>

          {wo.requiredSkills && wo.requiredSkills.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Required skills
              </div>
              <div className="flex flex-wrap gap-1">
                {wo.requiredSkills.map((s) => (
                  <span
                    key={s.skill.name}
                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                  >
                    {s.skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end border-t border-slate-100 pt-3">
            <Link
              to={`/work-orders/${wo.id}`}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Open full work order →
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  gst: number;
  total: number;
  issuedAt: string;
  dueAt: string;
  notes?: string | null;
  account: { name: string; primaryContactName: string; email: string; phone: string };
  workOrder?: { id: string; workOrderNumber: string; title: string } | null;
  overdue?: boolean;
}

function InvoiceQuickModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setInv(null);
    api
      .get<InvoiceDetail>(`/invoices/${id}`)
      .then((d) => {
        if (!cancelled) setInv(d);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const days = inv
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(inv.dueAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <Modal
      open={!!id}
      onClose={() => {
        setInv(null);
        onClose();
      }}
      title={inv ? `${inv.invoiceNumber} · ${inv.account.name}` : "Invoice"}
    >
      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Loading…
        </div>
      )}
      {err && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>
      )}
      {inv && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {inv.status}
            </span>
            {(inv.overdue || days > 0) && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                {days}d OVERDUE
              </span>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Total
              </span>
              <span className="text-lg font-semibold text-slate-800">
                {currency(inv.total)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-xs text-slate-500">
              <span>Subtotal {currency(inv.subtotal)}</span>
              <span>GST {currency(inv.gst)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Detail label="Issued" value={date(inv.issuedAt)} />
            <Detail label="Due" value={date(inv.dueAt)} />
            <Detail label="Contact" value={inv.account.primaryContactName} />
            <Detail label="Phone" value={inv.account.phone} />
            <Detail label="Email" value={inv.account.email} />
            {inv.workOrder && (
              <Detail
                label="Work order"
                value={`${inv.workOrder.workOrderNumber} — ${inv.workOrder.title}`}
              />
            )}
          </div>

          {inv.notes && (
            <div className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {inv.notes}
            </div>
          )}

          <div className="flex items-center justify-end border-t border-slate-100 pt-3">
            <Link
              to={`/invoices`}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Open invoices →
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}
