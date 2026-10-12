export type Role = "tech-lead" | "backend_dev" | "frontend_dev" | "qa_engineer";
export type AgentKind =
  | "pi"
  | "claude"
  | "codex"
  | "gemini"
  | "cursor"
  | "devin"
  | "agy"
  | "cline"
  | "omp"
  | "mastracode"
  | "opencode"
  | "copilot"
  | "kimi"
  | "kiro"
  | "droid"
  | "amp"
  | "grok"
  | "hermes"
  | "kilo"
  | "qodercli"
  | "qwen"
  | "letta"
  | "maki"
  | "muse";
export interface Choice {
  value: string;
  label: string;
  args?: string[];
}
export interface Agent {
  kind: AgentKind;
  label: string;
  binary: string;
  binaryVerified: boolean;
  installed: boolean;
  version: string | null;
  modelFlag: string | null;
  modelsSource: "discovered" | "fallback";
  models: Choice[];
  modesSource: "verified" | "default-only";
  modes: Choice[];
}
export interface Profile {
  role: Role;
  kind: AgentKind;
  model: string | null;
  mode: string;
  extraArgs: string[];
  definition: string;
  task: string;
}
export interface RoutingRule {
  sender: string;
  recipient: string;
  types: string[];
  condition?: string;
}
export interface Definition {
  name: string;
  path: string;
  builtin: boolean;
}
export interface Config {
  version: 2;
  spawnPolicy: {
    maxTechLeads: number;
    maxDevsPerTechLead: Record<"backend_dev" | "frontend_dev", number>;
    maxQaPerTechLead: number;
  };
  defaultProfiles: Record<Role, string>;
  profiles: Record<string, Profile>;
  definitions: Definition[];
  timeoutMs: number;
  startTimeoutMs: number;
  maxRounds: number;
  routing: RoutingRule[];
}
export interface ConfigResponse extends Config {
  configSource: string;
  warnings?: string[] | Record<string, string> | { field: string; message?: string }[];
}
export interface Status {
  herdrDir: string;
  configSource: string;
  configPath: string;
}
export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}
