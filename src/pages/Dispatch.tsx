import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useList, useApiMutation } from "../lib/hooks";
import { api, dateTime } from "../lib/api";
import { WorkOrder, Employee } from "../lib/types";
import { PageState, Card, Badge, Button, inputCls } from "../components/ui";
import { DispatchActions } from "../components/DispatchActions";
import { AiText } from "../components/AiAssist";
import { AiInfo } from "../components/AiInfo";
import { aiDayPlan, DayPlanResponse } from "../lib/ai";

const ACTIVE = ["SCHEDULED", "DISPATCHED", "IN_PROGRESS", "WAITING_ON_PARTS"];

export default function Dispatch() {
  const nav = useNavigate();
  const orders = useList<WorkOrder[]>("/work-orders?");
  const employees = useList<Employee[]>("/employees?active=true");

  const assign = useApiMutation(
    ({ id, employeeId }: { id: string; employeeId: string | null }) =>
      api.patch(`/work-orders/${id}/assign`, { assignedEmployeeId: employeeId }),
    ["/work-orders", "/dashboard"]
  );

  const all = orders.data ?? [];
  const unassigned = all.filter(
    (w) => !w.assignedEmployeeId && !["COMPLETED", "INVOICED", "CLOSED", "CANCELLED"].includes(w.status)
  );
  const today = new Date();
  const isToday = (d?: string | null) =>
    d && new Date(d).toDateString() === today.toDateString();
  const todays = all.filter((w) => isToday(w.scheduledStart));
  const techs = (employees.data ?? []).filter((e) =>
    ["TECHNICIAN", "SENIOR_TECHNICIAN"].includes(e.role)
  );

  return (
    <PageState loading={orders.isLoading} error={orders.error}>
      <div className="space-y-6">
        <DispatchActions />
        <DayPlanCard techs={techs} workOrders={all} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <Header title="Unassigned Work Orders" count={unassigned.length} tone="warn" />
            <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
              {unassigned.length === 0 && <Empty>All work orders are assigned.</Empty>}
              {unassigned.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="cursor-pointer" onClick={() => nav(`/work-orders/${w.id}`)}>
                    <div className="font-medium text-brand-600">{w.workOrderNumber}</div>
                    <div className="text-slate-600">{w.title}</div>
                    <div className="text-xs text-slate-400">{w.site?.suburb}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge value={w.priority} />
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      defaultValue=""
                      onChange={(e) =>
                        assign.mutate({ id: w.id, employeeId: e.target.value || null })
                      }
                    >
                      <option value="">Assign…</option>
                      {techs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Header title="Scheduled Today" count={todays.length} />
            <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
              {todays.length === 0 && <Empty>Nothing scheduled for today.</Empty>}
              {todays.map((w) => (
                <div
                  key={w.id}
                  className="flex cursor-pointer items-center justify-between p-3 text-sm hover:bg-slate-50"
                  onClick={() => nav(`/work-orders/${w.id}`)}
                >
                  <div>
                    <div className="font-medium text-brand-600">{w.workOrderNumber}</div>
                    <div className="text-slate-600">{w.title}</div>
                    <div className="text-xs text-slate-400">{dateTime(w.scheduledStart)}</div>
                  </div>
                  <div className="text-right">
                    <Badge value={w.status} />
                    <div className="mt-1 text-xs text-slate-500">
                      {w.assignedEmployee
                        ? `${w.assignedEmployee.firstName} ${w.assignedEmployee.lastName}`
                        : "Unassigned"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <Header title="Technician Schedule (Active Jobs)" count={techs.length} />
          <div className="grid grid-cols-1 gap-px bg-slate-100 md:grid-cols-2 lg:grid-cols-3">
            {techs.map((t) => {
              const jobs = all.filter(
                (w) => w.assignedEmployeeId === t.id && ACTIVE.includes(w.status)
              );
              return (
                <div key={t.id} className="bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      {t.firstName} {t.lastName}
                    </span>
                    <span className="text-xs text-slate-400">{t.territory}</span>
                  </div>
                  {jobs.length === 0 ? (
                    <p className="text-xs text-slate-400">No active jobs</p>
                  ) : (
                    <ul className="space-y-1">
                      {jobs.map((j) => (
                        <li
                          key={j.id}
                          className="cursor-pointer rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100"
                          onClick={() => nav(`/work-orders/${j.id}`)}
                        >
                          {j.workOrderNumber} · {j.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageState>
  );
}

function Header({ title, count, tone }: { title: string; count: number; tone?: "warn" }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
      <h2 className="font-semibold">{title}</h2>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-6 text-sm text-slate-500">{children}</div>;
}

function DayPlanCard({ techs, workOrders }: { techs: Employee[]; workOrders: WorkOrder[] }) {
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<DayPlanResponse | null>(null);
  const ranRef = useRef(false);

  // Find the busiest technician-day on the board so the card always has a
  // populated, live example to show — no guessing which tech or date.
  const techIds = useMemo(() => new Set(techs.map((t) => t.id)), [techs]);
  const best = useMemo(() => {
    const counts = new Map<string, { emp: string; date: string; n: number }>();
    for (const w of workOrders) {
      if (!w.scheduledStart || !w.assignedEmployeeId || !techIds.has(w.assignedEmployeeId)) continue;
      const d = new Date(w.scheduledStart).toISOString().slice(0, 10);
      const key = `${w.assignedEmployeeId}|${d}`;
      const cur = counts.get(key) ?? { emp: w.assignedEmployeeId, date: d, n: 0 };
      cur.n++;
      counts.set(key, cur);
    }
    return [...counts.values()].sort((a, b) => b.n - a.n)[0] ?? null;
  }, [workOrders, techIds]);
  const bestTech = best ? techs.find((t) => t.id === best.emp) : null;

  async function run(eId = empId, d = date) {
    if (!eId) return;
    setLoading(true);
    setPlan(null);
    try {
      setPlan(await aiDayPlan(eId, d || undefined));
    } finally {
      setLoading(false);
    }
  }

  // Pre-fill the busiest tech/day and run it once on mount so the demo lands
  // on a real, non-empty result immediately.
  useEffect(() => {
    if (best && !ranRef.current) {
      ranRef.current = true;
      setEmpId(best.emp);
      setDate(best.date);
      run(best.emp, best.date);
    }
  }, [best]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Technician day-plan</h3>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">ARAG</span>
        <AiInfo id="day-plan" />
        <div className="ml-auto flex items-center gap-2">
          <select className={`${inputCls} max-w-[180px]`} value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select technician…</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
          <input type="date" className={`${inputCls} max-w-[160px]`} value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="secondary" disabled={!empId || loading} onClick={() => run()}>
            {loading ? "Planning…" : "Plan day"}
          </Button>
        </div>
      </div>
      {!plan && !loading && bestTech && best && (
        <p className="text-xs text-slate-500">
          Pre-filled to <span className="font-medium text-slate-700">{bestTech.firstName} {bestTech.lastName}</span> on{" "}
          {best.date} — the busiest day on the board ({best.n} job{best.n === 1 ? "" : "s"}). Click <span className="font-medium">Plan day</span>.
        </p>
      )}
      {plan && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">
            {plan.technician} · {plan.date} · {plan.jobs.length} job{plan.jobs.length === 1 ? "" : "s"}
            {plan.clashes.length > 0 && <span className="ml-1 font-medium text-amber-700">· {plan.clashes.length} clash(es)</span>}
          </div>
          <AiText text={plan.narrative} low={plan.clashes.length > 0} />
        </div>
      )}
    </Card>
  );
}
