import { forwardRef } from "react";
import { copy, conditionLabel } from "./copy";
import { orderedSteps, type Model } from "./model";
import styles from "./blueprint.module.css";
import { wrap } from "./text";
export const Diagram = forwardRef<SVGSVGElement, { model: Model }>(function Diagram({ model }, ref) {
  const c = copy[model.locale], steps = orderedSteps(model), height = 120 + steps.length * 156;
  const positions = new Map(steps.map((s, i) => [s.id, 100 + i * 156]));
  return <svg ref={ref} role="img" aria-label={`${c.title}: ${steps.length} ${c.steps}, ${model.edges.length} ${c.branches}`} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 760 ${height}`} width="760" height={height} className={styles.diagram}>
    <title>{c.title}</title><desc>{c.orderHelp} {c.table}</desc>
    <rect width="760" height={height} fill="var(--color-surface)" />
    <text x="20" y="34" fontSize="20" fontWeight="600" fill="var(--color-fg)">{c.title} · v1</text>
    <text x="20" y="62" fontSize="12" fill="var(--color-muted)">{steps.length} {c.steps} · {model.edges.length} {c.branches} · {c.report}</text>
    {model.edges.map((e, index) => {
      const y1 = positions.get(e.from), y2 = positions.get(e.to);
      if (y1 === undefined || y2 === undefined) return null;
      const siblings = model.edges.filter(x => x.from === e.from), rank = siblings.indexOf(e);
      const start = y1 + 25 + rank * 18, end = y2 + 102, lane = 650 + (index % 7) * 13;
      const failure = ["failure", "rejected", "invalid", "insufficient"].includes(e.condition);
      return <g key={`${e.from}-${e.condition}`} fill="none" stroke={failure ? "var(--color-muted)" : "var(--color-accent)"} strokeWidth="1.5">
        <path d={`M 460 ${start} H ${lane} V ${end} H 460`} strokeDasharray={failure ? "5 4" : undefined} />
        <path d={`M 468 ${end - 4} L 460 ${end} L 468 ${end + 4}`} />
        <rect x="474" y={start - 13} width="169" height="17" fill="var(--color-surface)" stroke="none" />
        <text x="478" y={start} fontSize="11" fill="var(--color-fg)" stroke="none">{conditionLabel(e.condition, model.locale)} → {steps.findIndex(s => s.id === e.to) + 1}</text>
      </g>;
    })}
    {steps.map((s, i) => <g key={s.id}>
      <rect x="20" y={positions.get(s.id)} width="440" height="124" fill="var(--color-bg)" stroke="var(--color-line-strong)" />
      <text x="38" y={positions.get(s.id)! + 25} fontSize="12" fontWeight="600" fill="var(--color-link)">{String(i + 1).padStart(2, "0")} / {c[s.type]}</text>
      {wrap((s.label || c.noName).replace(/\s+/g, " "), 42).map((line, n) => <text key={n} x="38" y={positions.get(s.id)! + 50 + n * 20} fontSize="16" fontFamily="var(--font-mono)" fill="var(--color-fg)">{line}</text>)}
      <text x="38" y={positions.get(s.id)! + 110} fontSize="11" fill="var(--color-muted)">{s.id}</text>
    </g>)}
  </svg>;
});
