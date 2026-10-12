import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ConfigSource = "workflow.json" | "example" | "migrated";
export interface StoredConfig { config: Record<string, unknown>; source: ConfigSource }
const here = path.dirname(fileURLToPath(import.meta.url));
export const HERDR_DIR = path.resolve(process.env.HERDR_DIR || path.resolve(here, "../../.herdr"));
const CONFIG_PATH = path.join(HERDR_DIR, "workflow.json");
const EXAMPLE_PATH = path.join(HERDR_DIR, "workflow.json.example");
export const BUILTIN_DEFINITIONS = ["tech-lead.md", "be.md", "fe.md", "qa.md"] as const;
const definitionPattern = /^[a-z][a-z0-9-]{0,47}\.md$/;
const DEFAULT_POLICY = { maxTechLeads: 3, maxDevsPerTechLead: { backend_dev: 3, frontend_dev: 2 }, maxQaPerTechLead: 2 };

function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version === 2) return value;
  const roles = value.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) throw new Error("Invalid workflow configuration: roles must be an object");
  const profiles: Record<string, unknown> = {};
  const defaults: Record<string, string> = {};
  for (const [role, raw] of Object.entries(roles as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const old = raw as Record<string, unknown>;
    const id = role === "backend_dev" ? "backend-dev" : role === "frontend_dev" ? "frontend-dev" : role === "qa_engineer" ? "qa" : role;
    profiles[id] = { role, kind: old.kind, lifecycle: old.lifecycle, cwd: old.cwd ?? ".", worktree: old.worktree ?? (role !== "tech-lead"), args: old.args ?? [], prompt: old.prompt ?? `agents/${role}.md`, task: old.task ?? "" };
    defaults[role] = id;
  }
  return {
    version: 2, timeoutMs: value.timeoutMs ?? 1800000, startTimeoutMs: value.startTimeoutMs ?? 120000,
    maxRounds: value.maxRounds ?? 5, spawnPolicy: DEFAULT_POLICY,
    defaultProfiles: defaults, profiles
  };
}

export async function readConfig(): Promise<StoredConfig> {
  try {
    const raw = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Record<string, unknown>;
    const migrated = raw.version !== 2;
    return { config: migrateV1(raw), source: migrated ? "migrated" : "workflow.json" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const raw = JSON.parse(await readFile(EXAMPLE_PATH, "utf8")) as Record<string, unknown>;
  return { config: migrateV1(raw), source: "example" };
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
async function safeDefinitionPath(name: string, requireExists: boolean): Promise<string> {
  validateDefinitionName(name);
  await mkdir(HERDR_DIR, { recursive: true });
  const herdrRoot = await realpath(HERDR_DIR);
  const expectedAgentsDir = path.join(herdrRoot, "agents");
  await mkdir(expectedAgentsDir, { recursive: true });
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
  const filePath = await safeDefinitionPath(name, false);
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
}
export async function deleteDefinition(name: string): Promise<void> {
  validateDefinitionName(name);
  if ((BUILTIN_DEFINITIONS as readonly string[]).includes(name)) throw Object.assign(new Error("Built-in definitions cannot be deleted"), { code: "builtin_definition" });
  await rm(await safeDefinitionPath(name, true));
}
export function configPath(): string { return CONFIG_PATH; }
