"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./blueprint.module.css";
export function Dialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) onClose();
  }}>
    <div className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" aria-label={closeLabel} onClick={onClose} className={styles.iconButton}>×</button></div>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
