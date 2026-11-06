"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { inspectReplayAtGeneration, type ReplayData } from "@/game/replay";
import type { SimulationState } from "@/game/world";
import type { RunEvidence } from "@/game/run-evidence";
import styles from "./ObservedHistory.module.css";

type Props = { replay: ReplayData; generation: number; label: string; onClose: () => void; renderScene: (state: SimulationState, evidence: RunEvidence) => ReactNode };
type Inspection = ReturnType<typeof inspectReplayAtGeneration>;
type Outcome = { replay: ReplayData; generation: number; inspection?: Inspection; error?: true };
export function RecordedMomentViewer({ replay, generation, label, onClose, renderScene }: Props) {
 const dialogRef = useRef<HTMLDialogElement>(null), openerRef = useRef<HTMLElement | null>(null);
 const [outcome, setOutcome] = useState<Outcome | null>(null);
 useEffect(() => {
  const dialog = dialogRef.current;
  openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (dialog && !dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); } }
 }, []);
 useEffect(() => {
  let cancelled = false;
  const timer = window.setTimeout(() => {
   try { const inspection = inspectReplayAtGeneration(replay, generation); if (!cancelled) setOutcome({ replay, generation, inspection }); }
   catch { if (!cancelled) setOutcome({ replay, generation, error: true }); }
  }, 0);
  return () => { cancelled = true; window.clearTimeout(timer); };
 }, [replay, generation]);
 const close = () => {
  const dialog = dialogRef.current;
  if (dialog?.open && typeof dialog.close === "function") dialog.close(); else dialog?.removeAttribute("open");
  const opener = openerRef.current;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  onClose();
 };
 const current = outcome?.replay === replay && outcome.generation === generation ? outcome : null;
 return <dialog ref={dialogRef} className={`${styles.dialog} ph-no-capture`} aria-labelledby="recorded-moment-title" aria-modal="true" onCancel={event => { event.preventDefault(); close(); }}>
  <header className={styles.header}><div><h2 id="recorded-moment-title">Recorded moment</h2><p>{label} · Generation {generation}</p></div><button type="button" onClick={close}>Close</button></header>
  <p>This is a historical reconstruction, not the live branch or current world.</p>
  {current?.error ? <p role="alert">Could not inspect this recording.</p> : current?.inspection ? <div className={styles.scene}>{renderScene(current.inspection.state, current.inspection.evidence)}</div> : <p role="status">Reconstructing recorded moment…</p>}
 </dialog>;
}
