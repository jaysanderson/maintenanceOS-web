import { ReactNode, useState } from "react";
import { Card, Button } from "./ui";
import { Markdown } from "./Markdown";
import { ApiError } from "../lib/api";
import { AiInfo } from "./AiInfo";

/** Standard amber/slate box for a generated narrative or draft. */
export function AiText({ text, low }: { text: string; low?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-sm ${low ? "bg-amber-50" : "bg-slate-50"}`}>
      <Markdown text={text} />
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-brand-600">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor" />
    </svg>
  );
}

/**
 * Generic "click → call an AI endpoint → render the result" card. Handles
 * loading / error / 503-not-configured. `render` shapes the response; most
 * callers use `AiText` for the narrative plus any structured bits.
 */
export function AiAssist<T>({
  title,
  description,
  badge = "ARAG",
  label = "Generate",
  run,
  render,
  autoRunKey,
  infoId,
}: {
  title: string;
  description?: string;
  badge?: string;
  label?: string;
  run: () => Promise<T>;
  render: (data: T) => ReactNode;
  /** Change this value to reset the card (e.g. when the parent id changes). */
  autoRunKey?: string;
  /** AI-feature id for the "what is this?" info popup (lib/aiFeatureInfo.ts). */
  infoId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | undefined>(autoRunKey);

  if (autoRunKey !== shownFor) {
    // parent context changed — clear stale result
    setShownFor(autoRunKey);
    setData(null);
    setError(null);
  }

  async function go() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await run());
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? "AI isn't configured on the server."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
            {badge}
          </span>
          {infoId && <AiInfo id={infoId} />}
        </div>
        <Button variant="secondary" onClick={go} disabled={loading}>
          {loading ? "Thinking…" : label}
        </Button>
      </div>
      {description && !data && !loading && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Working…
        </div>
      )}
      {data !== null && <div>{render(data)}</div>}
    </Card>
  );
}

/** Helper to pick the primary narrative field from a varied AI response. */
export function primaryText(d: Record<string, unknown>): string {
  for (const k of [
    "narrative",
    "draft",
    "answer",
    "summary",
    "analysis",
    "suggestions",
    "suggestion",
    "briefing",
    "safetyGuidance",
  ]) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/** Small confidence chip used by several panels. */
export function ConfidenceChip({ value }: { value: string }) {
  const cls =
    value === "high"
      ? "bg-red-100 text-red-700"
      : value === "medium"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}>
      {value}
    </span>
  );
}

export type { ReactNode };
