import { z } from "zod";
import { CATALOG_BY_KIND, isAgentKind } from "./catalog.js";
import { encodeArgs } from "./codec.js";

const Role = z.enum(["tech-lead", "backend_dev", "frontend_dev", "qa_engineer"]);
const ProfileInput = z.object({
  role: Role, kind: z.string().refine(isAgentKind, "Unknown agent kind"), model: z.string().max(200).nullable(),
  mode: z.string().min(1).max(80), extraArgs: z.array(z.string().max(4096)).max(256),
  definition: z.string().regex(/^agents\/[a-z][a-z0-9-]{0,47}\.md$/), task: z.string().max(65536)
}).strict();
export const ConfigInput = z.object({
  version: z.literal(2), timeoutMs: z.number().int().min(1000).max(86400000),
  startTimeoutMs: z.number().int().min(1000).max(600000), maxRounds: z.number().int().min(1).max(50),
  spawnPolicy: z.object({
    maxTechLeads: z.number().int().min(1).max(6),
    maxDevsPerTechLead: z.object({ backend_dev: z.number().int().min(0).max(6), frontend_dev: z.number().int().min(0).max(6) }).strict(),
    maxQaPerTechLead: z.number().int().min(0).max(4)
  }).strict(),
  defaultProfiles: z.object({ "tech-lead": z.string(), backend_dev: z.string(), frontend_dev: z.string(), qa_engineer: z.string() }).strict(),
  profiles: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,39}$/), ProfileInput)
}).strict().superRefine((value, ctx) => {
  const roles = ["tech-lead", "backend_dev", "frontend_dev", "qa_engineer"] as const;
  for (const role of roles) {
    const id = value.defaultProfiles[role];
    const profile = value.profiles[id];
    if (!profile) ctx.addIssue({ code: "custom", path: ["defaultProfiles", role], message: `Default profile '${id}' does not exist` });
    else if (profile.role !== role) ctx.addIssue({ code: "custom", path: ["defaultProfiles", role], message: `Default profile '${id}' must have role ${role}` });
  }
  for (const [id, profile] of Object.entries(value.profiles)) {
    const catalog = CATALOG_BY_KIND.get(profile.kind);
    if (!catalog) {
      ctx.addIssue({ code: "custom", path: ["profiles", id, "kind"], message: "Unknown agent kind" });
      continue;
    }
    if (!catalog.modes.some((mode) => mode.value === profile.mode)) ctx.addIssue({ code: "custom", path: ["profiles", id, "mode"], message: `Unsupported mode for ${profile.kind}` });
    if (profile.model && !catalog.modelFlag) {
      // This profile can still pass a model via extra args; model field itself cannot.
      ctx.addIssue({ code: "custom", path: ["profiles", id, "model"], message: `This kind has no model flag` });
    }
  }
});
export type ConfigInputValue = z.infer<typeof ConfigInput>;

export function stripDefinitions(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { definitions: _definitions, ...rest } = value as Record<string, unknown>;
  return rest;
}

export function buildStoredConfig(input: ConfigInputValue, current: Record<string, unknown>): Record<string, unknown> {
  const previous = (current.profiles && typeof current.profiles === "object" ? current.profiles : {}) as Record<string, Record<string, unknown>>;
  const profiles: Record<string, unknown> = {};
  for (const [id, profile] of Object.entries(input.profiles)) {
    const old = previous[id];
    const lifecycle = old?.lifecycle ?? (profile.role === "tech-lead" ? "persistent" : "ephemeral");
    const worktree = old?.worktree ?? (profile.role !== "tech-lead");
    const cwd = old?.cwd ?? ".";
    profiles[id] = {
      role: profile.role, kind: profile.kind, lifecycle, cwd, worktree,
      args: encodeArgs(profile.model, profile.mode, profile.extraArgs, CATALOG_BY_KIND.get(profile.kind)!),
      prompt: profile.definition, task: profile.task
    };
  }
  return {
    version: 2, timeoutMs: input.timeoutMs, startTimeoutMs: input.startTimeoutMs, maxRounds: input.maxRounds,
    spawnPolicy: input.spawnPolicy, defaultProfiles: input.defaultProfiles, profiles
  };
}
