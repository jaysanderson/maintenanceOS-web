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
}

/** F2 — generate a structured Job Playbook grounded in history + safety docs. */
export const aiPlaybook = (jobDescription: string, jobType?: JobType) =>
  api.post<PlaybookResponse>("/ai/playbook", { jobDescription, jobType });

/** Multi-source Retrieval Agent (KB + live ERP via MCP). */
export const aiAgent = (question: string, args?: Record<string, unknown>) =>
  api.post<{ answer: string; warning?: string }>("/ai/agent", { question, args });
