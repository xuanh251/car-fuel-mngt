import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_BY_KIND, isAgentKind, type AgentKind } from "./catalog.js";
import { decodeArgs } from "./codec.js";
import { agentsCatalog, modelsFor } from "./discovery.js";
import { BUILTIN_DEFINITIONS, configPath, HERDR_DIR, listDefinitions, readConfig, readDefinition, writeConfig, writeDefinition, deleteDefinition } from "./store.js";
import { buildStoredConfig, ConfigInput, stripDefinitions } from "./schema.js";
import { ROUTING_RULES } from "../../.herdr/route-check.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(here, "../web/dist");
const MAX_BODY = 256 * 1024;
const configuredPort = Number(process.env.PORT || 4317);
const origins = new Set((process.env.ALLOWED_ORIGINS || `http://127.0.0.1:${configuredPort},http://localhost:${configuredPort},http://127.0.0.1:5174,http://localhost:5174`).split(",").map((item) => item.trim()).filter(Boolean));

function send(res: ServerResponse, status: number, value?: unknown): void {
  if (status === 204) { res.writeHead(status); res.end(); return; }
  const body = Buffer.from(JSON.stringify(value ?? {}));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": body.length, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}
function fail(res: ServerResponse, status: number, error: string, message: string, fields?: Record<string, string>): void {
  send(res, status, { error, message, ...(fields ? { fields } : {}) });
}
function safeEqualOrigin(origin: string): boolean { return origins.has(origin); }
function hostAllowed(req: IncomingMessage): boolean {
  const host = req.headers.host?.toLowerCase();
  return host === `127.0.0.1:${configuredPort}` || host === `localhost:${configuredPort}` || host === `[::1]:${configuredPort}` || host === "127.0.0.1:5174" || host === "localhost:5174" || host === "[::1]:5174";
}
async function bodyJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request body exceeds 256 KB"), { status: 413 });
    chunks.push(data);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 }); }
}
function schemaFields(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.map(String).join(".")] = issue.message;
  return fields;
}
const FIRST_RUN_DEFAULTS = {
  configSource: "missing", version: 2,
  spawnPolicy: { maxTechLeads: 3, maxDevsPerTechLead: { backend_dev: 3, frontend_dev: 2 }, maxQaPerTechLead: 2 },
  defaultProfiles: { "tech-lead": "", backend_dev: "", frontend_dev: "", qa_engineer: "" }, profiles: {},
  timeoutMs: 1800000, startTimeoutMs: 120000, maxRounds: 5
};
async function sendStatic(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 404, "not_found", "Route not found");
  let requested: string;
  try { requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1)); }
  catch { return fail(res, 400, "bad_request", "Malformed path encoding"); }
  let filePath = path.resolve(DIST_DIR, requested);
  if (!filePath.startsWith(`${DIST_DIR}${path.sep}`)) return fail(res, 404, "not_found", "File not found");
  try { if (!(await lstat(filePath)).isFile()) throw new Error("not a file"); }
  catch { filePath = path.join(DIST_DIR, "index.html"); }
  try {
    const data = await readFile(filePath);
    const type = filePath.endsWith(".html") ? "text/html; charset=utf-8" : filePath.endsWith(".js") ? "text/javascript; charset=utf-8" : filePath.endsWith(".css") ? "text/css; charset=utf-8" : filePath.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    res.writeHead(200, { "content-type": type, "content-length": data.length, "x-content-type-options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch { fail(res, 503, "web_not_built", "Run npm run build to create web assets"); }
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!hostAllowed(req)) return fail(res, 403, "bad_host", "Host header is not allowed");
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    if (origin && !safeEqualOrigin(origin)) return fail(res, 403, "bad_origin", "Origin is not allowed");
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers["content-type"] || "")) return fail(res, 415, "unsupported_media_type", "Content-Type must be application/json");
  }
  let url: URL;
  try { url = new URL(req.url || "/", `http://${req.headers.host}`); }
  catch { return fail(res, 400, "bad_request", "Invalid request URL"); }
  const { pathname, searchParams } = url;
  try {
    if (pathname === "/api/status" && req.method === "GET") {
      let configSource = "missing";
      try { configSource = (await readConfig()).source; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "missing_config") throw error; }
      return send(res, 200, { herdrDir: HERDR_DIR, configSource, configPath: configPath() });
    }
    if (pathname === "/api/agents" && req.method === "GET") return send(res, 200, await agentsCatalog());
    const modelMatch = pathname.match(/^\/api\/agents\/([^/]+)\/models$/);
    if (modelMatch && req.method === "GET") {
      let kind: string;
      try { kind = decodeURIComponent(modelMatch[1]!); } catch { return fail(res, 400, "bad_request", "Malformed path encoding"); }
      if (!isAgentKind(kind)) return fail(res, 404, "unknown_kind", `Unknown agent kind '${kind}'`);
      const search = searchParams.get("search") || "";
      if (search.length > 64 || search.startsWith("-") || !/^[A-Za-z0-9._:/ -]*$/.test(search)) return fail(res, 422, "validation_failed", "Invalid search", { search: "Use at most 64 letters, digits, spaces, or . _ : / -; must not start with -" });
      return send(res, 200, await modelsFor(kind, search));
    }
    if (pathname === "/api/config" && req.method === "GET") {
      let stored;
      try { stored = await readConfig(); }
      catch (error) {
        const err = error as NodeJS.ErrnoException & { fields?: Record<string, string> };
        if (err.code === "missing_config") return send(res, 409, { error: "missing_config", message: err.message, defaults: { ...FIRST_RUN_DEFAULTS, definitions: await listDefinitions(), routing: ROUTING_RULES, warnings: {} } });
        throw error;
      }
      const rawProfiles = stored.config.profiles as Record<string, Record<string, unknown>>;
      const profiles: Record<string, unknown> = {};
      const warnings: Record<string, string> = {};
      for (const [id, profile] of Object.entries(rawProfiles)) {
        const kind = String(profile.kind);
        const catalog = CATALOG_BY_KIND.get(kind as AgentKind);
        if (!catalog) { profiles[id] = { role: profile.role, kind, model: null, mode: "default", extraArgs: Array.isArray(profile.args) ? profile.args : [], definition: profile.prompt, task: profile.task }; warnings[`profiles.${id}.kind`] = `Unknown agent kind '${kind}'`; continue; }
        const decoded = decodeArgs(Array.isArray(profile.args) ? profile.args as string[] : [], catalog);
        profiles[id] = { role: profile.role, kind, ...decoded, definition: profile.prompt, task: profile.task };
      }
      return send(res, 200, {
        configSource: stored.source, version: 2, spawnPolicy: stored.config.spawnPolicy,
        defaultProfiles: stored.config.defaultProfiles, profiles, definitions: await listDefinitions(),
        timeoutMs: stored.config.timeoutMs, startTimeoutMs: stored.config.startTimeoutMs,
        maxRounds: stored.config.maxRounds, routing: ROUTING_RULES, warnings
      });
    }
    if (pathname === "/api/config" && req.method === "PUT") {
      const body = await bodyJson(req);
      const parsed = ConfigInput.safeParse(stripDefinitions(body));
      if (!parsed.success) return fail(res, 422, "validation_failed", "Configuration failed validation", schemaFields(parsed.error.issues));
      const present = new Set((await listDefinitions()).map((item) => `agents/${item.name}`));
      const missing: Record<string, string> = {};
      for (const [id, profile] of Object.entries(parsed.data.profiles)) if (!present.has(profile.definition)) missing[`profiles.${id}.definition`] = "Definition does not exist";
      if (Object.keys(missing).length) return fail(res, 422, "validation_failed", "Configuration failed validation", missing);
      let current: Awaited<ReturnType<typeof readConfig>> | undefined;
      try { current = await readConfig(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "missing_config") throw error; }
      await writeConfig(buildStoredConfig(parsed.data, current?.config ?? {}));
      // Return the same decoded representation as GET.
      const saved = await readConfig();
      const rawProfiles = saved.config.profiles as Record<string, Record<string, unknown>>;
      const profiles: Record<string, unknown> = {};
      for (const [id, profile] of Object.entries(rawProfiles)) {
        const catalog = CATALOG_BY_KIND.get(String(profile.kind) as AgentKind)!;
        profiles[id] = { role: profile.role, kind: profile.kind, ...decodeArgs(profile.args as string[], catalog), definition: profile.prompt, task: profile.task };
      }
      return send(res, 200, { configSource: "workflow.json", version: 2, spawnPolicy: saved.config.spawnPolicy, defaultProfiles: saved.config.defaultProfiles, profiles, definitions: await listDefinitions(), timeoutMs: saved.config.timeoutMs, startTimeoutMs: saved.config.startTimeoutMs, maxRounds: saved.config.maxRounds, routing: ROUTING_RULES });
    }
    const definitionMatch = pathname.match(/^\/api\/definitions\/([^/]+)$/);
    if (definitionMatch) {
      let name: string;
      try { name = decodeURIComponent(definitionMatch[1]!); } catch { return fail(res, 400, "bad_request", "Malformed path encoding"); }
      if (req.method === "GET") {
        const content = await readDefinition(name);
        return send(res, 200, { name, path: `agents/${name}`, builtin: (BUILTIN_DEFINITIONS as readonly string[]).includes(name), content });
      }
      if (req.method === "PUT") {
        const body = await bodyJson(req);
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as Record<string, unknown>).content !== "string") return fail(res, 422, "validation_failed", "Body must contain only string content", { content: "Required string" });
        await writeDefinition(name, (body as { content: string }).content);
        return send(res, 200, { name, path: `agents/${name}`, builtin: (BUILTIN_DEFINITIONS as readonly string[]).includes(name), content: (body as { content: string }).content });
      }
      if (req.method === "DELETE") {
        if ((BUILTIN_DEFINITIONS as readonly string[]).includes(name)) return fail(res, 409, "builtin_definition", "Built-in definitions cannot be deleted");
        const stored = await readConfig();
        const profiles = stored.config.profiles as Record<string, Record<string, unknown>>;
        if (Object.values(profiles).some((profile) => profile.prompt === `agents/${name}`)) return fail(res, 409, "definition_in_use", "A profile uses this definition");
        await deleteDefinition(name);
        return send(res, 204);
      }
    }
    if (pathname.startsWith("/api/")) return fail(res, 404, "not_found", "API route not found");
    return await sendStatic(req, res, pathname);
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number; code?: string };
    if (err.code === "missing_config") return fail(res, 409, "missing_config", err.message);
    if (err.code === "invalid_config") return send(res, 422, { error: "invalid_config", message: err.message, fields: (err as typeof err & { fields?: Record<string, string> }).fields ?? {} });
    if (err.status) return fail(res, err.status, err.status === 413 ? "body_too_large" : "bad_json", err.message);
    if (err.code === "ENOENT") return fail(res, 404, "not_found", "Definition or resource not found");
    if (err.code === "builtin_definition" || err.code === "definition_in_use") return fail(res, 409, err.code, err.message);
    if (err.code === "invalid_definition_name") return fail(res, 422, "validation_failed", err.message, { name: err.message });
    if (err.code === "definition_size") return fail(res, 422, "validation_failed", err.message, { content: err.message });
    return fail(res, 500, "internal_error", "Request could not be completed");
  }
}
