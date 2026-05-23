import { api } from "./api";

/** A label filter, e.g. { labelset: "doctype", label: "work-order" }. */
export interface AiFilter {
  labelset: string;
  label: string;
}

export interface AiCitation {
  resourceId: string;
  title: string;
  snippet?: string;
}

export interface AiAskResponse {
  answer: string;
  citations: AiCitation[];
  confidence?: number;
  lowConfidence?: boolean;
}

export interface AiFindHit {
  resourceId: string;
  slug?: string;
  title: string;
  snippet?: string;
}

export interface AiStatus {
  kb: boolean;
  agent: boolean;
}

/** Is the AI (ARAG) gateway configured server-side? */
export const aiStatus = () => api.get<AiStatus>("/ai/status");

/** F1 — grounded, cited answer from the knowledge base. */
export const aiAsk = (query: string, filters?: AiFilter[]) =>
  api.post<AiAskResponse>("/ai/ask", { query, filters });

/** Raw retrieval hits (no generation). */
export const aiFind = (query: string, filters?: AiFilter[], limit?: number) =>
  api.post<{ hits: AiFindHit[] }>("/ai/find", { query, filters, limit });

export type JobType =
  | "REPAIR"
  | "MAINTENANCE"
  | "INSPECTION"
  | "EMERGENCY"
  | "RECURRING_SERVICE";

export interface Playbook {
  title: string;
  requiredSkills: string[];
  typicalMaterials: string[];
  estimatedHours: number;
  steps: string[];
  safetyControls: string[];
}

export interface PlaybookResponse {
  jobDescription: string;
  jobType: JobType | null;
  playbook: Playbook | null;
  raw?: string;
  citations: AiCitation[];
  lowConfidence?: boolean;
  message?: string;
}

/** F2 — generate a structured Job Playbook grounded in history + safety docs. */
export const aiPlaybook = (jobDescription: string, jobType?: JobType) =>
  api.post<PlaybookResponse>("/ai/playbook", { jobDescription, jobType });

/** F2b — save a generated playbook as a reusable template (into the KB). */
export const aiSavePlaybook = (jobDescription: string, playbook: Playbook) =>
  api.post<{ saved: boolean; slug: string }>("/ai/playbook/save", {
    jobDescription,
    playbook,
  });

/** Multi-source Retrieval Agent (KB + live ERP via MCP). */
export const aiAgent = (question: string, args?: Record<string, unknown>) =>
  api.post<{ answer: string; warning?: string }>("/ai/agent", { question, args });

// ── Ops Assistant ────────────────────────────────────────────────────────
export interface OpsAssistantResponse {
  answer: string;
  lowConfidence: boolean;
  snapshotKeys: string[];
}
/** Ask a natural-language question over the live operations state. */
export const aiOpsAssistant = (question: string) =>
  api.post<OpsAssistantResponse>("/ai/ops-assistant", { question });

// ── F4 Daily Ops Briefing ────────────────────────────────────────────────
export interface BriefingResponse {
  briefing: string;
  data: Record<string, unknown>;
}
export const aiBriefing = () => api.get<BriefingResponse>("/ai/briefing");

// ── F5 Dispatcher Next-Best-Action ───────────────────────────────────────
export interface DispatchAction {
  workOrder: string;
  action: "ASSIGN" | "ESCALATE" | "RESCHEDULE";
  recommendedTechnician: string | null;
  reason: string;
}
export interface DispatchActionsResponse {
  actions: DispatchAction[] | null;
  raw?: string;
  context: Record<string, unknown>;
}
export const aiDispatchActions = (territory?: string) =>
  api.post<DispatchActionsResponse>("/ai/dispatch-actions", { territory });

// ── F3 Site-Adaptive Quote Drafting ──────────────────────────────────────
export interface QuoteDraft {
  labourHours: number;
  labourRate: number;
  materialCost: number;
  subcontractorCost: number;
  equipmentCost: number;
  travelCost: number;
  disposalCost: number;
  marginPercent: number;
  reasoning?: string;
}
export interface DraftQuoteResponse {
  draft: QuoteDraft | null;
  comparables: {
    workOrder: string;
    labourHours: number;
    materialCost: number;
    total: number;
    marginPercent: number;
  }[];
  raw?: string;
  lowConfidence?: boolean;
  message?: string;
}
export const aiDraftQuote = (workOrderId: string) =>
  api.post<DraftQuoteResponse>("/ai/draft-quote", { workOrderId });
