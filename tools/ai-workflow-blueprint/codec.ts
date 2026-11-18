import { copy } from "./copy";
import { inputKeys, MAX_BYTES, MAX_LINK, ModelError, parseModel, readJson, type Inputs, type Model } from "./model";
export const HASH_PREFIX = "#awb1=";
export function sharedModel(model: Model, includeText: boolean): Model {
  if (includeText) return structuredClone(model);
  const c = copy[model.locale];
  // IDs can themselves contain authored text, so replace them deterministically too.
  const ids = new Map(model.steps.map((s, i) => [s.id, `s${i + 1}`]));
  return { ...model, inputs: Object.fromEntries(inputKeys.map(k => [k, ""])) as Inputs,
    steps: model.steps.map((s, i) => ({ id: ids.get(s.id)!, type: s.type, label: `${i + 1}. ${c[s.type]}`, input: "", output: "", role: "", system: "", permissions: "", failure: "" })),
    edges: model.edges.map(e => ({ ...e, from: ids.get(e.from)!, to: ids.get(e.to)! })), brief: {} };
}
export function encodeShare(m: Model): string {
  const bytes = new TextEncoder().encode(JSON.stringify(parseModel(m)));
  if (bytes.length > MAX_BYTES) throw new ModelError("tooLarge");
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  const result = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  if (result.length > MAX_LINK) throw new ModelError("tooLarge");
  return HASH_PREFIX + result;
}
export function decodeShare(fragment: string): Model {
  if (!fragment.startsWith(HASH_PREFIX)) throw new ModelError("version");
  const encoded = fragment.slice(HASH_PREFIX.length);
  if (encoded.length > MAX_LINK) throw new ModelError("tooLarge");
  if (!encoded.length || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new ModelError("schema");
  try {
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    if (binary.length > MAX_BYTES) throw new ModelError("tooLarge");
    return readJson(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  } catch (e) { if (e instanceof ModelError) throw e; throw new ModelError("schema"); }
}
