import { KnowledgeCopilot } from "../components/KnowledgeCopilot";

/**
 * F1 — global Knowledge Copilot page. Grounded, cited Q&A across the whole
 * MaintenanceOS knowledge base (work orders, accounts, quotes, invoices,
 * and safety/policy docs) via Progress Agentic RAG.
 */
export default function Copilot() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Knowledge Copilot</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask anything about your operation. Answers are grounded in your live
          ERP data and safety documentation, with sources cited.
        </p>
      </div>
      <KnowledgeCopilot
        title="Ask the operation"
        suggestions={[
          "Which accounts have SLA-breached work orders right now?",
          "What safety steps apply to a two-storey gutter clean?",
          "Which recent jobs are at margin risk and why?",
          "What electrical isolation procedure should a tech follow?",
        ]}
      />
    </div>
  );
}
