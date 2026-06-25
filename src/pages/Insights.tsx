import { useState, FormEvent } from "react";
import { Card, Button, Badge, inputCls } from "../components/ui";
import { AiAssist, AiText, primaryText } from "../components/AiAssist";
import { RiskWatchlist, CostExceptions, ComplianceReadiness } from "../components/OpsPanels";
import { Markdown } from "../components/Markdown";
import { ApiError } from "../lib/api";
import {
  aiExecSummary,
  aiSlaEarlyWarning,
  aiMarginInsight,
  aiLostQuotes,
  aiDemandReorder,
  aiSkillGap,
  aiFleetCompliance,
  aiRecurringPreview,
  aiAuditAssistant,
  aiTriage,
} from "../lib/ai";

/**
 * AI Insights — org-wide ARAG-powered analyses over the live ERP, plus two
 * interactive tools (intake triage, audit Q&A). Every analysis is grounded
 * in current data and degrades to a friendly message when there's nothing
 * to report.
 */
export default function Insights() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI Insights</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live, grounded analyses across the whole operation. Each card asks
          ARAG to narrate the current state — figures come from the database,
          never invented.
        </p>
      </div>

      <RiskWatchlist />
      <div className="grid gap-4 lg:grid-cols-2">
        <CostExceptions />
        <ComplianceReadiness />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AiAssist
          title="Executive summary"
          description="Board-ready monthly operations summary from live KPIs."
          label="Write summary"
          run={aiExecSummary}
          render={(d) => <AiText text={d.summary} />}
        />

        <AiAssist
          title="SLA early-warning"
          description="Jobs approaching an SLA breach + the recommended action."
          label="Check SLA risk"
          run={aiSlaEarlyWarning}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                {d.atRisk.length} job{d.atRisk.length === 1 ? "" : "s"} within the window
              </div>
              <AiText text={d.narrative} />
            </div>
          )}
        />

        <AiAssist
          title="Margin insight"
          description="Where margin is leaking, by job type."
          label="Analyse margin"
          run={aiMarginInsight}
          render={(d) => (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {d.byJobType.slice(0, 6).map((j) => (
                  <span key={j.jobType} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {j.jobType}: {j.avgMarginPercent}%
                  </span>
                ))}
              </div>
              <AiText text={d.narrative} />
            </div>
          )}
        />

        <AiAssist
          title="Lost-quote analysis"
          description="Why we're losing quotes — patterns in rejected/expired work."
          label="Analyse losses"
          run={aiLostQuotes}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">{d.rejectedCount} rejected/expired quotes</div>
              <AiText text={d.analysis} low={d.lowConfidence} />
            </div>
          )}
        />

        <AiAssist
          title="Demand-aware reorder"
          description="What to reorder, weighted by upcoming scheduled work."
          label="Suggest reorders"
          run={aiDemandReorder}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                {d.lowStock.length} low-stock item{d.lowStock.length === 1 ? "" : "s"} · {d.upcomingJobs} jobs in the next 14 days
              </div>
              <AiText text={d.narrative} />
            </div>
          )}
        />

        <AiAssist
          title="Skill-coverage gaps"
          description="Skills required by open jobs with too few active holders."
          label="Check coverage"
          run={aiSkillGap}
          render={(d) => (
            <div className="space-y-2">
              {d.uncoveredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.uncoveredSkills.map((s) => (
                    <span key={s.skill} className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                      {s.skill}: {s.activeHolders} holder{s.activeHolders === 1 ? "" : "s"} / {s.openJobsNeeding} jobs
                    </span>
                  ))}
                </div>
              )}
              <AiText text={d.narrative} />
            </div>
          )}
        />

        <AiAssist
          title="Fleet compliance"
          description="Vehicles with service or registration due soon."
          label="Check fleet"
          run={aiFleetCompliance}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">{d.dueVehicles.length} vehicle(s) due soon</div>
              <AiText text={d.narrative} />
            </div>
          )}
        />

        <AiAssist
          title="Recurring-run preview"
          description="What the next recurring run would create, with batching tips."
          label="Preview run"
          run={aiRecurringPreview}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">{d.plansDue.length} plan(s) due</div>
              <AiText text={d.narrative} />
            </div>
          )}
        />
      </div>

      <TriageCard />
      <AuditCard />
    </div>
  );
}

function TriageCard() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Awaited<ReturnType<typeof aiTriage>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      setRes(await aiTriage(text.trim()));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const t = res?.triage;
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Smart job intake</h3>
      <p className="text-xs text-slate-500">
        Paste a customer request — ARAG classifies job type, priority, skills and a suggested SLA.
      </p>
      <form onSubmit={go} className="flex gap-2">
        <input
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. tenant reports a burst pipe flooding the kitchen, urgent"
        />
        <Button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Triaging…" : "Triage"}
        </Button>
      </form>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {t && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge value={t.jobType} />
          <Badge value={t.priority} />
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">SLA ~{t.suggestedSlaHours}h</span>
          {t.requiredSkills.map((s) => (
            <span key={s} className="rounded bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">{s}</span>
          ))}
          <div className="w-full text-slate-600">{t.summary}</div>
        </div>
      )}
      {res && !t && res.raw && <AiText text={res.raw} low />}
    </Card>
  );
}

function AuditCard() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [ans, setAns] = useState<{ answer: string; lowConfidence: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    setAns(null);
    try {
      setAns(await aiAuditAssistant(q.trim()));
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.status === 503 ? "AI isn't configured." : (e2 as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Audit assistant</h3>
      <p className="text-xs text-slate-500">
        Ask a natural-language question about the audit log (e.g. “who changed settings recently?”).
      </p>
      <form onSubmit={go} className="flex gap-2">
        <input
          className={inputCls}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What happened in the audit log recently?"
        />
        <Button type="submit" disabled={loading || !q.trim()}>
          {loading ? "Asking…" : "Ask"}
        </Button>
      </form>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {ans && (
        <div className={`rounded-lg p-3 text-sm ${ans.lowConfidence ? "bg-amber-50" : "bg-slate-50"}`}>
          <Markdown text={ans.answer} />
        </div>
      )}
    </Card>
  );
}

// primaryText kept available for future cards
void primaryText;
