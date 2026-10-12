declare module "*.mjs" {
  export const ROUTING_RULES: Array<Record<string, unknown>>;
  export function checkMessage(input: unknown, roster: unknown, spawnPolicy?: unknown): { ok: boolean; error?: string; message?: string };
}
