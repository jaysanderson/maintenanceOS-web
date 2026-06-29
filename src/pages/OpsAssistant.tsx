import { AiInfo } from "../components/AiInfo";
import { useState, useRef, useEffect, FormEvent } from "react";
import { Card, Button, inputCls } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { aiOpsAssistantStream, type OpsStreamStep, type OpsStepKind } from "../lib/ai";

const SUGGESTIONS = [
  "Which account has the most overdue invoices, and how much is outstanding?",
  "Which technician has the most open jobs right now?",
  "How many SLA breaches do we have and which accounts are affected?",
  "What jobs are scheduled this week and who's assigned?",
  "Where are we low on stock?",
];

/**
 * Ops Assistant — natural-language questions answered by the ARAG Retrieval
 * Agent, which queries the LIVE ERP through the MaintenanceOS MCP tools. The
 * agent's real work streams in — the plan, each live query it runs, then the
 * grounded answer — so the user watches it think, not a fake spinner.
 */
export default function OpsAssistant() {
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<OpsStreamStep[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [streamed, setStreamed] = useState("");
  const [lowConfidence, setLowConfidence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef(0);

  // Live elapsed timer while the agent runs.
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [running]);

  async function run(question: string) {
    if (!question.trim() || running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setAnswer(null);
    setStreamed("");
    setSteps([]);
    await aiOpsAssistantStream(
      question.trim(),
      {
        onProgress: (step) =>
          setSteps((s) => (s[s.length - 1]?.message === step.message ? s : [...s, step])),
        onAnswerChunk: (text) => setStreamed((a) => a + text),
        onAnswer: (text, low) => {
          setAnswer(text);
          setLowConfidence(low);
          setRunning(false);
        },
        onError: (m) => {
          setError(m);
          setRunning(false);
        },
      },
      ctrl.signal
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(q);
  }

  const queryCount = steps.filter((s) => s.kind === "tool").length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask anything about your live operation. An AI agent plans the question,
          queries the live ERP through your MCP tools, and writes a grounded
          answer — you'll watch every real step as it works.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="font-semibold">Ask the operation</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Retrieval Agent · live MCP
          </span>
          <AiInfo id="ops-assistant" />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. who's overbooked next week?"
            aria-label="Ask the ops assistant"
          />
          <Button type="submit" disabled={running || !q.trim()}>
            {running ? "Working…" : "Ask"}
          </Button>
        </form>

        {!answer && !running && !error && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQ(s);
                  run(s);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Live agent activity — the plan, each real query, then the answer. */}
        {(running || steps.length > 0) && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                {running ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                    </span>
                    Agent working
                  </>
                ) : (
                  <>
                    <span className="text-green-600">✓</span> Answered from live data
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                {queryCount > 0 && (
                  <span>
                    {queryCount} live quer{queryCount === 1 ? "y" : "ies"}
                  </span>
                )}
                <span className="tabular-nums">{elapsed.toFixed(1)}s</span>
              </div>
            </div>
            {running && (
              <div className="h-0.5 w-full overflow-hidden bg-slate-100">
                <div className="h-full w-1/3 animate-[opsbar_1.1s_ease-in-out_infinite] rounded-full bg-brand-500" />
              </div>
            )}
            <ol className="space-y-0.5 p-3">
              {steps.map((s, i) => {
                const active = running && i === steps.length - 1;
                return <StepRow key={i} step={s} active={active} />;
              })}
              {running && steps.length === 0 && (
                <li className="flex items-center gap-2.5 px-1 py-1 text-sm text-slate-400">
                  <Spinner /> Contacting the agent…
                </li>
              )}
            </ol>
          </div>
        )}

        {(answer || streamed) && (
          <div className={`rounded-xl p-4 ${lowConfidence ? "bg-amber-50" : "bg-brand-50/40"}`}>
            {lowConfidence ? (
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                <span aria-hidden>⚠</span> Couldn't answer from the live data
              </div>
            ) : (
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-700">
                <SparkIcon /> Grounded answer
              </div>
            )}
            <Markdown text={answer ?? streamed} />
          </div>
        )}
      </Card>

      {/* keyframes for the indeterminate progress bar */}
      <style>{`@keyframes opsbar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}

/** One step in the agent timeline, styled by kind. Tool steps split the
 *  "action · filter" message into a label + a query chip + a live-MCP tag. */
function StepRow({ step, active }: { step: OpsStreamStep; active: boolean }) {
  const [label, filter] = step.kind === "tool" ? splitTool(step.message) : [step.message, ""];
  const tint = KIND[step.kind].tint;
  return (
    <li className="flex items-start gap-2.5 px-1 py-1">
      <span className={`mt-0.5 shrink-0 ${active ? tint : "text-slate-300"}`}>
        {active ? <Spinner /> : KIND[step.kind].icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-sm ${active ? "font-medium text-slate-800" : "text-slate-500"}`}>{label}</span>
          {filter && (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{filter}</code>
          )}
          {step.kind === "tool" && (
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-500">
              live MCP
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function splitTool(message: string): [string, string] {
  const i = message.indexOf(" · ");
  return i === -1 ? [message, ""] : [message.slice(0, i), message.slice(i + 3)];
}

const KIND: Record<OpsStepKind, { tint: string; icon: JSX.Element }> = {
  plan: { tint: "text-indigo-500", icon: <PlanIcon /> },
  tool: { tint: "text-brand-600", icon: <DatabaseIcon /> },
  think: { tint: "text-slate-500", icon: <SearchIcon /> },
  write: { tint: "text-emerald-600", icon: <PenIcon /> },
};

function Spinner() {
  return <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />;
}
function PlanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function DatabaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-brand-600">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor" />
    </svg>
  );
}
