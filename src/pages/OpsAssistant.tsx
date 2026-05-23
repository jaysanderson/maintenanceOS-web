import { useState, FormEvent } from "react";
import { Card, Button, inputCls } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { aiOpsAssistant } from "../lib/ai";
import { ApiError } from "../lib/api";

const SUGGESTIONS = [
  "Which technicians have the most open jobs right now?",
  "How many SLA breaches do we have and which accounts are affected?",
  "Which recent jobs lost the most margin and why?",
  "What jobs are scheduled this week and who's assigned?",
  "Which accounts have the largest overdue invoices?",
  "Where are we low on stock?",
];

/**
 * "Ask your business" — NL questions over the live ERP state (open jobs,
 * SLA, invoices, technicians, margins, schedule, stock). Server gathers a
 * snapshot from Prisma and ARAG /predict/chat narrates a grounded answer.
 */
export default function OpsAssistant() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const r = await aiOpsAssistant(question.trim());
      setAnswer(r.answer);
      setLowConfidence(Boolean(r.lowConfidence));
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(q);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask anything about your live operation — SLA breaches, technician
          workload, schedule, margin risk, low stock, overdue invoices.
          Answers are grounded in the current ERP state and cite real work
          orders and invoices.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="font-semibold">Ask the operation</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Live data + ARAG
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
          <Button type="submit" disabled={loading || !q.trim()}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </form>

        {!answer && !loading && !error && (
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

        {loading && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Reading the current operations state…
          </div>
        )}

        {answer && (
          <div
            className={`rounded-lg p-4 ${
              lowConfidence ? "bg-amber-50" : "bg-slate-50"
            }`}
          >
            {lowConfidence && (
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                <span aria-hidden>⚠</span> Not in the current ops snapshot
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
