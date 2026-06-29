import { AiInfo } from "./AiInfo";
import { useState } from "react";
import { useList } from "../lib/hooks";
import { Card, Button, inputCls } from "./ui";
import { Markdown } from "./Markdown";
import { ApiError } from "../lib/api";
import { aiAssetService, type AssetServiceResponse } from "../lib/ai";
import { Vehicle, Asset } from "../lib/types";

/** UC3 — Fleet/asset service co-pilot. Pick a vehicle/asset + a symptom →
 *  likely cause, next step and service status, grounded in equipment manuals. */
export function AssetServiceCoPilot() {
  const vehicles = useList<Vehicle[]>("/vehicles");
  const assets = useList<Asset[]>("/assets");
  const [sel, setSel] = useState(""); // "vehicle:<id>" | "asset:<id>"
  const [symptom, setSymptom] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AssetServiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!sel || !symptom.trim() || loading) return;
    const [kind, id] = sel.split(":") as ["vehicle" | "asset", string];
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await aiAssetService(kind, id, symptom.trim()));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? "AI is not configured on the server yet." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Fleet/asset service co-pilot</h3>
        <AiInfo id="asset-service" />
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">Agentic RAG</span>
      </div>
      <p className="text-sm text-slate-500">Pick a vehicle or asset and describe the symptom — likely cause, recommended next step and service status, grounded in the equipment manuals.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} max-w-xs`} value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Select vehicle or asset…</option>
          {(vehicles.data ?? []).map((v) => (
            <option key={v.id} value={`vehicle:${v.id}`}>🚐 {v.name}</option>
          ))}
          {(assets.data ?? []).map((a) => (
            <option key={a.id} value={`asset:${a.id}`}>🛠 {a.name}</option>
          ))}
        </select>
        <input className={`${inputCls} min-w-0 flex-1`} value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="Symptom — e.g. pulls left and shimmy at highway speed" aria-label="Symptom" />
        <Button onClick={run} disabled={loading || !sel || !symptom.trim()}>{loading ? "Advising…" : "Advise"}</Button>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">
            {data.subject.name} · {data.subject.detail}{data.dueInfo && <span className="ml-1 text-amber-700">· {data.dueInfo}</span>}
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><Markdown text={data.narrative} /></div>
          {data.citations.length > 0 && <div className="text-[11px] text-slate-400">Sources: {data.citations.slice(0, 4).join(" · ")}</div>}
        </div>
      )}
    </Card>
  );
}
