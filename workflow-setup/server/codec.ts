import type { CatalogEntry } from "./catalog.js";
export interface DecodedArgs { model: string | null; mode: string; extraArgs: string[] }

export function decodeArgs(args: string[], catalog: CatalogEntry): DecodedArgs {
  let model: string | null = null;
  let mode = "default";
  const consumed = new Set<number>();
  if (catalog.modelFlag) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === catalog.modelFlag) {
        consumed.add(i);
        if (i + 1 < args.length) { model = args[i + 1]!; consumed.add(i + 1); }
      }
    }
  }
  for (const choice of catalog.modes) {
    if (choice.value === "default" || choice.args.length === 0) continue;
    for (let i = 0; i <= args.length - choice.args.length; i++) {
      if (choice.args.every((arg, offset) => args[i + offset] === arg)) {
        mode = choice.value;
        choice.args.forEach((_, offset) => consumed.add(i + offset));
        break;
      }
    }
    if (mode !== "default") break;
  }
  return { model, mode, extraArgs: args.filter((_, index) => !consumed.has(index)) };
}

export function encodeArgs(model: string | null, mode: string, extraArgs: string[], catalog: CatalogEntry): string[] {
  const choice = catalog.modes.find((item) => item.value === mode);
  if (!choice) throw new Error(`Unknown mode ${mode} for ${catalog.kind}`);
  const modelArgs = model && catalog.modelFlag ? [catalog.modelFlag, model] : [];
  return [...modelArgs, ...choice.args, ...extraArgs];
}
