import { AiInfo } from "./AiInfo";
import { useState, FormEvent } from "react";
import { Card, Button, inputCls } from "./ui";
import { Markdown } from "./Markdown";
import { aiAsk, type AiFilter, type AiCitation } from "../lib/ai";
import { ApiError } from "../lib/api";

/**
 * F1 — Knowledge Copilot. Grounded, cited Q&A over the MaintenanceOS
 * knowledge base (Progress Agentic RAG). All AI runs server-side via
 * /api/ai/ask; this component just collects a question and renders the
 * cited answer.
 *
 * Pass `scopeFilters` to constrain retrieval (e.g. to one account), and
 * `suggestions` for one-tap example prompts.
 */
export function KnowledgeCopilot({
  title = "Knowledge Copilot",
  subtitle,
  scopeFilters,
  suggestions = [],
  placeholder = "Ask about jobs, accounts, safety procedures…",
}: {
  title?: string;
  subtitle?: string;
  scopeFilters?: AiFilter[];
  suggestions?: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    try {
      const res = await aiAsk(q.trim(), scopeFilters);
      setAnswer(res.answer || "No answer returned.");
      setCitations(res.citations ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? "AI is not configured on the server yet."
          : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query);
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="font-semibold">{title}</h3>
          <AiInfo id="knowledge-copilot" />
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            Agentic RAG
          </span>
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className={inputCls}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the knowledge copilot"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {suggestions.length > 0 && !answer && !loading && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
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
          Searching the knowledge base…
        </div>
      )}

      {answer && (
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <Markdown text={answer} />
          </div>
          {citations.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {citations.map((c) => (
                  <span
                    key={c.resourceId}
                    title={c.snippet}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  >
                    {c.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
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
