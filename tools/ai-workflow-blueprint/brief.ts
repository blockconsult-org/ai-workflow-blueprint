import { conditionLabel, copy } from "./copy";
import { fingerprint, graphIssues, orderedSteps, sectionKeys, type Issue, type Model, type SectionKey } from "./model";
export function planningIssues(m: Model): Issue[] {
  const result = graphIssues(m);
  if ([m.inputs.objective, m.inputs.trigger, m.inputs.output, m.inputs.success, ...m.steps.map(s => s.label)].some(s => !s.trim())) result.push({ code: "required" });
  // All immediate ingress to an external action must be the approved outcome of a gate.
  for (const step of m.steps.filter(s => s.type === "action")) {
    const incoming = m.edges.filter(e => e.to === step.id);
    if (!incoming.length || incoming.some(e => e.condition !== "approved" || !m.steps.some(s => s.id === e.from && s.type === (m.approval === "each" ? "review" : "validation")))) result.push({ code: "approvalPath", step: step.id });
  }
  return result;
}
export function generatedBrief(m: Model): Record<SectionKey, string> {
  const c = copy[m.locale], de = m.locale === "de", i = m.inputs;
  const val = (s: string) => s.trim() || c.empty;
  const line = (label: string, text: string) => `${label}: ${val(text)}`;
  const steps = orderedSteps(m);
  const stepList = steps.map((s, n) => `${n + 1}. [${s.id}] ${val(s.label)} (${c[s.type]})\n   ${line(c.input, s.input)} → ${line(c.output, s.output)}\n   ${line(c.role, s.role)}; ${line(c.system, s.system)}\n   ${m.edges.filter(e => e.from === s.id).map(e => `${conditionLabel(e.condition, m.locale)} → [${e.to}]`).join("; ")}`).join("\n");
  const tests = steps.map(s => {
    const instruction = s.type === "source" && m.template === "knowledge" ? c.evidenceTest : s.type === "validation" && m.template === "extraction" ? c.extractionTest : s.type === "action" ? c.externalTest : c.commonTest;
    const outcomes = m.edges.filter(e => e.from === s.id).map(e => `${conditionLabel(e.condition, m.locale)} → [${e.to}]`).join("; ");
    return `[${s.id}] ${val(s.label)}: ${s.type === "completion" ? (de ? "Ergebnisstatus und prüfbares Protokoll bestätigen." : "Confirm outcome status and auditable log.") : instruction}\n${outcomes}`;
  }).join("\n\n");
  return {
    objective: [line(c.objective, i.objective), line(c.scope, i.scope), line(c.exclusions, i.exclusions)].join("\n\n"),
    flow: [line(c.trigger, i.trigger), line(c.sources, i.sources), line(c.output, i.output), line(c.people, i.people), stepList].join("\n\n"),
    integrations: [c.intro, line(c.software, i.software), ...steps.map(s => `[${s.id}] ${line(c.system, s.system)}; ${line(c.permissions, s.permissions)}`), m.restrictedSources ? c.restrictedHelp : (de ? "Quellenrechte und Aufbewahrungsregeln sind vor dem Pilot zu klären." : "Resolve source rights and retention rules before the pilot.")].join("\n\n"),
    approvals: [m.approval === "each" ? c.eachHelp : c.authorizedHelp, line(c.authorization, i.authorization), ...steps.filter(s => s.type === "review" || s.type === "fallback" || s.type === "action" || (s.type === "validation" && m.approval === "authorized")).map(s => `[${s.id}] ${val(s.label)} — ${line(c.role, s.role)}; ${line(c.failure, s.failure)}`)].join("\n\n"),
    acceptance: `${line(c.success, i.success)}\n\n${tests}`,
    rollout: [line(c.owner, i.owner), line(c.monitoring, i.monitoring), de ? "[ ] Verantwortliche und Vertretung benennen\n[ ] Datenrechte, Berechtigungen und Aufbewahrung bestätigen\n[ ] Schnittstellen und minimale Zugriffe in einer Testumgebung prüfen\n[ ] Erfolgs-, Ablehnungs- und Fehlerwege testen\n[ ] Doppelverarbeitung verhindern und Abschaltung erproben\n[ ] Begrenzten Pilot mit täglicher Prüfung starten\n[ ] Abnahme dokumentieren und Rollout freigeben" : "[ ] Name owner and backup\n[ ] Confirm data rights, permissions and retention\n[ ] Verify interfaces and minimum access in a test environment\n[ ] Test success, rejection and failure paths\n[ ] Prevent duplicate processing and rehearse shutdown\n[ ] Start a limited pilot with daily review\n[ ] Record acceptance and authorize rollout"].join("\n\n"),
    assumptions: `${line(c.assumptions, i.assumptions)}\n\n${line(c.authorization, i.authorization)}\n\n${c.summaryAssumption}\n${c.methodText}`,
  };
}
export function sectionState(m: Model, key: SectionKey) {
  const generated = generatedBrief(m)[key], basis = fingerprint(generated), edit = m.brief[key];
  return { generated, basis, text: edit?.text ?? generated, edited: !!edit, stale: !!edit && edit.basis !== basis };
}
export function editBrief(m: Model, key: SectionKey, text: string): Model {
  const state = sectionState(m, key);
  return { ...m, brief: { ...m.brief, [key]: { text, basis: m.brief[key]?.basis ?? state.basis } } };
}
export function markdown(m: Model): string {
  const c = copy[m.locale];
  return `# ${c.title}\n\n${c.report} · v1\n\n${c.planning}\n\n` + sectionKeys.map(k => {
    const state = sectionState(m, k);
    return `## ${c[k]}\n\n${state.stale ? `**${c.stale}**\n\n` : ""}${state.text}`;
  }).join("\n\n");
}
