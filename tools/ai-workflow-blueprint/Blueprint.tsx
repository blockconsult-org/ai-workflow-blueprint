"use client";
import { useEffect, useId, useRef, useState } from "react";
import { copy, conditionLabel, errorText } from "./copy";
import { changeApproval, preset } from "./presets";
import { conditions, graphIssues, MAX_BRIEF_TEXT, MAX_BYTES, ModelError, moveStep, newStep, orderedSteps, parseModel, readJson, removeStep, sectionKeys, stepTypes, STORAGE_KEY, templates, updateInput, type Edge, type Locale, type Model, type Step, type Template } from "./model";
import { editBrief, markdown, planningIssues, sectionState } from "./brief";
import { decodeShare, encodeShare, sharedModel } from "./codec";
import { Diagram } from "./Diagram";
import { download, pngFromSvg, serializeSvg, summarySvg } from "./exports";
import { Select } from "./Select";
import styles from "./blueprint.module.css";
import { ui } from "./ui";
import { Dialog } from "./Dialog";
type View = "plan" | "workflow" | "brief";
const views: View[] = ["plan", "workflow", "brief"];
function Field({ label, value, onChange, disabled, max = 1600, big = false, requiredLabel }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; max?: number; big?: boolean; requiredLabel?: string }) {
  const errorId = useId();
  const invalid = !!requiredLabel && !value.trim() && !disabled;
  return <label className={styles.field}><span>{label}</span><textarea aria-label={label} aria-required={!!requiredLabel || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} value={value} maxLength={max} rows={big ? 8 : 2} readOnly={disabled} onChange={e => onChange(e.target.value)} className={big ? styles.briefArea : undefined} />{invalid && <small id={errorId} className={styles.fieldError}>{requiredLabel}</small>}</label>;
}
function OrderedText({ model, compact = false }: { model: Model; compact?: boolean }) {
  const c = copy[model.locale];
  return <ol className={styles.textList}>{orderedSteps(model).map(s => <li key={s.id}>
    <strong>[{s.id}] {s.label || c.noName}</strong> · {c[s.type]}
    {compact ? <details><summary>{ui[model.locale].stepDetails}</summary><p>{c.input}: {s.input || c.empty} → {c.output}: {s.output || c.empty}</p><p>{c.role}: {s.role || c.empty} · {c.system}: {s.system || c.empty}</p><p>{c.permissions}: {s.permissions || c.empty}</p><p>{c.failure}: {s.failure || c.empty}</p></details> : <><p>{c.input}: {s.input || c.empty} → {c.output}: {s.output || c.empty}</p><p>{c.role}: {s.role || c.empty} · {c.system}: {s.system || c.empty}</p><p>{c.permissions}: {s.permissions || c.empty}</p><p>{c.failure}: {s.failure || c.empty}</p></>}
    <p>{model.edges.filter(e => e.from === s.id).map(e => `${conditionLabel(e.condition, model.locale)} → [${e.to}]`).join(" · ")}</p>
  </li>)}</ol>;
}
export function Blueprint({ locale }: { locale: Locale }) {
  const [draft, setDraft] = useState<Model>(() => preset("knowledge", locale));
  const [snapshot, setSnapshot] = useState<Model | null>(null);
  const [language, setLanguage] = useState(locale);
  useEffect(() => { window.dispatchEvent(new CustomEvent('bc:locale', { detail: language })); }, [language]);
  const [template, setTemplate] = useState<Template>("knowledge");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Model | null>(null);
  const [modal, setModal] = useState<"files" | "share" | "export" | null>(null);
  const [includeText, setIncludeText] = useState(false), [link, setLink] = useState("");
  const [view, setView] = useState<View>("plan"), [mapMode, setMapMode] = useState<"diagram" | "list">("diagram");
  const [contentsOpen, setContentsOpen] = useState(true);
  const [editing, setEditing] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"draft" | "unsaved" | "savedState">("draft");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Edge>({ from: "trigger", to: "source", condition: "success" });
  const svg = useRef<SVGSVGElement>(null);
  const model: Model = { ...(snapshot ?? draft), locale: language };
  const c = copy[language], t = ui[language], readonly = !!snapshot, issues = planningIssues(model), graphErrors = graphIssues(model);
  useEffect(() => {
    let active = true;
    const readHash = () => {
      if (!active) return;
      if (!window.location.hash) { setSnapshot(null); return; }
      if (!window.location.hash.startsWith("#awb")) return;
      try { setSnapshot(decodeShare(window.location.hash)); setNotice(""); setModal(null); setLink(""); }
      catch (e) { setNotice(`${copy[locale].invalidLink} ${errorText(e instanceof ModelError ? e.code : "schema", locale)}`); }
    };
    queueMicrotask(readHash);
    window.addEventListener("hashchange", readHash);
    return () => { active = false; window.removeEventListener("hashchange", readHash); };
  }, [locale]);
  const update = (next: Model) => { if (readonly) return; setDraft(next); setSaveState("unsaved"); setLink(""); setNotice(""); };
  const fail = (e: unknown) => setNotice(c.errorPrefix + errorText(e instanceof ModelError ? e.code : "schema", language));
  const clearHash = () => window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const replace = (next: Model) => { setDraft({ ...next, locale: language }); setSaveState("unsaved"); setPending(null); setLink(""); setModal(null); setNotice(""); setTemplate(next.template); clearHash(); };
  const updateStep = (id: string, values: Partial<Step>) => update({ ...model, steps: model.steps.map(s => s.id === id ? { ...s, ...values } : s) });
  function save() { try { parseModel(model); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); setSaveState("savedState"); setNotice(c.saved); } catch (e) { if (e instanceof ModelError) fail(e); else setNotice(c.storage); } }
  function load() {
    let raw: string | null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { setNotice(c.storage); return; }
    if (!raw) { setNotice(c.noSaved); return; }
    try { setPending(readJson(raw)); } catch (e) { fail(e); }
  }
  async function importFile(file: File) {
    try { if (file.size > MAX_BYTES) throw new ModelError("tooLarge"); setPending(readJson(await file.text())); } catch (e) { fail(e); }
  }
  function addEdge() {
    if (readonly) return;
    const resolvedEdge = { ...edge, from: model.steps.some(s => s.id === edge.from) ? edge.from : model.steps[0].id, to: model.steps.some(s => s.id === edge.to) ? edge.to : model.steps[0].id };
    const next = { ...model, edges: [...model.edges, resolvedEdge] };
    const blocked = graphIssues(next).find(i => ["cycle", "reference", "branch", "entry", "terminal"].includes(i.code));
    if (blocked) { fail(new ModelError(blocked.code)); return; }
    if (next.edges.length > 80) { fail(new ModelError("limit")); return; }
    update(next);
  }
  async function exportImage(kind: "summary" | "diagram" | "svg") {
    setBusy(true);
    try {
      if (kind === "summary") { const s = summarySvg(model); download("ai-workflow-blueprint-summary.png", await pngFromSvg(s.markup, s.width, s.height)); }
      else if (svg.current) {
        const markup = serializeSvg(svg.current);
        download(`ai-workflow-blueprint-diagram.${kind === "svg" ? "svg" : "png"}`, kind === "svg" ? new Blob([markup], { type: "image/svg+xml" }) : await pngFromSvg(markup, svg.current.viewBox.baseVal.width, svg.current.viewBox.baseVal.height));
      }
      setNotice(c.exported);
    } catch { setNotice(c.exportError); } finally { setBusy(false); }
  }
  const branchOptions = model.steps.map((s, index) => ({ value: s.id, label: `${String(index + 1).padStart(2, "0")} · ${s.label || c.noName}` }));
  const shared = sharedModel(model, includeText);
  const staleCount = sectionKeys.filter(key => sectionState(model, key).stale).length;
  const stepName = (id: string) => model.steps.find(s => s.id === id)?.label || c.noName;
  function showView(next: View, focusPanel = false) {
    setView(next);
    if (next === "workflow" && window.innerWidth < 768) setMapMode("list");
    if (next === "brief") setContentsOpen(window.innerWidth >= 900);
    if (focusPanel) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`#awb-${next}-title`)?.focus());
  }
  function focusStep(id: string, edit = false) {
    requestAnimationFrame(() => {
      const detail = root.current?.querySelector<HTMLDetailsElement>(`[data-testid="step-${id}"]`);
      if (detail) { if (edit) detail.open = true; detail.querySelector<HTMLElement>(edit ? "textarea" : "summary")?.focus(); }
    });
  }
  function keepFocusVisible(target: HTMLElement) {
    requestAnimationFrame(() => {
      if (document.activeElement !== target || target.closest("dialog")) return;
      const tokens = getComputedStyle(document.documentElement);
      const top = (parseFloat(tokens.getPropertyValue("--site-header-height")) || 80) + (target.closest('[role="tablist"]') ? 8 : window.innerHeight >= 720 ? 96 : 16);
      const bottom = window.innerHeight - (parseFloat(tokens.getPropertyValue("--cookie-notice-height")) || 0) - 88;
      const box = target.getBoundingClientRect();
      // Native focus scrolling does not account for the shared floating chat launcher.
      // Keep the start of oversized editors visible when the entire field cannot fit.
      const delta = box.top < top || box.height > bottom - top ? box.top - top : box.bottom > bottom ? box.bottom - bottom : 0;
      if (delta) window.scrollBy({ top: delta, behavior: "instant" });
    });
  }
  const stats = <dl className={styles.stats}>
    <div><dt>{c.steps}</dt><dd>{model.steps.length}</dd></div>
    <div><dt>{c.branches}</dt><dd>{model.edges.length}</dd></div>
    <div><dt>{c.reviews}</dt><dd>{model.steps.filter(s => s.type === "review").length}</dd></div>
  </dl>;
  const fields = (keys: (keyof Model["inputs"])[]) => keys.map(k => <Field key={k} label={c[k]} requiredLabel={["objective", "trigger", "output", "success"].includes(k) ? t.required : undefined} value={model.inputs[k]} disabled={readonly} onChange={value => update(updateInput(model, k, value))} />);
  return <div ref={root} className={styles.root} lang={language} data-testid="blueprint" onFocusCapture={event => keepFocusVisible(event.target)}>
    <div className={styles.starter}>
      <Select label={c.template} value={template} options={templates.map(value => ({ value, label: c[value] }))} onChange={setTemplate} disabled={readonly} />
      <button disabled={readonly} onClick={() => setPending(preset(template, language))}>{c.apply}</button>
      <Select label={c.locale} value={language} options={[{ value: "en", label: "English" }, { value: "de", label: "Deutsch" }]} onChange={value => { setLanguage(value); setLink(""); setNotice(""); }} />
    </div>
    <div className={styles.actionBar}>
      <p className={styles.statusLabel}><span aria-hidden className={styles.statusMark} />{readonly ? c.snapshot : t[saveState]}</p>
      <div className={styles.actions}>
        <button disabled={readonly} onClick={save} aria-label={c.save}><span className={styles.wideLabel}>{c.save}</span><span className={styles.shortLabel}>{t.saveShort}</span></button>
        <button aria-label={t.files} onClick={() => { setModal("files"); setNotice(""); }}><span className={styles.wideLabel}>{t.files}</span><span className={styles.shortLabel}>{t.filesShort}</span></button>
        <button aria-label={c.share} disabled={graphErrors.length > 0} onClick={() => { setModal("share"); setLink(""); setNotice(""); }}><span className={styles.wideLabel}>{c.share}</span><span className={styles.shortLabel}>{t.shareShort}</span></button>
        <button className={styles.primary} onClick={() => { setModal("export"); setNotice(""); }}>{t.exports} <span aria-hidden>↗</span></button>
      </div>
    </div>
    {readonly && <div className={styles.snapshot}><div><strong>{c.snapshot}</strong><p>{c.copyHelp}</p></div><div className={styles.actions}>
      <button className={styles.primary} onClick={() => { setDraft({ ...structuredClone(snapshot!), locale: language }); setSaveState("unsaved"); setSnapshot(null); clearHash(); setNotice(c.copyHelp); setModal(null); setLink(""); }}>{c.makeCopy}</button>
      <button onClick={() => { setSnapshot(null); clearHash(); setNotice(""); }}>{c.back}</button>
    </div></div>}
    <div className={styles.tabs} role="tablist" aria-label={t.navigation}>
      {views.map((key, index) => <button key={key} role="tab" id={`awb-tab-${key}`} aria-controls={`awb-view-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} onClick={() => showView(key)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
        showView(views[next]); root.current?.querySelector<HTMLElement>(`#awb-tab-${views[next]}`)?.focus();
      }}><span className={styles.tabNumber}>{String(index + 1).padStart(2, "0")}</span>{t[key]}{key === "brief" && staleCount > 0 && <span className={styles.count}>{staleCount}</span>}</button>)}
    </div>
    <div role="status" aria-live="polite" className={notice ? styles.notice : styles.emptyStatus}>{notice}</div>
    <section role="tabpanel" id="awb-view-plan" aria-labelledby="awb-tab-plan" hidden={view !== "plan"} className={styles.view}>
      <div className={styles.planLayout}>
        <div>
          <div className={styles.sectionHeading}><h2 id="awb-plan-title" tabIndex={-1}>{t.planTitle}</h2><p>{t.planHint}</p></div>
          <div className={styles.grid}>{fields(["objective", "trigger", "output", "success"])}</div>
          <div className={styles.approvalBlock}>
            <Select label={c.approval} value={model.approval} options={[{ value: "each", label: c.each }, { value: "authorized", label: c.authorized }]} onChange={value => update(changeApproval(model, value))} disabled={readonly} />
            <p className={styles.muted}>{model.approval === "each" ? c.eachHelp : c.authorizedHelp}</p>
            <details><summary>{t.authorization}</summary><div className={styles.detailsBody}>{fields(["authorization"])}</div></details>
          </div>
          <div className={styles.groups}>
            <details><summary>{t.context}</summary><div className={styles.grid}>{fields(["scope", "exclusions", "people"])}</div></details>
            <details><summary>{t.resources}</summary><div className={styles.grid}>{fields(["sources", "software"])}</div>
              <label className={styles.check}><input type="checkbox" checked={model.restrictedSources} disabled={readonly} onChange={e => update({ ...model, restrictedSources: e.target.checked })} />{c.restricted}</label>
              {model.restrictedSources && <p className={styles.muted}>{c.restrictedHelp}</p>}
            </details>
            <details><summary>{t.operations}</summary><div className={styles.grid}>{fields(["owner", "monitoring", "assumptions"])}</div></details>
          </div>
          <div className={styles.viewFooter}><p className={styles.muted}>{t.shortHelp}</p><button className={styles.primary} onClick={() => showView("workflow", true)}>{t.nextWorkflow} <span aria-hidden>→</span></button></div>
        </div>
        <aside className={styles.overview} aria-label={t.overview}>
          <p className={styles.eyebrow}>{t.overview}</p><h3>{c[model.template]}</h3><p className={styles.muted}>{t.previewHint}</p>
          {stats}
          <p className={styles.checkStatus}>{issues.length ? t.reviewCheck : t.graphReady}</p>
          <ol className={styles.miniFlow}>{orderedSteps(model).slice(0, 4).map((s, index) => <li key={s.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{c[s.type]}</small><p>{s.label || c.noName}</p></div></li>)}</ol>
          <button className={styles.textButton} onClick={() => showView("workflow", true)}>{t.nextWorkflow} <span aria-hidden>→</span></button>
        </aside>
      </div>
    </section>
    <section role="tabpanel" id="awb-view-workflow" aria-labelledby="awb-tab-workflow" hidden={view !== "workflow"} className={styles.view}>
      <div className={styles.sectionHeading}><h2 id="awb-workflow-title" tabIndex={-1}>{t.map}</h2><p>{t.mapHint}</p></div>
      {stats}
      {issues.length ? <div className={styles.notice}><strong>{c.issues}</strong><ul>{issues.map((issue, index) => <li key={index}>{issue.step ? `${stepName(issue.step)}: ` : ""}{errorText(issue.code, language)}</li>)}</ul></div> : <p className={styles.checkStatus}>{c.valid}</p>}
      <div className={styles.workflowLayout}>
        <div className={styles.mapPanel}>
          <div className={styles.mapControls} role="group" aria-label={t.map}>
            <button aria-pressed={mapMode === "diagram"} onClick={() => setMapMode("diagram")}>{t.diagram}</button><button aria-pressed={mapMode === "list"} onClick={() => setMapMode("list")}>{t.ordered}</button>
          </div>
          <div hidden={mapMode !== "diagram"} className={styles.graphScroll} tabIndex={0} aria-label={c.graph}><Diagram ref={svg} model={model} /></div>
          <div hidden={mapMode !== "list"} className={styles.orderedScroll} tabIndex={0} aria-label={c.table}><OrderedText model={model} compact /></div>
        </div>
        <div className={styles.editor}>
          <h3>{t.editor}</h3><p className={styles.muted}>{t.editorHint}</p>
          <div className={styles.stepList}>{model.steps.map((s, index) => <details className={styles.step} key={s.id} data-testid={`step-${s.id}`}>
            <summary><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span><small>{c[s.type]}</small><span className={styles.stepName}>{s.label || c.noName}</span></span></summary>
            <div className={styles.detailsBody}>
              <Field label={c.label} value={s.label} max={120} requiredLabel={t.required} disabled={readonly} onChange={label => updateStep(s.id, { label })} />
              <Select label={c.type} value={s.type} options={stepTypes.map(value => ({ value, label: c[value] }))} disabled={readonly} onChange={type => updateStep(s.id, { type })} />
              <div className={styles.stepFields}>{(["input", "output", "role", "system", "permissions", "failure"] as const).map(key => <Field key={key} label={c[key]} max={600} value={s[key]} disabled={readonly} onChange={value => updateStep(s.id, { [key]: value })} />)}</div>
              <p className={styles.muted}>ID: {s.id}</p><div className={styles.actions}><button disabled={readonly || index === 0} onClick={() => update(moveStep(model, s.id, -1))}>{c.up}</button><button disabled={readonly || index === model.steps.length - 1} onClick={() => update(moveStep(model, s.id, 1))}>{c.down}</button><button className={styles.danger} disabled={readonly || model.steps.length === 1} onClick={() => setRemoveId(s.id)}>{c.remove}</button></div>
            </div>
          </details>)}</div>
          <button className={styles.addStep} disabled={readonly || model.steps.length >= 20} onClick={() => { const step = newStep(model); update({ ...model, steps: [...model.steps, step] }); focusStep(step.id, true); }}>{model.steps.length >= 20 ? c.limit : c.add}</button>
          <details className={styles.branchEditor}><summary>{t.connections} <span className={styles.count}>{model.edges.length}</span></summary>
            <p className={styles.muted}>{c.branchHelp} {c.orderHelp}</p>
            {model.edges.map((e, index) => <div className={styles.branch} key={`${e.from}-${e.condition}`}><div><span className={styles.branchCondition}>{conditionLabel(e.condition, language)}</span><p>{stepName(e.from)} <span aria-hidden>→</span> {stepName(e.to)}</p></div><button className={styles.iconButton} disabled={readonly} aria-label={`${c.removeBranch}: ${e.from} ${conditionLabel(e.condition, language)} ${e.to}`} onClick={() => update({ ...model, edges: model.edges.filter((_, i) => i !== index) })}>×</button></div>)}
            <div className={styles.newBranch}><h4>{t.addConnection}</h4>
              <Select label={c.from} value={model.steps.some(s => s.id === edge.from) ? edge.from : model.steps[0].id} options={branchOptions} disabled={readonly} onChange={from => setEdge({ ...edge, from })} />
              <Select label={c.to} value={model.steps.some(s => s.id === edge.to) ? edge.to : model.steps[0].id} options={branchOptions} disabled={readonly} onChange={to => setEdge({ ...edge, to })} />
              <Select label={c.condition} value={edge.condition} options={conditions.map(value => ({ value, label: conditionLabel(value, language) }))} disabled={readonly} onChange={condition => setEdge({ ...edge, condition })} />
              <button disabled={readonly} onClick={addEdge}>{c.addBranch}</button>
              {notice && <p role="status" className={styles.notice}>{notice}</p>}
            </div>
          </details>
        </div>
      </div>
      <div className={styles.viewFooter}><button onClick={() => showView("plan", true)}>{t.previous}</button><button className={styles.primary} onClick={() => showView("brief", true)}>{t.nextBrief} <span aria-hidden>→</span></button></div>
    </section>
    <section role="tabpanel" id="awb-view-brief" aria-labelledby="awb-tab-brief" hidden={view !== "brief"} className={styles.view}>
      <div className={styles.sectionHeading}><h2 id="awb-brief-title" tabIndex={-1}>{t.briefTitle}</h2><p>{t.briefHint}</p></div>
      {staleCount > 0 && <div className={styles.notice}><strong>{staleCount} {t.reviewNeeded}</strong><p>{t.reviewSummary}</p></div>}
      <div className={styles.briefLayout}>
        <nav className={styles.contents} aria-label={t.contents}><details open={contentsOpen} onToggle={event => setContentsOpen(event.currentTarget.open)}><summary>{t.contents}</summary><div className={styles.contentsLinks}>{sectionKeys.map((key, index) => <button key={key} onClick={() => root.current?.querySelector<HTMLElement>(`#brief-heading-${key}`)?.focus()}><span>{String(index + 1).padStart(2, "0")}</span>{c[key]}{sectionState(model, key).stale && <span aria-label={c.stale}>●</span>}</button>)}</div></details></nav>
        <article className={styles.briefDocument}>{sectionKeys.map((key, index) => { const state = sectionState(model, key), isEditing = editing.includes(key); return <section className={styles.briefSection} key={key} data-testid={`brief-${key}`}>
          <div className={styles.briefHeading}><div><span className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</span><h3 id={`brief-heading-${key}`} tabIndex={-1}>{c[key]}</h3></div><button disabled={readonly} aria-expanded={isEditing} aria-controls={`brief-content-${key}`} onClick={() => { setEditing(isEditing ? editing.filter(k => k !== key) : [...editing, key]); if (!isEditing) requestAnimationFrame(() => root.current?.querySelector<HTMLTextAreaElement>(`[data-testid="brief-${key}"] textarea`)?.focus()); }}>{isEditing ? t.done : t.edit}</button></div>
          {state.edited && <span className={styles.badge}>{c.edited}</span>}{state.stale && <p className={styles.notice}>{c.stale}</p>}
          <div id={`brief-content-${key}`}>{isEditing ? <Field label={c[key]} value={state.text} max={MAX_BRIEF_TEXT} disabled={readonly} big onChange={text => update(editBrief(model, key, text))} /> : <p className={styles.briefText}>{state.text}</p>}</div>
          {state.edited && <><div className={styles.actions}><button disabled={readonly} onClick={() => update({ ...model, brief: { ...model.brief, [key]: { text: state.text, basis: state.basis } } })}>{c.accept}</button><button disabled={readonly} onClick={() => { const brief = { ...model.brief }; delete brief[key]; update({ ...model, brief }); }}>{c.regenerate}</button></div><details><summary>{c.generated}</summary><p className={styles.briefText}>{state.generated}</p></details></>}
        </section>; })}</article>
      </div>
      <div className={styles.viewFooter}><p className={styles.muted}>{c.planning}</p><button className={styles.primary} onClick={() => setModal("export")}>{t.exports} <span aria-hidden>↗</span></button></div>
    </section>
    {modal && !pending && <Dialog title={modal === "files" ? t.files : modal === "share" ? c.shareTitle : t.exportTitle} closeLabel={t.close} onClose={() => setModal(null)}>
      {modal === "files" && <><p className={styles.muted}>{t.fileHint}</p><div className={styles.fileGrid}>
        <button disabled={readonly} onClick={load}>{c.load}</button>
        {!readonly && <label className={styles.file}>{c.import}<input type="file" accept="application/json,.json" aria-label={c.import} onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ""; }} /></label>}
        <button disabled={graphErrors.length > 0} onClick={() => download("ai-workflow-blueprint.json", JSON.stringify(model, null, 2), "application/json")}>{c.json}</button>
      </div><div className={styles.destructiveGroup}><p className={styles.muted}>{t.resetHint}</p><div className={styles.actions}><button disabled={readonly} onClick={() => setPending(preset(model.template, language))}>{c.reset}</button><button className={styles.danger} disabled={readonly} onClick={() => { try { window.localStorage.removeItem(STORAGE_KEY); setSaveState("unsaved"); setNotice(c.deleted); } catch { setNotice(c.storage); } }}>{c.delete}</button></div></div></>}
      {modal === "share" && <><p className={styles.muted}>{t.shareHint}</p><div className={styles.shareChoice}><strong>{includeText ? t.included : t.shares}</strong><label className={styles.check}><input type="checkbox" checked={includeText} onChange={e => { setIncludeText(e.target.checked); setLink(""); }} />{c.include}</label><p>{includeText ? c.shareAll : c.shareDefault}</p></div>
        <details><summary>{c.sharePreview}</summary><pre className={styles.preview} tabIndex={0} aria-label={c.sharePreview}>{JSON.stringify(shared, null, 2)}</pre></details>
        <div className={styles.actions}><button className={styles.primary} onClick={() => { try { setLink("https://www.blockconsult.org" + (language === "de" ? "/de" : "") + "/tools/ai-workflow-blueprint" + encodeShare(shared)); setNotice(""); } catch (e) { fail(e); } }}>{c.createLink}</button></div>
        {link && <div className={styles.linkResult}><Field label={c.link} value={link} max={40000} disabled onChange={() => {}} /><button onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice(c.copied); } catch { setNotice(c.clipboard); } }}>{c.copyLink}</button></div>}
      </>}
      {modal === "export" && <>{issues.length > 0 && <p className={styles.notice}>{t.graphOnly}</p>}<div className={styles.exportGroups}>
        <section><h3>{t.briefExport}</h3><p>{t.briefExportHint}</p><div className={styles.actions}><button disabled={issues.length > 0} onClick={() => download("ai-workflow-blueprint-brief.md", markdown(model), "text/markdown;charset=utf-8")}>{c.markdown}</button><button disabled={issues.length > 0} onClick={() => window.print()}>{c.print}</button></div></section>
        <section><h3>{t.diagramExport}</h3><p>{t.diagramExportHint}</p><div className={styles.actions}><button disabled={issues.length > 0 || busy} onClick={() => void exportImage("svg")}>{c.svg}</button><button disabled={issues.length > 0 || busy} onClick={() => void exportImage("diagram")}>{c.diagramPng}</button></div></section>
        <section><h3>{t.summaryExport}</h3><p>{t.summaryExportHint}</p><button disabled={issues.length > 0 || busy} onClick={() => void exportImage("summary")}>{c.png}</button></section>
        <section><h3>{t.dataExport}</h3><p>{t.dataExportHint}</p><button disabled={graphErrors.length > 0} onClick={() => download("ai-workflow-blueprint.json", JSON.stringify(model, null, 2), "application/json")}>{c.json}</button></section>
      </div></>}
      <div role="status" aria-live="polite" className={busy || notice ? styles.notice : styles.emptyStatus}>{busy ? t.exporting : notice}</div>
    </Dialog>}
    {pending && <Dialog title={c.confirmReplace} closeLabel={t.close} onClose={() => setPending(null)}><div className={styles.actions}><button className={styles.primary} onClick={() => replace(pending)}>{c.yes}</button><button onClick={() => setPending(null)}>{c.cancel}</button></div></Dialog>}
    {removeId && <Dialog title={t.removeStep} closeLabel={t.close} onClose={() => setRemoveId(null)}><p>{stepName(removeId)}</p><div className={styles.actions}><button className={styles.danger} onClick={() => { const index = model.steps.findIndex(s => s.id === removeId); const next = removeStep(model, removeId); update(next); setRemoveId(null); focusStep(next.steps[Math.min(index, next.steps.length - 1)].id); }}>{t.confirmRemove}</button><button onClick={() => setRemoveId(null)}>{c.cancel}</button></div></Dialog>}
    <div className={styles.report}>
      <h1>{c.title}</h1><p>{c.report} · v1 · Block Consult</p><p>{c.planning}</p>
      <p>{model.steps.length} {c.steps} · {model.edges.length} {c.branches} · {model.steps.filter(s => s.type === "review").length} {c.reviews}</p>
      {issues.length > 0 && <p>{c.issues}: {issues.map(i => errorText(i.code, language)).join(" ")}</p>}
      <h2>{c.graph}</h2><OrderedText model={model} />
      {sectionKeys.map(key => { const state = sectionState(model, key); return <section key={key}><h2>{c[key]}</h2>{state.stale && <p>{c.stale}</p>}<p className={styles.briefText}>{state.text}</p></section>; })}
    </div>
  </div>;
}
