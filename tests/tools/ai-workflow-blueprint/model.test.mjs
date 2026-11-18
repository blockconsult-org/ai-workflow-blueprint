import assert from "node:assert/strict";
import test from "node:test";
import { preset, changeApproval } from "../../../tools/ai-workflow-blueprint/presets.ts";
import { decodeShare, encodeShare, sharedModel } from "../../../tools/ai-workflow-blueprint/codec.ts";
import { graphIssues, parseModel, readJson, moveStep, removeStep, newStep, templates, sectionKeys, MAX_BYTES } from "../../../tools/ai-workflow-blueprint/model.ts";
import { editBrief, generatedBrief, sectionState, planningIssues, markdown } from "../../../tools/ai-workflow-blueprint/brief.ts";
import { summarySvg } from "../../../tools/ai-workflow-blueprint/exports.ts";
const codes = m => graphIssues(m).map(i => i.code);
for (const locale of ["en", "de"]) for (const template of templates) test(`${locale} ${template}: connected template, documented branches, acceptance references, exact round trips`, () => {
  const m = preset(template, locale);
  assert.deepEqual(planningIssues(m), []);
  assert.deepEqual(readJson(JSON.stringify(m)), m);
  assert.deepEqual(decodeShare(encodeShare(m)), m);
  for (const c of ["approved", "rejected", "failure", "invalid"]) assert.ok(m.edges.some(e => e.condition === c));
  if (template === "knowledge") { assert.ok(m.restrictedSources); assert.ok(m.edges.some(e => e.condition === "insufficient")); }
  const brief = generatedBrief(m);
  for (const key of sectionKeys) assert.ok(brief[key].length > 10);
  for (const id of [...brief.acceptance.matchAll(/\[([\w-]+)\]/g)].map(m => m[1])) assert.ok(m.steps.some(s => s.id === id));
});
test("missing references, duplicate IDs, cycles, orphans, unreachable completion and invalid terminals", () => {
  let m = preset("knowledge", "en"); m.edges[0].to = "missing"; assert.ok(codes(m).includes("reference")); assert.throws(() => parseModel(m));
  m = preset("knowledge", "en"); m.steps[1].id = m.steps[0].id; assert.ok(codes(m).includes("duplicate"));
  m = preset("knowledge", "en"); m.edges.push({ from: "validate", to: "task", condition: "failure" }); assert.ok(codes(m).includes("cycle"));
  m = preset("knowledge", "en"); m.steps.push({ ...newStep(m), label: "Orphan" }); assert.ok(codes(m).includes("orphan")); assert.ok(codes(m).includes("deadEnd"));
  m = preset("knowledge", "en"); m.edges = m.edges.filter(e => e.to !== "done"); assert.ok(codes(m).includes("orphan")); assert.ok(codes(m).includes("deadEnd"));
  m = preset("knowledge", "en"); m.edges.push({ from: "done", to: "trigger", condition: "success" }); assert.ok(codes(m).includes("terminal")); assert.ok(codes(m).includes("entry"));
});
test("removing nodes removes all incident edges; reordering preserves IDs, edges and edits", () => {
  const original = preset("extraction", "de"), m = removeStep(original, "validate");
  assert.ok(!m.edges.some(e => e.to === "validate" || e.from === "validate"));
  assert.ok(codes(m).includes("orphan"));
  const moved = moveStep(original, "review", -1);
  assert.deepEqual(new Set(moved.steps.map(s => s.id)), new Set(original.steps.map(s => s.id)));
  assert.deepEqual(moved.edges, original.edges);
  assert.equal(moved.steps[3].id, "review");
});
test("manual brief survives upstream edits, reorder and share; only affected sections are flagged", () => {
  let m = preset("knowledge", "en"); m = editBrief(m, "objective", "Team-authored objective"); m = editBrief(m, "rollout", "Team rollout");
  m.inputs.objective = "Changed objective";
  assert.equal(sectionState(m, "objective").text, "Team-authored objective");
  assert.ok(sectionState(m, "objective").stale);
  assert.equal(sectionState(m, "rollout").stale, false);
  const copy = decodeShare(encodeShare(moveStep(m, "source", 1)));
  assert.deepEqual(copy.brief, m.brief); assert.ok(markdown(copy).includes("Inputs changed"));
});
test("wrong tool, versions, invalid enums, unsafe shapes, text and collection bounds rejected", () => {
  const mutations = [m => m.tool = "token-simulator", m => m.schemaVersion = 2, m => m.methodologyVersion = 0,
    m => m.schemaVersion = Infinity, m => m.methodologyVersion = NaN, m => m.locale = "fr", m => m.approval = "auto",
    m => m.restrictedSources = 1, m => m.inputs.objective = 45, m => m.inputs.sources = "x".repeat(1601),
    m => m.steps[0].label = "x".repeat(121), m => m.steps[0].type = "shell", m => m.edges[0].condition = "always",
    m => m.brief = { bad: {} }, m => m.brief = { flow: { text: "x", basis: "0" } },
    m => m.steps[0].id = "<script>", m => m.steps = new Array(21).fill(m.steps[0]), m => m.edges = new Array(81).fill(m.edges[0]),
  ];
  for (const mutate of mutations) { const m = preset("knowledge", "en"); mutate(m); assert.throws(() => parseModel(m)); }
  for (const raw of ["", "{", "null", "[]", '"a"', '{"__proto__":{}}']) assert.throws(() => readJson(raw));
  assert.throws(() => readJson(JSON.stringify(preset("knowledge", "en")) + " ".repeat(MAX_BYTES)), /tooLarge/);
});
test("share redacts all authored fields, evidence URLs, custom IDs and brief text by default", () => {
  const m = preset("knowledge", "en"); m.inputs.sources = "https://secret.example";
  m.steps[0].id = "secret-customer"; m.edges[0].from = "secret-customer";
  m.steps[1].system = "secret-system"; m.brief.objective = { text: "secret-brief", basis: "12345678" };
  const redacted = sharedModel(m, false), text = JSON.stringify(redacted);
  assert.ok(!text.includes("secret")); assert.ok(!text.includes("SharePoint"));
  assert.deepEqual(decodeShare(encodeShare(redacted)), redacted);
  assert.deepEqual(sharedModel(m, true), m);
});
test("malformed, oversized, unsupported and invalid-UTF8 fragments rejected", () => {
  for (const hash of ["#awb2=abc", "#awb1=", "#awb1=@@@@", "#awb1=a", "#awb1=_w", "#awb1=" + "a".repeat(32001)]) assert.throws(() => decodeShare(hash));
  const m = preset("knowledge", "en"); for (const k of sectionKeys) m.brief[k] = { text: "ä".repeat(6000), basis: "12345678" };
  assert.throws(() => encodeShare(m), /tooLarge/);
});
test("external actions require the selected approval gate on every incoming path", () => {
  const m = preset("triage", "en");
  m.edges.push({ from: "source", to: "action", condition: "approved" });
  assert.ok(planningIssues(m).some(i => i.code === "approvalPath"));
  const authorized = changeApproval(preset("triage", "de"), "authorized");
  assert.equal(authorized.steps.find(s => s.id === "review").type, "validation");
  assert.deepEqual(planningIssues(authorized), []);
  assert.ok(generatedBrief(authorized).approvals.includes("ohne einzelne menschliche Freigabe"));
});
test("twenty long German steps remain connected with unique stable IDs and round-trip as JSON", () => {
  let m = preset("knowledge", "de");
  m.edges = m.edges.filter(e => !(e.from === "fallback" && e.to === "done"));
  let from = "fallback";
  while (m.steps.length < 20) { const step = { ...newStep(m), label: "Prüfung zugriffsgeschützter Unternehmensinformationen mit ausführlicher Verantwortungszuordnung" }; m.steps.push(step); m.edges.push({ from, to: step.id, condition: "success" }); from = step.id; }
  m.edges.push({ from, to: "done", condition: "success" });
  assert.deepEqual(graphIssues(m), []); assert.deepEqual(readJson(JSON.stringify(m)), m);
  assert.deepEqual(decodeShare(encodeShare(sharedModel(m, false))), sharedModel(m, false));
});
test("PNG summary uses the same counts, objective and assumptions; SVG escapes authored markup", () => {
  const m = preset("knowledge", "en"); m.inputs.objective = '<script>alert("x")</script>';
  const s = summarySvg(m);
  assert.ok(s.markup.includes(`${m.steps.length} steps`)); assert.ok(s.markup.includes(`${m.edges.length} branches`));
  assert.ok(s.markup.includes("&lt;script&gt;")); assert.ok(!s.markup.includes("<script>"));
  assert.ok(s.markup.includes("data rights")); assert.ok(s.height > 400);
});

test("upstream trigger/source/output edits update derived steps but preserve manual overrides", async () => {
  const { updateInput } = await import("../../../tools/ai-workflow-blueprint/model.ts");
  let m = preset("knowledge", "en");
  m = updateInput(m, "trigger", "A new support request");
  assert.equal(m.steps.find(s => s.id === "trigger").label, "A new support request");
  m.steps.find(s => s.id === "trigger").label = "Manual trigger label";
  m = updateInput(m, "trigger", "A scheduled request");
  assert.equal(m.steps.find(s => s.id === "trigger").label, "Manual trigger label");
  m = updateInput(m, "sources", "Restricted research library");
  assert.equal(m.steps.find(s => s.id === "source").input, "Restricted research library");
  m = updateInput(m, "output", "A cited answer");
  assert.equal(m.steps.find(s => s.id === "action").output, "A cited answer");
});

test("redacted copies retain editable authorization gates even after step IDs are redacted", () => {
  const m = changeApproval(sharedModel(preset("knowledge", "en"), false), "authorized");
  assert.ok(!planningIssues(m).some(i => i.code === "approvalPath"));
  assert.ok(!m.steps.some(s => s.type === "review"));
});
