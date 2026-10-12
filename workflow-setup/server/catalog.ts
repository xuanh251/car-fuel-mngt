export type AgentKind = "pi" | "claude" | "codex" | "gemini" | "cursor" | "devin" | "agy" | "cline" | "omp" | "mastracode" | "opencode" | "copilot" | "kimi" | "kiro" | "droid" | "amp" | "grok" | "hermes" | "kilo" | "qodercli" | "qwen" | "letta" | "maki" | "muse";
export interface Choice { value: string; label: string; args: string[] }
export interface CatalogEntry {
  kind: AgentKind; label: string; binary: string; binaryVerified: boolean;
  versionArgs: string[]; modelFlag: string | null; modes: Choice[];
  models: { source: "discovered" | "fallback"; list: Array<{ value: string; label: string }> };
}
const kinds: AgentKind[] = ["pi", "claude", "codex", "gemini", "cursor", "devin", "agy", "cline", "omp", "mastracode", "opencode", "copilot", "kimi", "kiro", "droid", "amp", "grok", "hermes", "kilo", "qodercli", "qwen", "letta", "maki", "muse"];
const modes = (values: Array<[string, string, string[]]>): Choice[] => values.map(([value, label, args]) => ({ value, label, args }));
const defaultMode = modes([["default", "Default", []]]);
export const CATALOG: CatalogEntry[] = kinds.map((kind) => {
  const claude = kind === "claude";
  const codex = kind === "codex";
  const pi = kind === "pi";
  return {
    kind, label: kind === "omp" ? "Oh My Pi" : kind[0]!.toUpperCase() + kind.slice(1),
    binary: kind, binaryVerified: claude || codex || pi, versionArgs: ["--version"],
    modelFlag: claude || codex || pi ? "--model" : null,
    modes: claude ? modes([["default", "Default", []], ["acceptEdits", "Accept edits", ["--permission-mode", "acceptEdits"]], ["plan", "Plan", ["--permission-mode", "plan"]], ["bypassPermissions", "Bypass permissions", ["--permission-mode", "bypassPermissions"]]])
      : codex ? modes([["default", "Default", []], ["bypass", "Bypass approvals and sandbox", ["--dangerously-bypass-approvals-and-sandbox"]]]) : defaultMode,
    models: pi ? { source: "discovered", list: [] } : claude ? { source: "fallback", list: ["haiku", "sonnet", "opus"].map((value) => ({ value, label: value })) } : { source: "fallback", list: [] }
  };
});
export const CATALOG_BY_KIND = new Map(CATALOG.map((entry) => [entry.kind, entry]));
export function isAgentKind(value: string): value is AgentKind { return CATALOG_BY_KIND.has(value as AgentKind); }
