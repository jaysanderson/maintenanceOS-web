import { AiInfo } from "./AiInfo";
import { useState, useRef, useEffect, FormEvent } from "react";
import { aiAsk, type AiFilter } from "../lib/ai";
import { ApiError } from "../lib/api";
import { Markdown } from "./Markdown";

/**
 * Floating in-app Help assistant (bottom-right). Grounded, cited Q&A over the
 * MaintenanceOS user guide — Progress Agentic RAG /ask, scoped to the
 * `doctype=userguide` documents in the knowledge base. Answers only from the
 * guide; for live operational data the user has the Ops Assistant.
 */
const SCOPE: AiFilter[] = [{ labelset: "doctype", label: "userguide" }];

const SUGGESTIONS = [
  "How do I raise an invoice?",
  "How do I import a supplier bill?",
  "How do I assign a job to a technician?",
  "What can the AI Insights screen do?",
];

interface Msg {
  role: "you" | "assistant";
  text: string;
}

export function HelpChatbot() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading, open]);

  async function run(q: string) {
    const question = q.trim();
    if (!question || loading) return;
    setQuery("");
    setMsgs((m) => [...m, { role: "you", text: question }]);
    setLoading(true);
    try {
      const res = await aiAsk(question, SCOPE);
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: res.answer || "I couldn't find that in the user guide." },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? "The help assistant isn't available right now."
          : (e as Error).message;
      setMsgs((m) => [...m, { role: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <SparkIcon />
              <span className="text-sm font-semibold">Help</span>
              <AiInfo id="help-assistant" />
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                User guide
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close help"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Ask me how to do anything in MaintenanceOS — I answer from the user guide.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => run(s)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "you" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800">
                    <Markdown text={m.text} />
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                Searching the guide…
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about the app…"
              aria-label="Ask the help assistant"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
        aria-label={open ? "Close help" : "Open help"}
        title="Help — ask about the app"
      >
        {open ? <span className="text-xl leading-none">✕</span> : <HelpIcon />}
      </button>
    </div>
  );
}

function HelpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7v.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-brand-600" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor" />
    </svg>
  );
}
