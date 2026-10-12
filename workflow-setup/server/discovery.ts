import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants, stat } from "node:fs/promises";
import path from "node:path";
import { CATALOG, CATALOG_BY_KIND, type AgentKind } from "./catalog.js";

const exec = promisify(execFile);
const CACHE_MS = 60_000;
type CacheValue<T> = { expires: number; value: T };
let agentsCache: CacheValue<unknown> | undefined;
const piCache = new Map<string, CacheValue<{ models: Array<{ value: string; label: string }>; truncated: boolean }>>();

export async function findExecutable(binary: string): Promise<string | null> {
  for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.resolve(entry, binary);
    try {
      await access(candidate, constants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* continue searching PATH */ }
  }
  return null;
}

async function versionOf(executable: string, args: string[]): Promise<string | null> {
  try {
    const result = await exec(executable, args, { timeout: 3000, maxBuffer: 65536, shell: false, windowsHide: true });
    const first = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first ? first.slice(0, 80) : null;
  } catch { return null; }
}

export async function piModels(search = ""): Promise<{ models: Array<{ value: string; label: string }>; truncated: boolean }> {
  const key = search;
  const cached = piCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const pi = CATALOG_BY_KIND.get("pi")!;
  const executable = await findExecutable(pi.binary);
  if (!executable) return { models: [], truncated: false };
  try {
    const args = ["--list-models", ...(search ? [search] : [])];
    const { stdout } = await exec(executable, args, { timeout: 10000, maxBuffer: 2 * 1024 * 1024, shell: false, windowsHide: true });
    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed: Array<{ value: string; label: string }> = [];
    for (const line of lines) {
      if (/^provider\s+/i.test(line)) continue;
      const columns = line.split(/\s+/);
      if (columns.length < 2 || !/^[\w.-]+$/.test(columns[0]!)) continue;
      const value = `${columns[0]}/${columns[1]}`;
      if (!parsed.some((item) => item.value === value)) parsed.push({ value, label: value });
    }
    const result = { models: parsed.slice(0, 500), truncated: parsed.length > 500 };
    piCache.set(key, { value: result, expires: Date.now() + CACHE_MS });
    return result;
  } catch { return { models: [], truncated: false }; }
}

export async function agentsCatalog() {
  if (agentsCache && agentsCache.expires > Date.now()) return agentsCache.value;
  const kinds = await Promise.all(CATALOG.map(async (entry) => {
    const executable = await findExecutable(entry.binary);
    return {
      kind: entry.kind, label: entry.label, binary: entry.binary, binaryVerified: entry.binaryVerified,
      installed: executable !== null, version: executable ? await versionOf(executable, entry.versionArgs) : null,
      modelFlag: entry.modelFlag, modelsSource: entry.models.source,
      models: entry.models.source === "discovered" ? (await piModels("")).models : entry.models.list,
      modesSource: entry.binaryVerified && ["claude", "codex"].includes(entry.kind) ? "verified" as const : "default-only" as const,
      modes: entry.modes.map(({ value, label, args }) => ({ value, label, args }))
    };
  }));
  const value = { kinds };
  agentsCache = { value, expires: Date.now() + CACHE_MS };
  return value;
}

export async function modelsFor(kind: AgentKind, search: string) {
  if (kind === "pi") return { kind, modelsSource: "discovered" as const, ...(await piModels(search)) };
  const entry = CATALOG_BY_KIND.get(kind)!;
  return { kind, modelsSource: "fallback" as const, models: entry.models.list, truncated: false };
}
export function invalidateDiscoveryCache(): void { agentsCache = undefined; piCache.clear(); }
