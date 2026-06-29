import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AI_FEATURES, type AiFeatureInfo, type AiLayer } from "../lib/aiFeatureInfo";

const LAYER_CLASS: Record<AiLayer, string> = {
  "Agentic RAG": "bg-white/15 ring-white/30",
  "MCP Server": "bg-white/15 ring-white/30",
  "Retrieval Agent (RAO)": "bg-white/15 ring-white/30",
  "Visual LLM": "bg-white/15 ring-white/30",
  "Human-in-the-loop": "bg-white/15 ring-white/30",
};

/**
 * Small sparkle button placed beside any AI feature. Click → a ¾-screen modal
 * explaining what the feature does, how it works behind the scenes, why it's
 * valuable, and the problem it solves. Content lives in lib/aiFeatureInfo.ts.
 */
export function AiInfo({ id, className = "" }: { id: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const info = AI_FEATURES[id];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!info) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title={`What is "${info.name}"? How it works & why it matters`}
        aria-label={`About the ${info.name} AI feature`}
        className={`group inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-200 transition hover:scale-110 hover:bg-brand-100 hover:text-brand-700 ${className}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.5l1.7 4.8L18.5 9l-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7L12 2.5z" />
        </svg>
      </button>
      {open && createPortal(<Modal info={info} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Modal({ info, onClose }: { info: AiFeatureInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-[78vw] max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-600 via-brand-600 to-indigo-600 px-8 py-7 text-white">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.7 4.8L18.5 9l-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7L12 2.5z" /></svg>
            AI Feature
          </div>
          <h2 className="mt-2 text-2xl font-bold leading-tight">{info.name}</h2>
          <p className="mt-1 max-w-2xl text-[15px] text-white/85">{info.tagline}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {info.layers.map((l) => (
              <span key={l} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${LAYER_CLASS[l]}`}>{l}</span>
            ))}
            <code className="rounded bg-black/25 px-2 py-1 font-mono text-[11px] text-white/90">{info.route}</code>
          </div>
        </div>

        {/* Body */}
        <div className="grid gap-4 overflow-y-auto p-6 sm:grid-cols-2 sm:p-8">
          <Section accent="from-brand-500 to-brand-600" icon={<IconBolt />} title="What it does" body={info.what} />
          <Section accent="from-indigo-500 to-indigo-600" icon={<IconCog />} title="How it works (behind the scenes)" body={info.how} />
          <Section accent="from-emerald-500 to-emerald-600" icon={<IconStar />} title="Why it's valuable" body={info.why} />
          <Section accent="from-rose-500 to-rose-600" icon={<IconAlert />} title="The problem it solves" body={info.problem} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-8 py-3">
          <span className="text-[11px] text-slate-400">
            Powered by Progress Agentic RAG · OpenEdge MCP Server · Retrieval Agent — with human-in-the-loop on every write
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ accent, icon, title, body }: { accent: string; icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white`}>{icon}</span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function IconBolt() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>;
}
function IconCog() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 6 8.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .9 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.8 1z" />
    </svg>
  );
}
function IconStar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-.9L12 2z" /></svg>;
}
function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}
