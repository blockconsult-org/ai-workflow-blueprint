export type Locale = "en" | "de";
export const TOOL_ID = "ai-workflow-blueprint";
export const SCHEMA_VERSION = 1;
export const METHODOLOGY_VERSION = 1;
export const STORAGE_KEY = "bc-ai-workflow-blueprint:v1";
export const MAX_BYTES = 2_000_000;
export const MAX_BRIEF_TEXT = 80_000;
export const MAX_LINK = 32_000;
export const templates = ["knowledge", "triage", "extraction", "proposal", "reporting"] as const;
export type Template = typeof templates[number];
export const stepTypes = ["trigger", "source", "task", "validation", "review", "action", "fallback", "completion"] as const;
export type StepType = typeof stepTypes[number];
export const conditions = ["success", "approved", "rejected", "failure", "insufficient", "invalid"] as const;
export type Condition = typeof conditions[number];
export const inputKeys = ["objective", "scope", "exclusions", "trigger", "output", "people", "software", "sources", "success", "owner", "monitoring", "assumptions", "authorization"] as const;
export type Inputs = Record<typeof inputKeys[number], string>;
export const sectionKeys = ["objective", "flow", "integrations", "approvals", "acceptance", "rollout", "assumptions"] as const;
export type SectionKey = typeof sectionKeys[number];
export interface Step { id: string; type: StepType; label: string; input: string; output: string; role: string; system: string; permissions: string; failure: string }
export interface Edge { from: string; to: string; condition: Condition }
export interface BriefEdit { text: string; basis: string }
export interface Model {
  tool: typeof TOOL_ID; schemaVersion: 1; methodologyVersion: 1; locale: Locale;
  template: Template; approval: "each" | "authorized"; restrictedSources: boolean;
  inputs: Inputs; steps: Step[]; edges: Edge[]; brief: Partial<Record<SectionKey, BriefEdit>>;
}
export type Issue = { code: string; step?: string };
export function graphIssues(model: Pick<Model, "steps" | "edges">): Issue[] {
  const { steps, edges } = model;
  const issues: Issue[] = [];
  const ids = new Set(steps.map(s => s.id));
  if (ids.size !== steps.length) issues.push({ code: "duplicate" });
  if (!steps.length || steps.length > 20) issues.push({ code: "limit" });
  if (edges.some(e => !ids.has(e.from) || !ids.has(e.to))) issues.push({ code: "reference" });
  if (new Set(edges.map(e => `${e.from}:${e.condition}`)).size !== edges.length) issues.push({ code: "branch" });
  const starts = steps.filter(s => s.type === "trigger");
  const ends = steps.filter(s => s.type === "completion");
  if (starts.length !== 1) issues.push({ code: "trigger" });
  if (!ends.length) issues.push({ code: "completion" });
  const visiting = new Set<string>(), visited = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const e of edges.filter(e => e.from === id)) if (walk(e.to)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  if ([...ids].some(walk)) issues.push({ code: "cycle" });
  const reach = (roots: string[], reverse = false) => {
    const seen = new Set(roots), queue = [...roots];
    while (queue.length) {
      const id = queue.shift();
      for (const e of edges.filter(e => (reverse ? e.to : e.from) === id)) {
        const target = reverse ? e.from : e.to;
        if (!seen.has(target)) { seen.add(target); queue.push(target); }
      }
    }
    return seen;
  };
  const reachable = reach(starts.map(s => s.id));
  const canFinish = reach(ends.map(s => s.id), true);
  for (const s of steps) {
    if (!reachable.has(s.id)) issues.push({ code: "orphan", step: s.id });
    if (!canFinish.has(s.id)) issues.push({ code: "deadEnd", step: s.id });
    if (s.type === "completion" && edges.some(e => e.from === s.id)) issues.push({ code: "terminal", step: s.id });
    if (s.type === "trigger" && edges.some(e => e.to === s.id)) issues.push({ code: "entry", step: s.id });
  }
  return issues;
}
export function orderedSteps(model: Pick<Model, "steps" | "edges">): Step[] {
  const pending = [...model.steps], result: Step[] = [];
  while (pending.length) {
    const index = pending.findIndex(s => model.edges.every(e => e.to !== s.id || result.some(r => r.id === e.from)));
    if (index < 0) return [...result, ...pending];
    result.push(...pending.splice(index, 1));
  }
  return result;
}
export function removeStep(model: Model, id: string): Model {
  return { ...model, steps: model.steps.filter(s => s.id !== id), edges: model.edges.filter(e => e.from !== id && e.to !== id) };
}
export function moveStep(model: Model, id: string, delta: number): Model {
  const steps = [...model.steps], from = steps.findIndex(s => s.id === id), to = from + delta;
  if (from < 0 || to < 0 || to >= steps.length) return model;
  [steps[from], steps[to]] = [steps[to], steps[from]];
  return { ...model, steps };
}
export function newStep(model: Model): Step {
  let n = 1; while (model.steps.some(s => s.id === `step-${n}`)) n++;
  return { id: `step-${n}`, type: "task", label: "", input: "", output: "", role: "", system: "", permissions: "", failure: "" };
}
function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function text(v: unknown, max = 1600): v is string { return typeof v === "string" && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v); }
function enumValue<T extends string>(v: unknown, values: readonly T[]): v is T { return typeof v === "string" && values.includes(v as T); }
function id(v: unknown): v is string { return typeof v === "string" && /^[a-zA-Z0-9_-]{1,48}$/.test(v); }
export class ModelError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export function parseModel(value: unknown): Model {
  if (!record(value) || value.tool !== TOOL_ID) throw new ModelError("wrongTool");
  if (value.schemaVersion !== 1 || value.methodologyVersion !== 1) throw new ModelError("version");
  if (!enumValue(value.locale, ["en", "de"]) || !enumValue(value.template, templates) || !enumValue(value.approval, ["each", "authorized"]) || typeof value.restrictedSources !== "boolean") throw new ModelError("schema");
  if (!record(value.inputs) || inputKeys.some(k => !text((value.inputs as Record<string, unknown>)[k]))) throw new ModelError("schema");
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 20 || !Array.isArray(value.edges) || value.edges.length > 80) throw new ModelError("limit");
  const steps: Step[] = value.steps.map(s => {
    if (!record(s) || !id(s.id) || !enumValue(s.type, stepTypes) || !text(s.label, 120) || ["input", "output", "role", "system", "permissions", "failure"].some(k => !text(s[k], 600))) throw new ModelError("schema");
    return { id: s.id, type: s.type, label: s.label, input: s.input as string, output: s.output as string, role: s.role as string, system: s.system as string, permissions: s.permissions as string, failure: s.failure as string };
  });
  const edges: Edge[] = value.edges.map(e => {
    if (!record(e) || !id(e.from) || !id(e.to) || !enumValue(e.condition, conditions)) throw new ModelError("schema");
    return { from: e.from, to: e.to, condition: e.condition };
  });
  if (!record(value.brief) || Object.keys(value.brief).some(k => !enumValue(k, sectionKeys))) throw new ModelError("schema");
  const brief: Model["brief"] = {};
  for (const k of sectionKeys) {
    const b = value.brief[k];
    if (b !== undefined) {
      if (!record(b) || !text(b.text, MAX_BRIEF_TEXT) || typeof b.basis !== "string" || !/^[0-9a-f]{8}$/.test(b.basis)) throw new ModelError("schema");
      brief[k] = { text: b.text, basis: b.basis };
    }
  }
  const result: Model = { tool: TOOL_ID, schemaVersion: 1, methodologyVersion: 1, locale: value.locale, template: value.template, approval: value.approval, restrictedSources: value.restrictedSources, inputs: Object.fromEntries(inputKeys.map(k => [k, (value.inputs as Inputs)[k]])) as Inputs, steps, edges, brief };
  const issues = graphIssues(result);
  if (issues.length) throw new ModelError(issues[0].code);
  return result;
}
export function readJson(raw: string): Model {
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new ModelError("tooLarge");
  try { return parseModel(JSON.parse(raw)); } catch (e) { if (e instanceof ModelError) throw e; throw new ModelError("schema"); }
}
export function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const c of JSON.stringify(value)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Follow upstream fields only while a step still has the derived value; authored step overrides remain intact. */
export function updateInput(model: Model, key: keyof Inputs, value: string): Model {
  const previous = model.inputs[key];
  const steps = model.steps.map(step => {
    const s = { ...step };
    if (key === "trigger" && s.type === "trigger") {
      if (s.label === previous.slice(0, 120)) s.label = value.slice(0, 120);
      if (s.input === previous.slice(0, 600)) s.input = value.slice(0, 600);
    }
    if (key === "sources" && s.type === "source" && s.input === previous.slice(0, 600)) s.input = value.slice(0, 600);
    if (key === "output") {
      if ((s.type === "task" || s.type === "action") && s.output === previous.slice(0, 600)) s.output = value.slice(0, 600);
      if (s.type === "validation" && s.input === previous.slice(0, 600)) s.input = value.slice(0, 600);
    }
    return s;
  });
  return { ...model, inputs: { ...model.inputs, [key]: value }, steps };
}
