import { KnowledgeCopilot } from "../components/KnowledgeCopilot";

/**
 * F1 — Knowledge Copilot. Grounded, cited search over the UNSTRUCTURED
 * documents in the knowledge base (safety, policy and compliance docs) —
 * scoped to `doctype=policy` so it answers from documentation, not the live
 * ERP records (those belong to the Ops Assistant). Powered by Progress
 * Agentic RAG.
 */
export default function Copilot() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Knowledge Copilot</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search your safety, policy and compliance documents. Answers are
          grounded in the source documents and cite where they came from. For
          live operational questions (open jobs, SLA, invoices), use the Ops
          Assistant.
        </p>
      </div>
      <KnowledgeCopilot
        title="Search the knowledge base"
        placeholder="Ask about safety procedures, policies, compliance…"
        scopeFilters={[{ labelset: "doctype", label: "policy" }]}
        suggestions={[
          "What electrical isolation procedure should a technician follow?",
          "What safety steps apply to a two-storey gutter clean?",
          "What does our Working at Heights policy require?",
          "What PPE and controls apply to electrical work?",
        ]}
      />
    </div>
  );
}
