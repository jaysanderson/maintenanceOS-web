import { AiAssist, AiText, ConfidenceChip } from "./AiAssist";
import {
  aiSimilarWorkOrders,
  aiSafetyPreflight,
  aiPartsKit,
  aiSiteAccessBriefing,
  aiCompletionNote,
  aiWorkOrderTimeline,
  aiTimeAnomaly,
  aiVariationClaim,
  aiCustomerStatusUpdate,
} from "../lib/ai";

/**
 * The AI cockpit for a single work order — every ARAG assist scoped to this
 * job. Grouped pre-dispatch (similarity, safety, kit, access) → in-progress
 * (timeline, customer update) → close-out (completion note, time check,
 * variation). Each card calls its endpoint on demand.
 */
export function WorkOrderAiPanel({ workOrderId }: { workOrderId: string }) {
  const key = workOrderId;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">AI assist</h3>
      <div className="grid gap-3 xl:grid-cols-2">
        <AiAssist
          title="Duplicate / callback check"
          description="Is this a repeat of another job at the same site, or warranty rework?"
          label="Check"
          autoRunKey={key}
          run={() => aiSimilarWorkOrders(workOrderId)}
          render={(d) => (
            <div className="space-y-2 text-sm">
              <div className="text-xs text-slate-500">Checked {d.checked} jobs at this site</div>
              {d.duplicates.map((x) => (
                <div key={x.workOrder} className="rounded bg-amber-50 px-2 py-1">
                  <span className="font-medium">Duplicate · {x.workOrder}</span> <ConfidenceChip value={x.confidence} />
                  <div className="text-xs text-slate-600">{x.reason}</div>
                </div>
              ))}
              {d.callbacks.map((x) => (
                <div key={x.workOrder} className="rounded bg-red-50 px-2 py-1">
                  <span className="font-medium">Callback · {x.workOrder}</span> <ConfidenceChip value={x.confidence} />
                  <div className="text-xs text-slate-600">{x.reason}</div>
                </div>
              ))}
              {d.duplicates.length === 0 && d.callbacks.length === 0 && (
                <div className="text-slate-500">{d.summary}</div>
              )}
            </div>
          )}
        />

        <AiAssist
          title="Safety pre-flight"
          description="Safety controls for this job + clearance check on the assigned tech."
          label="Run pre-flight"
          autoRunKey={key}
          run={() => aiSafetyPreflight(workOrderId)}
          render={(d) => (
            <div className="space-y-2">
              {d.missingSkills.length > 0 ? (
                <div className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">
                  ⚠ {d.assignedTechnician ?? "Assigned tech"} is missing: {d.missingSkills.join(", ")}
                </div>
              ) : (
                <div className="rounded bg-green-50 px-2 py-1 text-sm text-green-700">
                  ✓ {d.assignedTechnician ?? "Tech"} holds all required skills
                </div>
              )}
              <AiText text={d.safetyGuidance} />
              {d.citations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.citations.map((c, i) => (
                    <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{c.title}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        />

        <AiAssist
          title="Parts kit"
          description="What to load, from parts actually used on comparable jobs."
          label="Suggest kit"
          autoRunKey={key}
          run={() => aiPartsKit(workOrderId)}
          render={(d) =>
            d.lowConfidence ? (
              <AiText text={d.message ?? "No usage history."} low />
            ) : (
              <div className="space-y-1 text-sm">
                {d.kit.map((k) => (
                  <div key={k.sku} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                    <span>{k.quantity}× {k.name}</span>
                    <span className="text-xs text-slate-400">{k.sku}</span>
                  </div>
                ))}
                {d.kit.length === 0 && <div className="text-slate-500">No kit suggested.</div>}
              </div>
            )
          }
        />

        <AiAssist
          title="Site access briefing"
          description="What the tech needs before arriving — contact, access, pets, window."
          label="Brief"
          autoRunKey={key}
          run={() => aiSiteAccessBriefing(workOrderId)}
          render={(d) => <AiText text={d.briefing} />}
        />

        <AiAssist
          title="Completion note"
          description="Draft the completion note from time entries, parts and status."
          label="Draft note"
          autoRunKey={key}
          run={() => aiCompletionNote(workOrderId)}
          render={(d) => <AiText text={d.draft} low={d.lowConfidence} />}
        />

        <AiAssist
          title="Job timeline"
          description="Plain-English history of this job for handover or dispute."
          label="Summarise"
          autoRunKey={key}
          run={() => aiWorkOrderTimeline(workOrderId)}
          render={(d) => <AiText text={d.narrative} />}
        />

        <AiAssist
          title="Time check"
          description="Flag if logged hours are unusually high before invoicing."
          label="Check hours"
          autoRunKey={key}
          run={() => aiTimeAnomaly(workOrderId)}
          render={(d) => (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                Logged {d.loggedHours}h vs typical {d.typicalHours}h ({d.comparableJobs} comparable jobs)
              </div>
              <AiText text={d.narrative} low={d.flagged} />
            </div>
          )}
        />

        <AiAssist
          title="Variation claim"
          description="Draft a variation note when actuals exceed the quote."
          label="Check variation"
          autoRunKey={key}
          run={() => aiVariationClaim(workOrderId)}
          render={(d) => (
            <div className="space-y-2">
              {d.flagged && (
                <div className="text-xs font-medium text-amber-700">
                  Variance: {d.variance.hours}h over quote · margin {d.variance.marginPercent}%
                </div>
              )}
              <AiText text={d.draft} low={d.flagged} />
            </div>
          )}
        />

        <AiAssist
          title="Customer update"
          description="Draft a friendly status update to send the customer."
          label="Draft update"
          autoRunKey={key}
          run={() => aiCustomerStatusUpdate(workOrderId)}
          render={(d) => <AiText text={d.draft} />}
        />
      </div>
    </div>
  );
}
