import { useState, FormEvent } from "react";
import { Card, Button, inputCls } from "../components/ui";
import { aiPlaybook, type JobType, type Playbook, type AiCitation } from "../lib/ai";
import { ApiError } from "../lib/api";

const JOB_TYPES: JobType[] = [
  "REPAIR",
  "MAINTENANCE",
  "INSPECTION",
  "EMERGENCY",
  "RECURRING_SERVICE",
];

const EXAMPLES = [
  "Replace a leaking kitchen mixer tap",
  "Two-storey gutter clean and downpipe clear",
  "Replace a faulty switchboard RCD",
  "Quarterly HVAC filter service",
];

/**
 * F2 — Job Playbooks. Generates a reusable, structured playbook for a job
 * type, grounded in comparable historical work orders + safety docs via
 * Progress Agentic RAG (server-side /api/ai/playbook).
 */
export default function Playbooks() {
  const [desc, setDesc] = useState("");
  const [jobType, setJobType] = useState<JobType | "">("");
  const [loading, setLoading] = useState(false);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(description: string) {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError(null);
    setPlaybook(null);
    setRaw(null);
    setCitations([]);
    try {
      const res = await aiPlaybook(
        description.trim(),
        jobType === "" ? undefined : jobType
      );
      setPlaybook(res.playbook);
      setRaw(res.raw ?? null);
      setCitations(res.citations ?? []);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? "AI is not configured on the server yet."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(desc);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Job Playbooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a standard, reusable playbook for any job — required
          skills, materials, time, steps and safety controls — grounded in
          your past jobs and safety documentation.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={inputCls}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe the job, e.g. replace a leaking kitchen mixer tap"
              aria-label="Job description"
            />
            <select
              className={`${inputCls} sm:w-56`}
              value={jobType}
              onChange={(e) => setJobType(e.target.value as JobType | "")}
              aria-label="Job type"
            >
              <option value="">Any job type</option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={loading || !desc.trim()}>
              {loading ? "Generating…" : "Generate"}
            </Button>
          </div>
        </form>

        {!playbook && !loading && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setDesc(ex);
                  run(ex);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Reviewing comparable jobs and safety docs…
          </div>
        )}
      </Card>

      {playbook && <PlaybookView playbook={playbook} citations={citations} />}

      {!playbook && raw && (
        <Card className="whitespace-pre-wrap p-5 text-sm text-slate-700">{raw}</Card>
      )}
    </div>
  );
}

function PlaybookView({
  playbook,
  citations,
}: {
  playbook: Playbook;
  citations: AiCitation[];
}) {
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{playbook.title}</h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
          Agentic RAG
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Est. hours" value={String(playbook.estimatedHours)} />
        <Chips label="Required skills" items={playbook.requiredSkills} />
        <Chips label="Typical materials" items={playbook.typicalMaterials} />
      </div>

      <Section title="Steps">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {playbook.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section title="Safety controls">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {playbook.safetyControls.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      {citations.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Based on
          </div>
          <div className="flex flex-wrap gap-2">
            {citations.map((c) => (
              <span
                key={c.resourceId}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              >
                {c.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.length === 0 && <span className="text-sm text-slate-400">—</span>}
        {items.map((it, i) => (
          <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-medium text-slate-800">{title}</h3>
      {children}
    </div>
  );
}
