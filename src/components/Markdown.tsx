/**
 * Tiny dependency-free markdown renderer for LLM output (briefings, answers).
 * Handles: # / ## / ### headings, - / * bullets (with indent), 1. numbered
 * lists, **bold**, `code`, and paragraphs. Not a full CommonMark parser —
 * just enough for the AI features, with HTML escaped for safety.
 */
import { ReactNode } from "react";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline: **bold** and `code` on already-escaped text. */
function inline(s: string): { __html: string } {
  const html = escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, '<code class="rounded bg-slate-100 px-1 text-[0.85em]">$1</code>');
  return { __html: html };
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: { content: string; indent: boolean }[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className={it.indent ? "ml-5" : ""} dangerouslySetInnerHTML={inline(it.content)} />
    ));
    out.push(
      list.type === "ol" ? (
        <ol key={`l${out.length}`} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={`l${out.length}`} className="list-disc space-y-1 pl-5">{items}</ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      const cls = level === 1 ? "text-base font-semibold" : "text-sm font-semibold";
      out.push(<div key={`h${out.length}`} className={`${cls} mt-1 text-slate-800`} dangerouslySetInnerHTML={inline(h[2])} />);
      continue;
    }
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!list || list.type !== "ul") { flush(); list = { type: "ul", items: [] }; }
      list.items.push({ content: bullet[2], indent: bullet[1].length >= 2 });
      continue;
    }
    const num = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (num) {
      if (!list || list.type !== "ol") { flush(); list = { type: "ol", items: [] }; }
      list.items.push({ content: num[2], indent: num[1].length >= 2 });
      continue;
    }
    flush();
    out.push(<p key={`p${out.length}`} dangerouslySetInnerHTML={inline(line)} />);
  }
  flush();

  return <div className={`space-y-2 text-sm leading-relaxed text-slate-800 ${className}`}>{out}</div>;
}
