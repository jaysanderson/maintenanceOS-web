import { api, uploadAuthed } from "./api";

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

// ── J1: Document Intelligence — Supplier doc → PO draft ──────────────────
export interface DraftPoLine {
  description: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedSku: string | null;
  matchBy: "sku" | "name" | null;
}
export interface PurchaseOrderDraft {
  supplierName: string | null;
  supplierRef: string | null;
  orderDate: string | null;
  expectedDate: string | null;
  currency: string | null;
  matchedSupplierId: string | null;
  matchedSupplierName: string | null;
  lines: DraftPoLine[];
}
export interface ExtractDocumentResponse {
  draft: PurchaseOrderDraft | null;
  lowConfidence: boolean;
  message?: string;
  model: string;
}
/** Upload a supplier document and get a draft purchase order back. */
export const aiExtractDocument = (file: File) =>
  uploadAuthed<ExtractDocumentResponse>("/ai/extract-document", file);

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
export interface BriefingSlaBreach {
  id: string;
  workOrder: string;
  title: string;
  account: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  slaDueAt: string;
}
export interface BriefingOverdueInvoice {
  id: string;
  invoice: string;
  account: string;
  total: number;
  dueAt: string;
}
export interface BriefingMarginJob {
  id: string;
  workOrder: string;
  title: string;
  grossMarginPercent: number;
  revenue: number;
}
export interface BriefingLowStockItem {
  name: string;
  available: number;
  reorderPoint: number;
}
export interface BriefingData {
  openWorkOrders: number;
  unassignedJobs: number;
  jobsDueToday: number;
  slaBreaches: number;
  slaBreachedJobs: BriefingSlaBreach[];
  overdueInvoices: BriefingOverdueInvoice[];
  revenueThisMonthAud: number;
  lowStockItems: BriefingLowStockItem[];
  worstMarginJobs: BriefingMarginJob[];
}
export interface BriefingResponse {
  /** Short AI-generated executive headline (2-3 sentences). */
  briefing: string;
  /** Structured snapshot — drives the interactive dashboard sections. */
  data: BriefingData;
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

// ── Tier 1 AI assists (Themes B/C/D/E/F/H/I/K/L) ─────────────────────────
// Responses vary in shape; each carries a primary text field (narrative /
// draft / answer / summary / analysis / suggestions) plus structured data.

// L1 — duplicate / callback / warranty detection
export interface SimilarWoResponse {
  duplicates: { workOrder: string; reason: string; confidence: string }[];
  callbacks: { workOrder: string; reason: string; confidence: string }[];
  summary: string;
  checked: number;
}
export const aiSimilarWorkOrders = (workOrderId: string) =>
  api.post<SimilarWoResponse>("/ai/similar-work-orders", { workOrderId });

// L2 — parts kit
export interface PartsKitResponse {
  kit: { sku: string; name: string; quantity: number; reason: string }[];
  usage: { sku: string; name: string; jobsUsedOn: number; avgQty: number }[];
  lowConfidence: boolean;
  message?: string;
}
export const aiPartsKit = (workOrderId: string) =>
  api.post<PartsKitResponse>("/ai/parts-kit", { workOrderId });

// L3 — technician day plan
export interface DayPlanResponse {
  technician: string;
  date: string;
  jobs: { workOrder: string; title: string; site: string; start: string | null; end: string | null; priority: string }[];
  clashes: { a: string; b: string }[];
  narrative: string;
}
export const aiDayPlan = (employeeId: string, date?: string) =>
  api.post<DayPlanResponse>("/ai/day-plan", { employeeId, date });

// H1/H3/H4/H5 + K2/K3 + D3 — work-order-scoped assists
export interface TextDraftResponse { draft: string; lowConfidence?: boolean; message?: string }
export const aiCompletionNote = (workOrderId: string) =>
  api.post<TextDraftResponse>("/ai/completion-note", { workOrderId });
export interface TimelineResponse { events: { when: string; event: string }[]; narrative: string }
export const aiWorkOrderTimeline = (workOrderId: string) =>
  api.post<TimelineResponse>("/ai/work-order-timeline", { workOrderId });
export interface SiteBriefingResponse { site: Record<string, unknown>; briefing: string }
export const aiSiteAccessBriefing = (workOrderId: string) =>
  api.post<SiteBriefingResponse>("/ai/site-access-briefing", { workOrderId });
export interface TimeAnomalyResponse { workOrder: string; loggedHours: number; typicalHours: number; comparableJobs: number; flagged: boolean; narrative: string }
export const aiTimeAnomaly = (workOrderId: string) =>
  api.post<TimeAnomalyResponse>("/ai/time-anomaly", { workOrderId });
export interface VariationResponse { workOrder: string; quoted: { hours: number; total: number } | null; actual: { hours: number; cost: number; revenue: number }; variance: { hours: number; marginPercent: number }; draft: string; flagged: boolean }
export const aiVariationClaim = (workOrderId: string) =>
  api.post<VariationResponse>("/ai/variation-claim", { workOrderId });
export const aiCustomerStatusUpdate = (workOrderId: string) =>
  api.post<{ workOrder: string; status: string; draft: string }>("/ai/customer-status-update", { workOrderId });
export interface SafetyPreflightResponse {
  workOrder: string;
  assignedTechnician: string | null;
  requiredSkills: string[];
  heldSkills: string[];
  missingSkills: string[];
  safetyGuidance: string;
  citations: { title: string }[];
}
export const aiSafetyPreflight = (workOrderId: string) =>
  api.post<SafetyPreflightResponse>("/ai/safety-preflight", { workOrderId });

// I2/K1/E2 — account-scoped
export interface AccountHealthResponse { account: string; metrics: Record<string, number>; narrative: string }
export const aiAccountHealth = (accountId: string) =>
  api.post<AccountHealthResponse>("/ai/account-health", { accountId });
export const aiProactiveMaintenance = (accountId: string) =>
  api.post<{ account: string; history: { jobType: string; count: number; lastDone: string | null }[]; suggestions: string; lowConfidence: boolean }>("/ai/proactive-maintenance", { accountId });
export const aiRecurringSuggest = (accountId: string) =>
  api.post<{ account: string; cadence: { jobType: string; count: number }[]; suggestion: string; lowConfidence: boolean }>("/ai/recurring-suggest", { accountId });

// C1/C2 — quote-scoped
export interface QuoteRiskResponse { quote: string; marginPercent: number; comparableAvgMargin: number; narrative: string }
export const aiQuoteRisk = (quoteId: string) =>
  api.post<QuoteRiskResponse>("/ai/quote-risk", { quoteId });
export const aiQuoteComms = (quoteId: string, kind: "cover" | "followup" = "cover") =>
  api.post<{ quote: string; kind: string; draft: string }>("/ai/quote-comms", { quoteId, kind });

// I3 — invoice dunning
export const aiDunningDraft = (invoiceId: string) =>
  api.post<{ invoice: string; account: string; daysOverdue: number; draft: string }>("/ai/dunning-draft", { invoiceId });

// D1 — intake triage
export interface TriageResponse {
  triage: { jobType: string; priority: string; requiredSkills: string[]; suggestedSlaHours: number; summary: string } | null;
  raw?: string;
}
export const aiTriage = (request: string) =>
  api.post<TriageResponse>("/ai/triage", { request });

// F3 — audit assistant
export const aiAuditAssistant = (question: string) =>
  api.post<{ answer: string; lowConfidence: boolean; entriesScanned: number }>("/ai/audit-assistant", { question });

// Org-wide analyses (no body) — each returns a narrative + structured data.
export const aiLostQuotes = () =>
  api.post<{ rejectedCount: number; byJobType: Record<string, number>; analysis: string; lowConfidence: boolean }>("/ai/lost-quotes", {});
export const aiFleetCompliance = () =>
  api.post<{ dueVehicles: { name: string; registration: string; serviceDueAt: string | null; registrationDueAt: string | null }[]; narrative: string }>("/ai/fleet-compliance", {});
export const aiRecurringPreview = () =>
  api.post<{ plansDue: { title: string; account: string; site: string; nextRunAt: string | null }[]; narrative: string }>("/ai/recurring-preview", {});
export const aiDemandReorder = () =>
  api.post<{ lowStock: { name: string; available: number; reorderPoint: number }[]; upcomingJobs: number; narrative: string }>("/ai/demand-reorder", {});
export const aiSkillGap = () =>
  api.post<{ uncoveredSkills: { skill: string; openJobsNeeding: number; activeHolders: number }[]; narrative: string }>("/ai/skill-gap", {});
export const aiSlaEarlyWarning = () =>
  api.post<{ atRisk: { workOrder: string; account: string; slaDueAt: string | null; assigned: string | null; priority: string }[]; narrative: string }>("/ai/sla-early-warning", {});
export const aiMarginInsight = () =>
  api.post<{ byJobType: { jobType: string; jobs: number; avgMarginPercent: number }[]; narrative: string }>("/ai/margin-insight", {});
export const aiExecSummary = () =>
  api.post<{ summary: string; data: Record<string, unknown> }>("/ai/exec-summary", {});
