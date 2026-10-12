import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type {
  Agent,
  Config,
  ConfigResponse,
  Profile,
  Role,
  Status,
} from "./types";

const roles: Role[] = [
  "tech-lead",
  "backend_dev",
  "frontend_dev",
  "qa_engineer",
];
const roleNames: Record<Role, string> = {
  "tech-lead": "Tech lead",
  backend_dev: "Backend developer",
  frontend_dev: "Frontend developer",
  qa_engineer: "QA engineer",
};
const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("Overview");
  const [installedOnly, setInstalledOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState(false);
  const [cloneProfile, setCloneProfile] = useState<Profile | null>(null);
  const [definitionEdit, setDefinitionEdit] = useState<{
    name: string;
    content: string;
    builtin: boolean;
  } | null>(null);
  const [modelChoices, setModelChoices] = useState<
    { value: string; label: string }[]
  >([]);
  const [editorKind, setEditorKind] = useState<Agent["kind"]>("claude");
  const [editorModel, setEditorModel] = useState("");
  const [editorMode, setEditorMode] = useState("default");
  const [modelBusy, setModelBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [definitionName, setDefinitionName] = useState<string | null>(null);
  const [deleteDefinitionName, setDeleteDefinitionName] = useState<
    string | null
  >(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [unmappedErrors, setUnmappedErrors] = useState<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const modelRequest = useRef(0);
  const savedBody = useRef<string | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const activeDialog =
    definitionName !== null
      ? 'new-definition'
      : deleteDefinitionName !== null
        ? 'delete-definition'
        : deleteProfileId !== null
          ? 'delete-profile'
          : null;
  const previousDialog = useRef<string | null>(null);

  useEffect(() => {
    if (activeDialog) {
      dialogRef.current?.querySelector<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])',
      )?.focus();
    } else if (previousDialog.current) {
      dialogTrigger.current?.focus();
      dialogTrigger.current = null;
    }
    previousDialog.current = activeDialog;
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDefinitionName(null);
        setDeleteDefinitionName(null);
        setDeleteProfileId(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeDialog]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, a] = await Promise.all([
        api.status(),
        api.config(),
        api.agents(),
      ]);
      setStatus(s);
      setConfig(c);
      setAgents(a.kinds);
      savedBody.current = JSON.stringify(configBody(c));
      setFieldErrors({});
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not load setup.",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshAgents = async () => {
    setRefreshing(true);
    try {
      const [s, a] = await Promise.all([api.status(), api.agents()]);
      setStatus(s);
      setAgents(a.kinds);
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not refresh agents.",
      });
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const dirtyConfig = useMemo(() => {
    if (!config) return null;
    return configBody(config);
  }, [config]);
  const warningFields = useMemo(() => configWarnings(config), [config]);
  const isDirty = Boolean(
    dirtyConfig &&
    savedBody.current !== null &&
    JSON.stringify(dirtyConfig) !== savedBody.current,
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const update = (fn: (draft: ConfigResponse) => void) =>
    setConfig((prev) => {
      if (!prev) return prev;
      const next = copy(prev);
      fn(next);
      return next;
    });
  const save = async () => {
    if (!config || !dirtyConfig) return;
    const invalid: Record<string, string> = {};
    for (const [id, profile] of Object.entries(config.profiles)) {
      const field = `profiles.${id}.kind`;
      if (!agents.some((agent) => agent.kind === profile.kind)) {
        invalid[`profile-kind:${id}`] = `Profile “${id}” uses unknown agent kind “${profile.kind}”. Choose an available agent kind before saving.`;
      } else if (warningFields[field]) {
        invalid[`profile-kind:${id}`] = warningFields[field];
      }
    }
    for (const role of roles)
      if (!config.profiles[config.defaultProfiles[role]])
        invalid[`defaultProfiles.${role}`] = "Choose a profile for this role.";
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      setNotice({
        kind: "error",
        text: Object.keys(invalid).some((key) => key.startsWith("profile-kind:"))
          ? "Cannot save: resolve the agent kind warnings in Profiles first."
          : "Review the highlighted settings before saving.",
      });
      return;
    }
    setSaving(true);
    setNotice(null);
    setFieldErrors({});
    try {
      const saved = await api.save(dirtyConfig as Config);
      savedBody.current = JSON.stringify(configBody(saved));
      setConfig(saved);
      setFieldErrors({});
      setUnmappedErrors([]);
      setNotice({ kind: "ok", text: "Settings saved." });
    } catch (e) {
      const apiError = (
        e as { api?: { fields?: Record<string, string>; message?: string } }
      ).api;
      const normalized = normalizeErrors(apiError?.fields ?? {});
      setFieldErrors(normalized.mapped);
      setUnmappedErrors(normalized.unmapped);
      setNotice({
        kind: "error",
        text:
          apiError?.message ??
          (e instanceof Error ? e.message : "Could not save settings."),
      });
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = async (id: string) => {
    const p = config?.profiles[id];
    setEditing(id);
    setNewProfile(false);
    setCloneProfile(null);
    setEditorKind(p?.kind ?? "claude");
    setEditorModel(p?.model ?? "");
    setEditorMode(p?.mode ?? "default");
    setModelChoices(agents.find((a) => a.kind === p?.kind)?.models ?? []);
    if (p?.kind === "pi") fetchModels("pi", "", true);
  };
  const beginCreate = () => {
    setEditing("");
    setNewProfile(true);
    setCloneProfile(null);
    setEditorKind("claude");
    setEditorModel("");
    setEditorMode("default");
    setModelChoices(agents.find((a) => a.kind === "claude")?.models ?? []);
  };
  const beginDuplicate = (id: string) => {
    const p = config?.profiles[id];
    if (!p) return;
    setEditing(id);
    setNewProfile(true);
    setCloneProfile(copy(p));
    setEditorKind(p.kind);
    setEditorModel(p.model ?? "");
    setEditorMode(p.mode);
    setModelChoices(agents.find((a) => a.kind === p.kind)?.models ?? []);
    if (p.kind === "pi") fetchModels("pi", "", true);
  };
  const profile =
    editing !== null && !newProfile
      ? config?.profiles[editing]
      : (cloneProfile ?? undefined);
  const fetchModels = (kind: string, search: string, immediate = false) => {
    window.clearTimeout(timer.current);
    const requestId = ++modelRequest.current;
    const agent = agents.find((a) => a.kind === kind);
    setModelError(null);
    if (kind !== "pi") {
      setModelBusy(false);
      setModelChoices(agent?.models ?? []);
      return;
    }
    const run = () => {
      setModelBusy(true);
      void api
        .models(kind, search)
        .then((x) => {
          if (modelRequest.current === requestId) setModelChoices(x.models);
        })
        .catch(() => {
          if (modelRequest.current === requestId) {
            setModelChoices([]);
            setModelError(
              "Could not load Pi models. You can still enter a model manually.",
            );
          }
        })
        .finally(() => {
          if (modelRequest.current === requestId) setModelBusy(false);
        });
    };
    if (immediate) run();
    else timer.current = window.setTimeout(run, 300);
  };
  const closeEditor = () => {
    setEditing(null);
    setNewProfile(false);
    setCloneProfile(null);
    setFieldErrors({});
  };
  const saveProfile = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const id = String(data.get("id")).trim();
    const role = String(data.get("role")) as Role;
    const kind = String(data.get("kind")) as Agent["kind"];
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(id)) {
      setFieldErrors({
        "profile.id":
          "Use lowercase letters, numbers, and hyphens (up to 40 characters).",
      });
      return;
    }
    if (config?.profiles[id] && (newProfile || id !== editing)) {
      setFieldErrors({ "profile.id": "That profile ID is already in use." });
      return;
    }
    if (
      !newProfile &&
      profile &&
      profile.role !== role &&
      config?.defaultProfiles[profile.role] === editing &&
      !Object.entries(config.profiles).some(
        ([otherId, other]) =>
          otherId !== editing && other.role === profile.role,
      )
    ) {
      setFieldErrors({
        "profile.role": `Add another ${roleNames[profile.role]} profile and make it the default before changing this role.`,
      });
      return;
    }
    const selectedAgent = agents.find((agent) => agent.kind === kind);
    const value: Profile = {
      role,
      kind,
      model:
        selectedAgent?.modelFlag === null
          ? null
          : String(data.get("model") || "") || null,
      mode: String(data.get("mode") || "default"),
      extraArgs: String(data.get("extraArgs") || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      definition: String(data.get("definition")),
      task: String(data.get("task")),
    };
    update((d) => {
      if (editing && editing !== id && !newProfile) {
        delete d.profiles[editing];
        for (const r of roles)
          if (d.defaultProfiles[r] === editing) d.defaultProfiles[r] = id;
      }
      if (
        !newProfile &&
        profile &&
        profile.role !== role &&
        d.defaultProfiles[profile.role] === editing
      ) {
        const replacement = Object.entries(d.profiles).find(
          ([, p]) => p.role === profile.role,
        )?.[0];
        if (replacement) d.defaultProfiles[profile.role] = replacement;
      }
      d.profiles[id] = value;
    });
    closeEditor();
  };
  const openDefinition = async (name: string) => {
    try {
      const d = await api.definition(name);
      setDefinitionEdit({ name, content: d.content, builtin: d.builtin });
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not load definition.",
      });
    }
  };
  const saveDefinition = async () => {
    if (!definitionEdit) return;
    try {
      await api.putDefinition(definitionEdit.name, definitionEdit.content);
      setDefinitionEdit(null);
      const c = await api.config();
      setConfig((prev) =>
        prev ? { ...prev, definitions: c.definitions } : prev,
      );
      setNotice({ kind: "ok", text: "Definition saved." });
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not save definition.",
      });
    }
  };
  const createDefinition = () => setDefinitionName("");
  const removeDefinition = async (name: string) => {
    try {
      await api.deleteDefinition(name);
      setDeleteDefinitionName(null);
      const c = await api.config();
      setConfig((prev) =>
        prev ? { ...prev, definitions: c.definitions } : prev,
      );
      setNotice({ kind: "ok", text: `${name} deleted.` });
    } catch (e) {
      setDeleteDefinitionName(null);
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "Could not delete definition.",
      });
    }
  };
  const confirmCreateDefinition = () => {
    if (!definitionName?.trim()) return;
    const name = definitionName.trim().endsWith(".md")
      ? definitionName.trim()
      : `${definitionName.trim()}.md`;
    setDefinitionEdit({
      name,
      content: "# New agent definition\n",
      builtin: false,
    });
    setDefinitionName(null);
  };

  if (loading)
    return (
      <main className="loading">
        <div className="brand-mark">H</div>
        <p>Loading your workflow setup…</p>
      </main>
    );
  if (!config)
    return (
      <main className="loading">
        <div className="brand-mark">H</div>
        <h1>Workflow setup is unavailable</h1>
        <p>{notice?.text ?? "Could not connect to the local server."}</p>
        <button onClick={() => void load()}>Try again</button>
      </main>
    );
  const installedCount = agents.filter((a) => a.installed).length;
  const nav = ["Overview", "Profiles", "Team policy", "Definitions", "Routing"];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">H</div>
          <div>
            <strong>herdr</strong>
            <span>WORKFLOW SETUP</span>
          </div>
        </div>
        <div className="workspace-label">LOCAL WORKSPACE</div>
        <nav aria-label="Setup sections">
          {nav.map((n, i) => (
            <button
              key={n}
              className={tab === n ? "nav-item active" : "nav-item"}
              onClick={() => setTab(n)}
            >
              <span className="nav-icon">{["◫", "◈", "♧", "▤", "⇄"][i]}</span>
              {n}
              {n === "Profiles" && (
                <span className="nav-count">
                  {Object.keys(config.profiles).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          Connected locally
          <span className="local-caption">
            127.0.0.1 · private to this machine
          </span>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE SETTINGS</span>
            <h1>{tab}</h1>
          </div>
          <div className="top-actions">
            {Object.keys(warningFields).length > 0 && (
              <span className="warning-count" role="status">
                {Object.keys(warningFields).length} config warning
                {Object.keys(warningFields).length === 1 ? "" : "s"}
              </span>
            )}
            <span className="source-pill">
              {config.configSource === "example"
                ? "Using example config"
                : config.configSource === "migrated"
                  ? "Migrated config"
                  : "Saved config"}
            </span>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>
        {Object.keys(warningFields).length > 0 && (
          <div className="warning-notice save-warning" role="status">
            <strong>Save needs attention</strong>
            <span> Resolve these configuration warnings in Profiles before saving:</span>
            <ul>
              {Object.entries(warningFields).map(([field, message]) => (
                <li key={field}>
                  <code>{field}</code>: {message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {isDirty && (
          <p className="dirty-indicator" role="status">
            Unsaved changes · profile changes apply to the draft until you save.
          </p>
        )}
        {unmappedErrors.length > 0 && (
          <div className="error-summary" role="alert">
            <strong>Additional server validation errors</strong>
            <ul>
              {unmappedErrors.map((message, i) => (
                <li key={`${message}-${i}`}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {notice && (
          <div className={`notice ${notice.kind}`} role="status">
            <span>{notice.kind === "ok" ? "✓" : "!"}</span>
            {notice.text}
            <button
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        )}
        {tab === "Overview" && (
          <>
            <section className="welcome">
              <div>
                <span className="eyebrow light">YOUR TEAM, READY TO WORK</span>
                <h2>Shape how your agents work together.</h2>
                <p>
                  Choose agent profiles, set team limits, and keep every handoff
                  on the right route.
                </p>
                <button
                  className="button white"
                  onClick={() => setTab("Profiles")}
                >
                  Manage profiles <span>→</span>
                </button>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="orbit orbit-a" />
                <div className="orbit orbit-b" />
                <div className="orbit-core">H</div>
                <i className="orbit-node node-a">TL</i>
                <i className="orbit-node node-b">BE</i>
                <i className="orbit-node node-c">QA</i>
              </div>
            </section>
            <div className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon mint">⌘</span>
                <span className="stat-label">AGENT TYPES AVAILABLE</span>
                <strong>{agents.length}</strong>
                <small>{installedCount} installed on this machine</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon lavender">◈</span>
                <span className="stat-label">SAVED PROFILES</span>
                <strong>{Object.keys(config.profiles).length}</strong>
                <small>Across 4 team roles</small>
              </article>
              <article className="stat-card">
                <span className="stat-icon peach">♧</span>
                <span className="stat-label">MAX TECH LEADS</span>
                <strong>{config.spawnPolicy.maxTechLeads}</strong>
                <small>Concurrent per workflow run</small>
              </article>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">AGENT CATALOG</span>
                  <h2>Installed agents</h2>
                  <p>Available agent CLIs discovered on this machine.</p>
                </div>
                <div className="catalog-actions">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={installedOnly}
                      onChange={(e) => setInstalledOnly(e.target.checked)}
                    />
                    Installed only
                  </label>
                  <button
                    className="button secondary"
                    disabled={refreshing}
                    onClick={() => void refreshAgents()}
                  >
                    {refreshing ? "Refreshing…" : "↻ Refresh"}
                  </button>
                </div>
              </div>
              <AgentTable agents={agents} installedOnly={installedOnly} />
            </section>
          </>
        )}
        {tab === "Profiles" && (
          <section className="panel">
            {Object.keys(warningFields).length > 0 && (
              <div className="warning-notice" role="status">
                <strong>Configuration needs attention</strong>
                <ul>
                  {Object.entries(warningFields).map(([field, message]) => (
                    <li key={field}>
                      <code>{field}</code>: {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="panel-heading">
              <div>
                <span className="eyebrow">AGENT CONFIGURATION</span>
                <h2>Profiles</h2>
                <p>
                  Define how each agent starts. Choose one default profile for
                  every role.
                </p>
              </div>
              <button className="button primary" onClick={beginCreate}>
                ＋ New profile
              </button>
            </div>
            <div className="profile-groups">
              {roles.map((role) => (
                <section className="role-group" key={role}>
                  <div className="role-title">
                    <div>
                      <span className="role-badge">
                        {role === "tech-lead"
                          ? "TL"
                          : role === "backend_dev"
                            ? "BE"
                            : role === "frontend_dev"
                              ? "FE"
                              : "QA"}
                      </span>
                      <div>
                        <h3>{roleNames[role]}</h3>
                        <p>
                          {role === "tech-lead"
                            ? "Coordinates the team and routes work"
                            : role === "qa_engineer"
                              ? "Checks changes and reports findings"
                              : "Implements assigned work"}
                        </p>
                      </div>
                    </div>
                    <span className="count-chip">
                      {
                        Object.values(config.profiles).filter(
                          (p) => p.role === role,
                        ).length
                      }{" "}
                      profiles
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>PROFILE</th>
                          <th>AGENT</th>
                          <th>MODEL</th>
                          <th>DEFAULT</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(config.profiles)
                          .filter(([, p]) => p.role === role)
                          .map(([id, p]) => (
                            <tr
                              key={id}
                              className={
                                warningFields[`profiles.${id}.kind`] ||
                                !agents.some((a) => a.kind === p.kind)
                                  ? "needs-attention"
                                  : undefined
                              }
                            >
                              <td>
                                <strong>{id}</strong>
                                {(warningFields[`profiles.${id}.kind`] ||
                                  !agents.some((a) => a.kind === p.kind)) && (
                                  <small className="field-error">
                                    {warningFields[`profiles.${id}.kind`] ??
                                      `Unknown agent kind: ${p.kind}`}
                                  </small>
                                )}
                                <small className="sub-cell">
                                  {p.definition}
                                </small>
                              </td>
                              <td>
                                {agents.find((a) => a.kind === p.kind)?.label ??
                                  p.kind}
                              </td>
                              <td>
                                {p.model || <span className="muted">Auto</span>}
                              </td>
                              <td>
                                {config.defaultProfiles[role] === id ? (
                                  <span className="default-tag">Default</span>
                                ) : (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      update((d) => {
                                        d.defaultProfiles[role] = id;
                                      })
                                    }
                                  >
                                    Set default
                                  </button>
                                )}
                                {fieldErrors[`defaultProfiles.${role}`] && (
                                  <small className="field-error">
                                    {fieldErrors[`defaultProfiles.${role}`]}
                                  </small>
                                )}
                              </td>
                              <td className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${id}`}
                                  onClick={() => void beginEdit(id)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Duplicate ${id}`}
                                  onClick={() => beginDuplicate(id)}
                                >
                                  Duplicate
                                </button>
                                <button
                                  className="icon-button danger"
                                  aria-label={`Delete ${id}`}
                                  disabled={config.defaultProfiles[role] === id}
                                  onClick={(e) => {
                                    dialogTrigger.current = e.currentTarget;
                                    setDeleteProfileId(id);
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}
        {tab === "Team policy" && (
          <section className="panel policy-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">CAPACITY & TIMING</span>
                <h2>Team policy</h2>
                <p>
                  Set the maximum number of instances the orchestrator may
                  start.
                </p>
              </div>
            </div>
            <div className="policy-grid">
              <NumberSetting
                title="Tech leads"
                description="Concurrent tech leads per run"
                value={config.spawnPolicy.maxTechLeads}
                min={1}
                max={6}
                onChange={(v) =>
                  update((d) => {
                    d.spawnPolicy.maxTechLeads = v;
                  })
                }
              />
              <FieldError
                fields={fieldErrors}
                prefix="spawnPolicy.maxTechLeads"
              />
              <NumberSetting
                title="Backend developers"
                description="Per tech lead"
                value={config.spawnPolicy.maxDevsPerTechLead.backend_dev}
                min={0}
                max={6}
                onChange={(v) =>
                  update((d) => {
                    d.spawnPolicy.maxDevsPerTechLead.backend_dev = v;
                  })
                }
              />
              <FieldError
                fields={fieldErrors}
                prefix="spawnPolicy.maxDevsPerTechLead.backend_dev"
              />
              <NumberSetting
                title="Frontend developers"
                description="Per tech lead"
                value={config.spawnPolicy.maxDevsPerTechLead.frontend_dev}
                min={0}
                max={6}
                onChange={(v) =>
                  update((d) => {
                    d.spawnPolicy.maxDevsPerTechLead.frontend_dev = v;
                  })
                }
              />
              <FieldError
                fields={fieldErrors}
                prefix="spawnPolicy.maxDevsPerTechLead.frontend_dev"
              />
              <NumberSetting
                title="QA engineers"
                description="Per tech lead"
                value={config.spawnPolicy.maxQaPerTechLead}
                min={0}
                max={4}
                onChange={(v) =>
                  update((d) => {
                    d.spawnPolicy.maxQaPerTechLead = v;
                  })
                }
              />
              <FieldError
                fields={fieldErrors}
                prefix="spawnPolicy.maxQaPerTechLead"
              />
            </div>
            <div className="section-divider" />
            <h3 className="subsection-title">Default profile per role</h3>
            <p className="subsection-copy">
              The orchestrator uses these profiles when starting each role.
            </p>
            <div className="defaults-grid">
              {roles.map((role) => (
                <label className="form-field" key={role}>
                  <span>{roleNames[role]}</span>
                  <select
                    value={config.defaultProfiles[role]}
                    onChange={(e) =>
                      update((d) => {
                        d.defaultProfiles[role] = e.target.value;
                      })
                    }
                  >
                    {Object.entries(config.profiles)
                      .filter(([, p]) => p.role === role)
                      .map(([id]) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                  </select>
                  {fieldErrors[`defaultProfiles.${role}`] && (
                    <small className="field-error">
                      {fieldErrors[`defaultProfiles.${role}`]}
                    </small>
                  )}
                </label>
              ))}
            </div>
            <div className="section-divider" />
            <h3 className="subsection-title">Run timing</h3>
            <div className="timing-grid">
              <NumberSetting
                title="Agent timeout"
                description="Maximum run duration, seconds"
                value={config.timeoutMs / 1000}
                min={1}
                max={86400}
                onChange={(v) =>
                  update((d) => {
                    d.timeoutMs = v * 1000;
                  })
                }
              />
              <FieldError fields={fieldErrors} prefix="timeoutMs" />
              <NumberSetting
                title="Startup timeout"
                description="Wait for an agent to start, seconds"
                value={config.startTimeoutMs / 1000}
                min={1}
                max={3600}
                onChange={(v) =>
                  update((d) => {
                    d.startTimeoutMs = v * 1000;
                  })
                }
              />
              <FieldError fields={fieldErrors} prefix="startTimeoutMs" />
              <NumberSetting
                title="Maximum QA rounds"
                description="Failed rounds before asking the operator"
                value={config.maxRounds}
                min={1}
                max={20}
                onChange={(v) =>
                  update((d) => {
                    d.maxRounds = v;
                  })
                }
              />
              <FieldError fields={fieldErrors} prefix="maxRounds" />
            </div>
          </section>
        )}
        {tab === "Definitions" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PROMPT LIBRARY</span>
                <h2>Agent definitions</h2>
                <p>Instructions that are loaded when an agent starts.</p>
              </div>
              <button
                className="button primary"
                onClick={(e) => {
                  dialogTrigger.current = e.currentTarget;
                  createDefinition();
                }}
              >
                ＋ New definition
              </button>
            </div>
            <div className="definition-list">
              {config.definitions.map((d) => (
                <article className="definition-row" key={d.name}>
                  <div className="doc-icon">▤</div>
                  <div className="definition-info">
                    <strong>{d.name}</strong>
                    <small>{d.path}</small>
                  </div>
                  {d.builtin && <span className="builtin-tag">Built in</span>}
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      onClick={() => void openDefinition(d.name)}
                    >
                      Edit
                    </button>
                    {!d.builtin && (
                      <button
                        className="icon-button danger"
                        onClick={(e) => {
                          dialogTrigger.current = e.currentTarget;
                          setDeleteDefinitionName(d.name);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "Routing" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">MESSAGE FLOW</span>
                <h2>Routing rules</h2>
                <p>
                  Messages move through fixed routes to keep ownership clear.
                </p>
              </div>
              <span className="read-only-tag">⌑ Read only</span>
            </div>
            <div className="routing-note">
              <span>ⓘ</span>
              <p>
                Enforced by the orchestrator via{" "}
                <code>.herdr/route-check.mjs</code>. Editing here does not
                change routing.
              </p>
            </div>
            <div className="routing-list">
              {config.routing.map((rule, i) => (
                <article className="route-row" key={`${rule.sender}-${i}`}>
                  <div className="route-end">
                    <span className="route-label">FROM</span>
                    <strong>{rule.sender}</strong>
                  </div>
                  <span className="route-arrow">→</span>
                  <div className="route-end">
                    <span className="route-label">TO</span>
                    <strong>{rule.recipient}</strong>
                  </div>
                  <div className="route-types">
                    <span className="route-label">MESSAGE TYPES</span>
                    <div>
                      {rule.types.map((t) => (
                        <span key={t} className="type-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    {rule.condition && (
                      <small>
                        {rule.condition.toLowerCase().includes("owner")
                          ? `Owner condition: ${rule.condition}`
                          : rule.condition}
                      </small>
                    )}
                  </div>
                  <span className="lock">⌑</span>
                </article>
              ))}
            </div>
          </section>
        )}
        <footer className="footer">
          <span>Config: {status?.configPath ?? "local workspace"}</span>
          <span>Changes are saved to this machine only.</span>
        </footer>
      </main>
      {editing !== null && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <header className="drawer-head">
              <div>
                <span className="eyebrow">PROFILE EDITOR</span>
                <h2 id="editor-title">
                  {newProfile ? "New profile" : `Edit ${editing}`}
                </h2>
              </div>
              <button
                className="close-button"
                aria-label="Close editor"
                onClick={closeEditor}
              >
                ×
              </button>
            </header>
            <form
              className="drawer-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveProfile(e.currentTarget);
              }}
            >
              <label className="form-field">
                <span>Profile ID</span>
                <input
                  name="id"
                  defaultValue={
                    newProfile
                      ? cloneProfile
                        ? `${editing}-copy`
                        : ""
                      : editing || ""
                  }
                  placeholder="frontend-default"
                  required
                />
                <small>Lowercase letters, numbers, and hyphens.</small>
                {fieldErrors["profile.id"] && (
                  <small className="field-error">
                    {fieldErrors["profile.id"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Role</span>
                <select name="role" defaultValue={profile?.role ?? "tech-lead"}>
                  {roles.map((r) => (
                    <option value={r} key={r}>
                      {roleNames[r]}
                    </option>
                  ))}
                </select>
                {fieldErrors["profile.role"] && (
                  <small className="field-error">
                    {fieldErrors["profile.role"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Agent kind</span>
                <select
                  name="kind"
                  value={editorKind}
                  onChange={(e) => {
                    const kind = e.target.value as Agent["kind"];
                    setEditorKind(kind);
                    setModelError(null);
                    if (agents.find((a) => a.kind === kind)?.modelFlag === null)
                      setEditorModel("");
                    setEditorMode("default");
                    setModelChoices(
                      agents.find((a) => a.kind === kind)?.models ?? [],
                    );
                    if (kind === "pi") fetchModels(kind, "", true);
                  }}
                >
                  {agents.map((a) => (
                    <option value={a.kind} key={a.kind}>
                      {a.label}
                      {a.installed ? "" : " · not installed"}
                    </option>
                  ))}
                </select>
                {fieldErrors["profile.kind"] && (
                  <small className="field-error">
                    {fieldErrors["profile.kind"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Model</span>
                <input
                  name="model"
                  list="models"
                  value={editorModel}
                  disabled={
                    agents.find((a) => a.kind === editorKind)?.modelFlag ===
                    null
                  }
                  onChange={(e) => {
                    setEditorModel(e.target.value);
                    fetchModels(editorKind, e.target.value);
                  }}
                  placeholder="Auto / choose or enter a model"
                />
                <datalist id="models">
                  {(modelChoices.length
                    ? modelChoices
                    : (agents.find((a) => a.kind === editorKind)?.models ?? [])
                  ).map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </datalist>
                <small>
                  {modelError ??
                    (modelBusy
                      ? "Searching Pi models…"
                      : agents.find((a) => a.kind === editorKind)?.modelFlag ===
                          null
                        ? "This CLI has no model flag; put model options in Extra arguments."
                        : editorKind === "pi"
                          ? "Pi models are discovered live. You can also enter a custom value."
                          : "Model is not verified for this CLI. Suggestions are fallbacks; custom values are allowed.")}
                </small>
                {fieldErrors["profile.model"] && (
                  <small className="field-error">
                    {fieldErrors["profile.model"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Mode</span>
                <select
                  name="mode"
                  value={editorMode}
                  onChange={(e) => setEditorMode(e.target.value)}
                >
                  {(
                    agents.find((a) => a.kind === editorKind)?.modes ?? [
                      { value: "default", label: "Default" },
                    ]
                  ).map((m) => (
                    <option value={m.value} key={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {fieldErrors["profile.mode"] && (
                  <small className="field-error">
                    {fieldErrors["profile.mode"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Extra arguments</span>
                <textarea
                  name="extraArgs"
                  rows={3}
                  defaultValue={profile?.extraArgs.join("\n") ?? ""}
                  placeholder="One argument per line"
                />
                {fieldErrors["profile.extraArgs"] && (
                  <small className="field-error">
                    {fieldErrors["profile.extraArgs"]}
                  </small>
                )}
                <small>Each line is passed as one argument.</small>
              </label>
              <label className="form-field">
                <span>Definition</span>
                <select
                  name="definition"
                  defaultValue={
                    profile?.definition ?? config.definitions[0]?.path ?? ""
                  }
                >
                  {config.definitions.map((d) => (
                    <option value={d.path} key={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {fieldErrors["profile.definition"] && (
                  <small className="field-error">
                    {fieldErrors["profile.definition"]}
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Task instructions</span>
                <textarea
                  name="task"
                  rows={5}
                  defaultValue={profile?.task ?? ""}
                  placeholder="Describe the work for this role…"
                />
                {fieldErrors["profile.task"] && (
                  <small className="field-error">
                    {fieldErrors["profile.task"]}
                  </small>
                )}
              </label>
              <footer className="drawer-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  {newProfile ? "Add profile" : "Apply to draft"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {definitionName !== null && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDefinitionName(null);
          }}
        >
          <section
            ref={dialogRef}
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-definition-title"
            aria-describedby="new-definition-description"
          >
            <h2 id="new-definition-title">New definition</h2>
            <p id="new-definition-description" className="sr-only">
              Choose a filename for the new agent definition.
            </p>
            <label className="form-field">
              <span>Filename</span>
              <input
                value={definitionName}
                onChange={(e) => setDefinitionName(e.target.value)}
                placeholder="design-review.md"
              />
            </label>
            <footer className="drawer-footer">
              <button
                className="button secondary"
                onClick={() => setDefinitionName(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={confirmCreateDefinition}
              >
                Continue
              </button>
            </footer>
          </section>
        </div>
      )}
      {deleteDefinitionName && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteDefinitionName(null);
          }}
        >
          <section
            ref={dialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-definition-title"
            aria-describedby="delete-definition-description"
          >
            <h2 id="delete-definition-title">Delete definition?</h2>
            <p id="delete-definition-description">Delete {deleteDefinitionName}?</p>
            <footer className="drawer-footer">
              <button
                className="button secondary"
                onClick={() => setDeleteDefinitionName(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => void removeDefinition(deleteDefinitionName)}
              >
                Delete definition
              </button>
            </footer>
          </section>
        </div>
      )}
      {deleteProfileId && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteProfileId(null);
          }}
        >
          <section
            ref={dialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-profile-title"
            aria-describedby="delete-profile-description"
          >
            <h2 id="delete-profile-title">Delete profile?</h2>
            <p id="delete-profile-description">
              Delete {deleteProfileId} from the draft?
            </p>
            <footer className="drawer-footer">
              <button
                className="button secondary"
                onClick={() => setDeleteProfileId(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => {
                  update((d) => {
                    delete d.profiles[deleteProfileId];
                  });
                  setDeleteProfileId(null);
                }}
              >
                Delete profile
              </button>
            </footer>
          </section>
        </div>
      )}
      {definitionEdit && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDefinitionEdit(null);
          }}
        >
          <section
            className="drawer definition-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="definition-title"
          >
            <header className="drawer-head">
              <div>
                <span className="eyebrow">AGENT INSTRUCTIONS</span>
                <h2 id="definition-title">{definitionEdit.name}</h2>
              </div>
              <button
                className="close-button"
                aria-label="Close editor"
                onClick={() => setDefinitionEdit(null)}
              >
                ×
              </button>
            </header>
            <p className="definition-hint">
              Markdown file stored under <code>.herdr/agents/</code>
              {definitionEdit.builtin
                ? " · built in definitions can be edited but not deleted."
                : ""}
            </p>
            <label className="form-field">
              <span>Content</span>
              <textarea
                className="code-editor"
                value={definitionEdit.content}
                onChange={(e) =>
                  setDefinitionEdit({
                    ...definitionEdit,
                    content: e.target.value,
                  })
                }
                rows={24}
                maxLength={65536}
              />
            </label>
            <footer className="drawer-footer">
              <button
                className="button secondary"
                onClick={() => setDefinitionEdit(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => void saveDefinition()}
              >
                Save definition
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function configBody(config: ConfigResponse): Config {
  const {
    configSource: _source,
    routing: _routing,
    warnings: _warnings,
    ...body
  } = config;
  return body;
}

function configWarnings(config: ConfigResponse | null): Record<string, string> {
  const warnings = config?.warnings;
  if (!warnings) return {};
  if (Array.isArray(warnings)) {
    return Object.fromEntries(
      warnings.map((warning) =>
        typeof warning === "string"
          ? [warning, "This configuration value needs attention."]
          : [
              warning.field,
              warning.message ?? "This configuration value needs attention.",
            ],
      ),
    );
  }
  return warnings;
}

function normalizeErrors(fields: Record<string, string>) {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];
  const validFields = new Set([
    "id",
    "role",
    "kind",
    "model",
    "mode",
    "extraArgs",
    "definition",
    "task",
  ]);
  for (const [key, message] of Object.entries(fields)) {
    const profileField = key.match(/^profiles\.[^.]+\.(.+)$/)?.[1];
    if (key === "id" || profileField === "id") mapped["profile.id"] = message;
    else if (
      key.startsWith("profiles.") &&
      profileField &&
      validFields.has(profileField)
    )
      mapped[`profile.${profileField}`] = message;
    else if (
      /^(spawnPolicy\.|maxRounds$|timeoutMs$|startTimeoutMs$|defaultProfiles\.)/.test(
        key,
      )
    )
      mapped[key] = message;
    else unmapped.push(`${key}: ${message}`);
  }
  return { mapped, unmapped };
}

function FieldError({
  fields,
  prefix,
  exclude = [],
}: {
  fields: Record<string, string>;
  prefix: string;
  exclude?: string[];
}) {
  const messages = Object.entries(fields)
    .filter(
      ([key]) =>
        (key === prefix || key.startsWith(`${prefix}.`)) &&
        !exclude.includes(key),
    )
    .map(([key, message]) => ({ key, message }));
  return (
    <>
      {messages.map(({ key, message }) => (
        <p key={key} className="field-error">
          {message}
        </p>
      ))}
    </>
  );
}

function NumberSetting({
  title,
  description,
  value,
  min,
  max,
  onChange,
}: {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-setting">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <div className="stepper">
        <button
          aria-label={`Decrease ${title}`}
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          aria-label={title}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) =>
            onChange(
              Math.min(max, Math.max(min, Number(e.target.value) || min)),
            )
          }
        />
        <button
          aria-label={`Increase ${title}`}
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          ＋
        </button>
      </div>
    </label>
  );
}

function AgentTable({
  agents,
  installedOnly,
}: {
  agents: Agent[];
  installedOnly: boolean;
}) {
  const items = installedOnly ? agents.filter((a) => a.installed) : agents;
  return (
    <div className="table-scroll">
      <table className="agent-table">
        <thead>
          <tr>
            <th>AGENT</th>
            <th>INSTALLATION</th>
            <th>BINARY</th>
            <th>MODEL SUPPORT</th>
            <th>MODES</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.kind}>
              <td>
                <div className="agent-name">
                  <span className={`agent-avatar avatar-${a.kind}`}>
                    {a.label.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{a.label}</strong>
                    <small>{a.kind}</small>
                  </div>
                </div>
              </td>
              <td>
                {a.installed ? (
                  <span className="installed-tag">
                    <i />
                    Installed
                  </span>
                ) : (
                  <span className="muted">Not found</span>
                )}
                <small className="sub-cell">
                  {a.version ??
                    (a.installed
                      ? "Version unavailable"
                      : "Install CLI to use")}
                </small>
              </td>
              <td>
                <code>{a.binary}</code>
                {!a.binaryVerified && (
                  <small className="tag-line">Binary unverified</small>
                )}
              </td>
              <td>
                <span className="source-tag">
                  {a.models.length === 0
                    ? "Free text only"
                    : `Models: ${a.modelsSource}`}
                </span>
              </td>
              <td>
                <span className="source-tag">
                  {a.modesSource === "verified" ? "Verified" : "Default only"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="empty-state">No installed agents found.</div>
      )}
    </div>
  );
}
