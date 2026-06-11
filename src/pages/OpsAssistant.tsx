import { useState, useRef, FormEvent } from "react";
import { Card, Button, inputCls } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { aiOpsAssistantStream } from "../lib/ai";

const SUGGESTIONS = [
  "How many work orders are currently open?",
  "Which technician has the most open jobs right now?",
  "How many SLA breaches do we have and which accounts are affected?",
  "Which accounts have the largest overdue invoices?",
  "What jobs are scheduled this week and who's assigned?",
  "Where are we low on stock?",
];

/**
 * Ops Assistant — natural-language questions answered by the ARAG Retrieval
 * Agent, which queries the LIVE ERP through the MaintenanceOS MCP tools. The
 * agent's progress streams in (planning → querying → writing) so the user
 * sees what's happening while it works.
 */
export default function OpsAssistant() {
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(question: string) {
    if (!question.trim() || running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setAnswer(null);
    setSteps([]);
    await aiOpsAssistantStream(
      question.trim(),
      {
        onProgress: (m) =>
          setSteps((s) => (s[s.length - 1] === m ? s : [...s, m])),
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask anything about your live operation. An AI agent plans the
          question, queries the live ERP through your MCP tools, and writes a
          grounded answer — you'll see each step as it works.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="font-semibold">Ask the operation</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Retrieval Agent · live MCP
          </span>
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

        {/* Live activity log — keeps the user company while the agent runs */}
        {(running || (steps.length > 0 && answer)) && (
          <ol className="space-y-1.5 rounded-lg bg-slate-50 p-3">
            {steps.map((s, i) => {
              const isLast = i === steps.length - 1;
              const active = running && isLast;
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
            {running && steps.length === 0 && (
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                Contacting the agent…
              </li>
            )}
          </ol>
        )}

        {answer && (
          <div className={`rounded-lg p-4 ${lowConfidence ? "bg-amber-50" : "bg-brand-50/40"}`}>
            {lowConfidence && (
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                <span aria-hidden>⚠</span> Couldn't answer from the live data
              </div>
            )}
            <Markdown text={answer} />
          </div>
        )}
      </Card>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-brand-600">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
