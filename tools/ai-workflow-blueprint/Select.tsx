"use client";
import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePopup } from "@/simulator/components/fields/use-popup";
import { Chevron, Tick } from "@/simulator/components/fields/icons";
import controls from "@/simulator/components/fields/controls.module.css";
import styles from "./blueprint.module.css";
export function Select<T extends string>({ label, value, options, onChange, disabled = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  const id = useId(), anchor = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const typed = useRef({ value: "", at: 0 });
  const chosen = Math.max(0, options.findIndex(o => o.value === value));
  const dismiss = useCallback(() => setOpen(false), []);
  usePopup({ open, onDismiss: dismiss, anchor, popup, align: "start", gap: 4, matchWidth: true });
  useLayoutEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  const select = (n: number) => { if (options[n]) onChange(options[n].value); setOpen(false); };
  const show = (n: number) => { setActive(n); setOpen(true); };
  function key(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Tab") { if (open) select(active); return; }
    if (e.key === "Escape") { setOpen(false); e.preventDefault(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (!open) { show(e.key === "End" ? options.length - 1 : e.key === "Home" ? 0 : chosen); return; }
      if (e.key === "Enter" || e.key === " ") { select(active); return; }
      const n = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, active + (e.key === "PageDown" ? 10 : e.key === "PageUp" ? -10 : e.key === "ArrowDown" ? 1 : -1)));
      setActive(n);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const fresh = e.timeStamp - typed.current.at > 500;
      const value = fresh ? e.key : typed.current.value + e.key;
      typed.current = { value, at: e.timeStamp };
      const repeated = [...value].every(c => c === value[0]);
      const needle = (repeated ? value[0] : value).toLocaleLowerCase();
      const start = repeated ? (open ? active : chosen) + 1 : (open ? active : chosen);
      for (let i = 0; i < options.length; i++) {
        const n = (start + i) % options.length;
        if (options[n].label.toLocaleLowerCase().startsWith(needle)) { show(n); break; }
      }
    }
  }
  return <div className={styles.field}>
    <span id={`${id}-label`}>{label}</span>
    <button type="button" role="combobox" ref={anchor} aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={`${id}-list`} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} onKeyDown={key} onBlur={dismiss} onClick={() => open ? dismiss() : show(chosen)} className={controls.select}>
      <span>{options[chosen]?.label}</span><Chevron className={controls.chevron} />
    </button>
    <div ref={popup} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} popover="manual" data-open={open} className={controls.popup} onMouseDown={e => e.preventDefault()}>
      {options.map((o, n) => <div id={`${id}-${n}`} key={o.value} role="option" aria-selected={o.value === value} data-active={active === n} onPointerMove={() => setActive(n)} onClick={() => select(n)} className={controls.option}><span>{o.label}</span><span className={controls.mark} aria-hidden><Tick className={controls.tick} /></span></div>)}
    </div>
  </div>;
}
