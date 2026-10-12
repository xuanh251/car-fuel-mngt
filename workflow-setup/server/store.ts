import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigInput } from "./schema.js";
import { CATALOG_BY_KIND } from "./catalog.js";
import { decodeArgs } from "./codec.js";

export type ConfigSource = "workflow.json" | "migrated";
export interface StoredConfig { config: Record<string, unknown>; source: ConfigSource }
const here = path.dirname(fileURLToPath(import.meta.url));
export const HERDR_DIR = path.resolve(process.env.HERDR_DIR || path.resolve(here, "../../.herdr"));
const CONFIG_PATH = path.join(HERDR_DIR, "workflow.json");
export const BUILTIN_DEFINITIONS = ["tech-lead.md", "be.md", "fe.md", "qa.md"] as const;
const definitionPattern = /^[a-z][a-z0-9-]{0,47}\.md$/;
function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version === 2) return value;
  const roles = value.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) throw new Error("Invalid workflow configuration: roles must be an object");
  const profiles: Record<string, unknown> = {};
  for (const [role, raw] of Object.entries(roles as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const old = raw as Record<string, unknown>;
    const id = role === "backend_dev" ? "backend-dev" : role === "frontend_dev" ? "frontend-dev" : role === "qa_engineer" ? "qa" : role;
    profiles[id] = { ...old, role };
  }
  const result: Record<string, unknown> = { ...value, version: 2, profiles };
  delete result.roles;
  return result;
}

function invalidConfig(fields: Record<string, string>): Error {
  return Object.assign(new Error("Local workflow.json is invalid"), { code: "invalid_config", fields });
}

function validateStored(value: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};
  const top = ["version", "timeoutMs", "startTimeoutMs", "maxRounds", "spawnPolicy", "defaultProfiles", "profiles"];
  for (const key of top) if (!(key in value)) fields[key] = "Required";
  for (const key of Object.keys(value)) if (!top.includes(key)) fields[key] = "Unrecognized key";
  if (Object.keys(fields).length) return fields;
  const profiles = value.profiles;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return { profiles: "Expected object" };
  const uiProfiles: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(profiles as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { fields[`profiles.${id}`] = "Expected object"; continue; }
    const profile = raw as Record<string, unknown>;
    const required = ["role", "kind", "lifecycle", "cwd", "worktree", "args", "prompt", "task"];
    for (const key of required) if (!(key in profile)) fields[`profiles.${id}.${key}`] = "Required";
    for (const key of Object.keys(profile)) if (!required.includes(key)) fields[`profiles.${id}.${key}`] = "Unrecognized key";
    const catalog = CATALOG_BY_KIND.get(String(profile.kind) as import("./catalog.js").AgentKind);
    if (!catalog || !Array.isArray(profile.args)) { fields[`profiles.${id}.args`] = "Expected args array and known kind"; continue; }
    if (!(["persistent", "ephemeral"].includes(String(profile.lifecycle)) && typeof profile.cwd === "string" && typeof profile.worktree === "boolean")) {
      fields[`profiles.${id}`] = "Invalid persisted lifecycle, cwd, or worktree";
      continue;
    }
    try {
      uiProfiles[id] = {
        role: profile.role, kind: profile.kind, ...decodeArgs(profile.args as string[], catalog),
        definition: profile.prompt, task: profile.task
      };
    } catch { fields[`profiles.${id}.args`] = "Invalid arguments"; }
  }
  if (Object.keys(fields).length) return fields;
  const parsed = ConfigInput.safeParse({
    version: value.version, timeoutMs: value.timeoutMs, startTimeoutMs: value.startTimeoutMs,
    maxRounds: value.maxRounds, spawnPolicy: value.spawnPolicy, defaultProfiles: value.defaultProfiles,
    profiles: uiProfiles
  });
  if (!parsed.success) for (const issue of parsed.error.issues) fields[issue.path.map(String).join(".")] = issue.message;
  return fields;
}

export async function readConfig(): Promise<StoredConfig> {
  let text: string;
  try {
    text = await readFile(CONFIG_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw Object.assign(new Error(`Local workflow config is missing: ${CONFIG_PATH}`), { code: "missing_config" });
    throw error;
  }
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected an object");
    raw = parsed as Record<string, unknown>;
  } catch { throw invalidConfig({ $: "Must be valid JSON object" }); }
  const migrated = raw.version !== 2;
  let config: Record<string, unknown>;
  try { config = migrateV1(raw); } catch (error) { throw invalidConfig({ roles: (error as Error).message }); }
  const fields = validateStored(config);
  if (Object.keys(fields).length) throw invalidConfig(fields);
  return { config, source: migrated ? "migrated" : "workflow.json" };
}

export async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(HERDR_DIR, { recursive: true });
  const tempPath = path.join(HERDR_DIR, `.workflow-${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(tempPath, CONFIG_PATH);
  } finally { await rm(tempPath, { force: true }); }
}

export interface Definition { name: string; path: string; builtin: boolean }
export function validateDefinitionName(name: string): void {
  if (!definitionPattern.test(name) || name === ".md") throw Object.assign(new Error("Invalid definition name"), { code: "invalid_definition_name" });
}
async function safeDefinitionPath(name: string, requireExists: boolean, createDirectories = false): Promise<string> {
  validateDefinitionName(name);
  if (createDirectories) await mkdir(HERDR_DIR, { recursive: true });
  const herdrRoot = await realpath(HERDR_DIR);
  const expectedAgentsDir = path.join(herdrRoot, "agents");
  if (createDirectories) await mkdir(expectedAgentsDir, { recursive: true });
  const base = await realpath(expectedAgentsDir);
  if (base !== expectedAgentsDir) throw new Error("Agents directory must not be a symlink");
  const target = path.resolve(base, name);
  if (path.dirname(target) !== base) throw new Error("Definition path escapes agents directory");
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("Definition must be a regular file, not a symlink");
    const actual = await realpath(target);
    if (!actual.startsWith(`${base}${path.sep}`)) throw new Error("Definition path escapes agents directory");
    return actual;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && !requireExists) return target;
    throw error;
  }
}
export async function listDefinitions(): Promise<Definition[]> {
  let herdrRoot: string;
  try { herdrRoot = await realpath(HERDR_DIR); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const directory = path.join(herdrRoot, "agents");
  try { if (await realpath(directory) !== directory) throw new Error("Agents directory must not be a symlink"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const names = (await readdir(directory)).filter((name) => definitionPattern.test(name)).sort();
  return names.map((name) => ({ name, path: `agents/${name}`, builtin: (BUILTIN_DEFINITIONS as readonly string[]).includes(name) }));
}
export async function readDefinition(name: string): Promise<string> {
  return readFile(await safeDefinitionPath(name, true), "utf8");
}
export async function writeDefinition(name: string, content: string): Promise<void> {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes < 1 || bytes > 65536) throw Object.assign(new Error("Definition content must be 1 to 65536 bytes"), { code: "definition_size" });
  const filePath = await safeDefinitionPath(name, false, true);
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
}
export async function deleteDefinition(name: string): Promise<void> {
  validateDefinitionName(name);
  if ((BUILTIN_DEFINITIONS as readonly string[]).includes(name)) throw Object.assign(new Error("Built-in definitions cannot be deleted"), { code: "builtin_definition" });
  await rm(await safeDefinitionPath(name, true));
}
export function configPath(): string { return CONFIG_PATH; }
