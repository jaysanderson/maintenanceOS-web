import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Field, inputCls } from "../components/ui";
import { api } from "../lib/api";
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
  mcpPublicAccess: boolean;
  mcpPublicUserId: string | null;
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
 * Connect via MCP — issue long-lived personal access tokens so an AI
 * agent (Claude Desktop, Claude Code, n8n, …) can drive MaintenanceOS
 * over the Model Context Protocol without the 12-hour session JWT
 * expiring mid-conversation. The raw token is shown once at creation
 * time and then never recoverable; revoking removes its access
 * immediately.
 */

interface AccessTokenRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface CreatedToken {
  id: string;
  name: string;
  prefix: string;
  /** The raw token — only present in the create response. */
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

function McpCard() {
  const mcpUrl = `${window.location.origin}/mcp`;
  const [tokens, setTokens] = useState<AccessTokenRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [publicAccess, setPublicAccess] = useState<boolean | null>(null);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
      },
      () => {}
    );
  };

  const load = () =>
    api
      .get<{ tokens: AccessTokenRow[] }>("/access-tokens")
      .then((r) => setTokens(r.tokens))
      .catch((e) => setLoadErr((e as Error).message));

  useEffect(() => {
    load();
    // Read the public-access flag separately so the toggle reflects the
    // server's actual state (and survives page refresh).
    api
      .get<CompanyConfig>("/settings")
      .then((c) => setPublicAccess(!!c.mcpPublicAccess))
      .catch(() => setPublicAccess(false));
  }, []);

  const togglePublic = async (next: boolean) => {
    if (
      next &&
      !confirm(
        "Enable public MCP access?\n\n" +
          "Anyone with the URL will be able to read and act on your data " +
          "WITHOUT authentication, acting as your current user.\n\n" +
          "Only do this for tests or controlled demos. Turn it off when done."
      )
    ) {
      return;
    }
    setTogglingPublic(true);
    try {
      const updated = await api.put<CompanyConfig>("/settings", {
        mcpPublicAccess: next,
      });
      setPublicAccess(!!updated.mcpPublicAccess);
    } catch (e) {
      alert("Could not update: " + (e as Error).message);
    } finally {
      setTogglingPublic(false);
    }
  };

  const createToken = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreateErr(null);
    try {
      const created = await api.post<CreatedToken>("/access-tokens", {
        name: newName.trim(),
      });
      setJustCreated(created);
      setNewName("");
      await load();
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? Any agent using it will lose access immediately.`)) return;
    try {
      await api.del(`/access-tokens/${id}`);
      await load();
    } catch (e) {
      alert("Could not revoke: " + (e as Error).message);
    }
  };

  const claudeCmd = justCreated
    ? `claude mcp add maintenanceos --transport http ${mcpUrl} --header "Authorization: Bearer ${justCreated.token}"`
    : `claude mcp add maintenanceos --transport http ${mcpUrl} --header "Authorization: Bearer <your-token>"`;

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
        n8n, or your own). The agent acts with your role's permissions.
        Long-lived tokens — they don't expire with your browser session.
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

        <div
          className={`rounded-lg border-2 p-3 ${
            publicAccess
              ? "border-red-300 bg-red-50"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800">
                  Public access (no auth required)
                </h4>
                {publicAccess && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Open to the internet
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                When on, anyone can POST to{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">/mcp</code>{" "}
                without a token and will act as you. Use this for tests and
                public demos only — turn it off when you're done.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                {publicAccess === null ? "…" : publicAccess ? "ON" : "OFF"}
              </span>
              <input
                type="checkbox"
                checked={!!publicAccess}
                disabled={publicAccess === null || togglingPublic}
                onChange={(e) => togglePublic(e.target.checked)}
                className="h-5 w-5 cursor-pointer accent-red-600"
                aria-label="Enable public MCP access"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Create a new token
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder='Token name, e.g. "Claude Desktop"'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createToken()}
            />
            <Button onClick={createToken} disabled={!newName.trim() || creating}>
              {creating ? "Creating…" : "Create token"}
            </Button>
          </div>
          {createErr && (
            <div className="mt-2 text-xs text-red-600">{createErr}</div>
          )}
        </div>

        {justCreated && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <span aria-hidden>⚠</span>
              Copy this token now — you'll never see it again
            </div>
            <div className="mb-2 text-xs text-amber-900">
              "{justCreated.name}" — store this somewhere safe.
            </div>
            <div className="flex gap-2">
              <input
                className={`${inputCls} bg-white font-mono text-xs`}
                readOnly
                value={justCreated.token}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="primary"
                onClick={() => copy("new-token", justCreated.token)}
              >
                {copied === "new-token" ? "Copied" : "Copy token"}
              </Button>
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-amber-700 hover:underline"
              onClick={() => setJustCreated(null)}
            >
              I've saved it — hide
            </button>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your tokens
          </div>
          {loadErr && (
            <div className="text-xs text-red-600">{loadErr}</div>
          )}
          {!loadErr && tokens.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
              No tokens yet. Create one above to connect an MCP agent.
            </div>
          )}
          {tokens.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Token</th>
                    <th className="px-3 py-2 font-medium">Last used</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => {
                    const revoked = !!t.revokedAt;
                    const expired =
                      !!t.expiresAt &&
                      new Date(t.expiresAt).getTime() < Date.now();
                    return (
                      <tr
                        key={t.id}
                        className={`border-t border-slate-100 ${
                          revoked || expired ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {t.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {t.prefix}…
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {t.lastUsedAt
                            ? new Date(t.lastUsedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {revoked ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              REVOKED
                            </span>
                          ) : expired ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              EXPIRED
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!revoked && !expired && (
                            <button
                              type="button"
                              onClick={() => revoke(t.id, t.name)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">
            Add to Claude Code
          </div>
          <div className="flex gap-2">
            <code className="block w-full overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
              {claudeCmd}
            </code>
            <Button variant="secondary" onClick={() => copy("cmd", claudeCmd)}>
              {copied === "cmd" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            For Claude Desktop or claude.ai, add a custom connector with the
            endpoint above and header{" "}
            <code className="rounded bg-slate-100 px-1">Authorization: Bearer &lt;your-token&gt;</code>
            . Tokens are scoped to your role and never expire unless you
            revoke them. Full guide:{" "}
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
