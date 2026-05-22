import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Field, inputCls } from "../components/ui";
import { api, tokenStore } from "../lib/api";
import { useAuth } from "../lib/auth";

interface CompanyConfig {
  companyName: string;
  abn: string;
  email: string;
  phone: string;
  address: string;
  gstRate: number;
  marginRiskThreshold: number;
  defaultPaymentTerms: string;
  aiConfidenceThreshold: number;
}

type Counts = Record<string, number>;

export default function Settings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [cfg, setCfg] = useState<CompanyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cfgError, setCfgError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CompanyConfig>("/settings")
      .then(setCfg)
      .catch((e) => setCfgError((e as Error).message));
  }, []);

  const saveCfg = async () => {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setCfgError(null);
    try {
      const updated = await api.put<CompanyConfig>("/settings", cfg);
      setCfg(updated);
      setSaved(true);
    } catch (e) {
      setCfgError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        "Reset the demo environment? This wipes ALL current data and restores the original seeded demo dataset."
      )
    )
      return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<{ ok: boolean; counts: Counts }>(
        "/system/reset",
        { confirm: true }
      );
      setResult(res.counts);
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof CompanyConfig, v: string | number) =>
    setCfg((c) => (c ? { ...c, [k]: v } : c));

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-6">
        <h2 className="font-semibold">Company &amp; Finance</h2>
        <p className="mt-1 text-sm text-slate-500">
          These drive document branding and tax. GST and the margin-risk
          threshold are applied to quotes, invoices and job costing.
          {!canEdit && " Read-only for your role."}
        </p>
        {cfgError && <p className="mt-2 text-sm text-red-600">{cfgError}</p>}
        {!cfg ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company name">
                <input
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </Field>
              <Field label="ABN">
                <input
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.abn}
                  onChange={(e) => set("abn", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Address">
              <input
                className={inputCls}
                disabled={!canEdit}
                value={cfg.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="GST rate (e.g. 0.1)">
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.gstRate}
                  onChange={(e) => set("gstRate", Number(e.target.value))}
                />
              </Field>
              <Field label="Margin risk (e.g. 0.25)">
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.marginRiskThreshold}
                  onChange={(e) =>
                    set("marginRiskThreshold", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Default terms">
                <input
                  className={inputCls}
                  disabled={!canEdit}
                  value={cfg.defaultPaymentTerms}
                  onChange={(e) =>
                    set("defaultPaymentTerms", e.target.value)
                  }
                />
              </Field>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <Field label="AI confidence threshold (0–1)">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  className={`${inputCls} max-w-[140px]`}
                  disabled={!canEdit}
                  value={cfg.aiConfidenceThreshold}
                  onChange={(e) =>
                    set("aiConfidenceThreshold", Number(e.target.value))
                  }
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Minimum retrieval score for the AI to answer. Below this (or
                when the knowledge base has no grounded answer) the Copilot,
                Playbooks and Quote-draft return a "not confident" message
                instead of guessing. Higher = stricter.
              </p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-3 pt-1">
                <Button disabled={saving} onClick={saveCfg}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-600">Saved.</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <McpCard />

      {canEdit && (
        <Card className="border-amber-200 p-6">
          <h3 className="font-semibold">Demo Environment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Restore the database to the original seeded demo dataset. This{" "}
            <strong>permanently deletes all current data</strong> and
            regenerates the demo records (including the demo login accounts).
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="danger" disabled={busy} onClick={reset}>
              {busy ? "Resetting…" : "Reset demo data"}
            </Button>
            {busy && (
              <span className="text-sm text-slate-500">
                Re-seeding — this can take a few seconds…
              </span>
            )}
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">Reset failed: {error}</p>
          )}
          {result && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="mb-2 font-medium">Demo data restored.</div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(result).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="capitalize text-emerald-700">
                      {k.replace(/([A-Z])/g, " $1")}
                    </dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}

      {canEdit && <BackupsCard />}
    </div>
  );
}

/**
 * Surfaces the MCP server endpoint so anyone can connect an AI agent
 * (Claude, etc.) to drive MaintenanceOS over the Model Context Protocol.
 * The hosted MCP transport is on the same origin as the app (/mcp) and
 * carries the same bearer token as the REST API.
 */
function McpCard() {
  const mcpUrl = `${window.location.origin}/mcp`;
  const token = tokenStore.get() ?? "";
  const claudeCmd = `claude mcp add maintenanceos --transport http ${mcpUrl} --header "Authorization: Bearer <token>"`;
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
      },
      () => {}
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Connect via MCP</h3>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
          Model Context Protocol
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Drive MaintenanceOS from an AI agent (Claude Desktop, Claude Code,
        n8n, or your own). The agent can read and act on your live ERP data —
        with the same role permissions as your login. Add this endpoint as a
        custom connector and authenticate with a bearer token.
      </p>

      <div className="mt-4 space-y-3">
        <Field label="MCP server endpoint">
          <div className="flex gap-2">
            <input className={`${inputCls} font-mono text-xs`} readOnly value={mcpUrl} />
            <Button variant="secondary" onClick={() => copy("url", mcpUrl)}>
              {copied === "url" ? "Copied" : "Copy"}
            </Button>
          </div>
        </Field>

        <Field label="Access token (your current session's bearer token)">
          <div className="flex gap-2">
            <input
              className={`${inputCls} font-mono text-xs`}
              readOnly
              value={token ? `${token.slice(0, 24)}…` : "—"}
            />
            <Button
              variant="secondary"
              disabled={!token}
              onClick={() => copy("token", token)}
            >
              {copied === "token" ? "Copied" : "Copy token"}
            </Button>
          </div>
        </Field>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">
            Add to Claude Code
          </div>
          <div className="flex gap-2">
            <code className="block w-full overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
              {claudeCmd}
            </code>
            <Button variant="secondary" onClick={() => copy("cmd", claudeCmd.replace("<token>", token))}>
              {copied === "cmd" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            For Claude Desktop or claude.ai, add a custom connector with the
            endpoint above and header{" "}
            <code className="rounded bg-slate-100 px-1">Authorization: Bearer &lt;token&gt;</code>.
            Tokens follow your login session — for a long-lived integration,
            mint a dedicated service token. Full guide:{" "}
            <a className="text-brand-600 hover:underline" href="/docs" target="_blank" rel="noreferrer">
              API docs
            </a>
            .
          </p>
        </div>
      </div>
    </Card>
  );
}

function BackupsCard() {
  const [list, setList] = useState<
    { file: string; size: number; createdAt: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ file: string; size: number; createdAt: string }[]>(
        "/system/backups"
      )
      .then(setList)
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const backup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ file: string }>("/system/backup");
      setMsg(`Backup created: ${r.file}`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Database Backups</h3>
          <p className="mt-1 text-sm text-slate-500">
            Snapshot the SQLite database. For production, move to managed
            Postgres with automated backups (see DEPLOYMENT.md).
          </p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={backup}>
          {busy ? "Backing up…" : "Create backup"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      <div className="mt-4 divide-y divide-slate-100 text-sm">
        {list.length === 0 && (
          <p className="text-slate-400">No backups yet.</p>
        )}
        {list.map((b) => (
          <div key={b.file} className="flex justify-between py-2">
            <span className="font-mono text-xs">{b.file}</span>
            <span className="text-slate-500">
              {(b.size / 1024).toFixed(0)} KB ·{" "}
              {new Date(b.createdAt).toLocaleString("en-AU")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
