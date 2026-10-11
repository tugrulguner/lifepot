"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildRunComparison } from "@/game/run-reflection";
import { conditionLabel, conditionValue } from "@/game/condition-labels";
import { deleteWorld, exportWorld, importWorld, listWorlds, saveWorld, MAX_WORLD_EXPORT_BYTES, type WorldRecord } from "@/game/my-worlds";

export type SavedWorldInput = Omit<WorldRecord, "id" | "name" | "createdAt">;
type Props = { current?: SavedWorldInput; entryShortcut?: boolean; onOpen: (record: WorldRecord) => void; onReview?: (record: WorldRecord) => void; onSaved?: (record: WorldRecord) => void };
function storageError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError") return "Browser storage is full. Export a backup and delete an unwanted save before trying again.";
  return error instanceof Error ? error.message : "Browser-local storage unavailable. Your running world has not been changed.";
}
export function MyWorldsPanel({ current, entryShortcut = false, onOpen, onReview, onSaved }: Props) {
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = async () => setRecords(await listWorlds());
  useEffect(() => {
    let active = true;
    listWorlds().then(rows => { if (active) setRecords(rows); }).catch(reason => { if (active) setError(storageError(reason)); });
    return () => { active = false; };
  }, []);
  const perform = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (reason) { setError(storageError(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = () => perform(async () => {
    if (!current) return;
    const record = await saveWorld(current, name);
    onSaved?.(record);
    setName("");
    setMessage("World saved in this browser.");
    await refresh();
  });
  const importFile = (file?: File) => perform(async () => {
    if (!file) return;
    try {
      if (file.size > MAX_WORLD_EXPORT_BYTES) throw new Error("World export is too large. Import a single LifePot world export.");
      await importWorld(await file.text());
      setMessage("World imported in this browser. Reopen its recorded replay, or review a changed experiment.");
      await refresh();
    } finally { if (fileRef.current) fileRef.current.value = ""; }
  });
  const download = (record: WorldRecord) => {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([exportWorld(record)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "lifepot-world.json";
      document.body.append(anchor); anchor.click(); anchor.remove();
      setMessage("World export downloaded. It includes setup answers and recorded decisions; keep it private if those contain personal information.");
    } catch (reason) { setError(storageError(reason)); }
    finally { if (url) { const completedUrl = url; setTimeout(() => URL.revokeObjectURL(completedUrl), 1000); } }
  };
  return <>
  {entryShortcut && records.length > 0 && (() => { const button = <button type="button" className="my-worlds-shortcut ph-no-capture" data-ph-no-capture="true" aria-label={`My Worlds (${records.length})`} onClick={() => document.getElementById("my-worlds-shelf")?.scrollIntoView({ behavior: "instant", block: "start" })}>My Worlds ({records.length})</button>; const entry = document.getElementById("my-worlds-entry"); return entry ? createPortal(button, entry) : button; })()}
  <section id="my-worlds-shelf" className="my-worlds ph-no-capture" data-ph-no-capture="true" aria-label="My Worlds — browser-local saves" aria-busy={busy}>
    <h2>My Worlds</h2>
    <p>Saved only in this browser and device. No account or sync. Browser storage can be cleared or evicted, so export a backup.</p>
    <p>Portable exports include your setup answers, world parameters and recorded decisions. Optional private questions and notes are omitted. Nothing is uploaded by saving or importing.</p>
    {current && <div className="my-worlds-save">
      <label htmlFor="my-world-name">Optional world name (stored locally)</label>
      <input id="my-world-name" value={name} maxLength={80} disabled={busy} onChange={event => setName(event.target.value)} autoComplete="off" />
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save completed world"}</button>
    </div>}
    <div className="my-worlds-import"><button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>Import world export</button><input ref={fileRef} disabled={busy} type="file" accept="application/json,.json" aria-label="Import a LifePot world export" onChange={event => void importFile(event.target.files?.[0])} /></div>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!error && records.length === 0 && <p>No saved worlds in this browser yet. Complete a run to save it.</p>}
    {records.length > 0 && <ul>{records.map(record => <li key={record.id}>
      <div className="my-worlds-summary"><strong>{record.name || "Unnamed world"}</strong>
        <span>Generation {record.evidence.samples.at(-1)?.generation ?? 0} · {record.outcome} · {record.stopReason}</span>
        <span>{record.evidence.samples.at(-1)?.population ?? 0} organisms at stop</span>
        {record.setup?.namedIntent?.species?.length ? <span>Organisms: {record.setup.namedIntent.species.map(species => `${species.name} (${record.evidence.firstExtinction.find(item => item.speciesId === species.id)?.generation === undefined ? "present at stop" : `extinct at generation ${record.evidence.firstExtinction.find(item => item.speciesId === species.id)!.generation}`})`).join(" · ")}</span> : record.evidence.firstExtinction.length > 0 && <span>First losses: {record.evidence.firstExtinction.map(event => `${event.speciesId} at generation ${event.generation}`).join(" · ")}</span>}
        {record.parentId && (() => { const parent = records.find(item => item.id === record.parentId); if (!parent) return <span role="status">Follow-up to a previous saved world (not stored here); comparison unavailable.</span>; const changes = buildRunComparison({ config: parent.replay.config, evidence: parent.evidence }, { config: record.replay.config, evidence: record.evidence }).conditionChanges; return <span>Follow-up to {parent.name}. Changed conditions: {changes.length ? changes.map(change => `${conditionLabel(change.path)} ${conditionValue(change.path, change.before)} → ${conditionValue(change.path, change.after)}`).join(" · ") : "no recorded condition changes"}. Trajectories and recorded extinction timing are available in run comparison.</span>; })()}
        <details><summary>Technical provenance</summary><span>Seed {record.replay.seed} · Recorded engine {record.replay.engineVersion} · Policy {record.policy ?? "recorded"}</span></details>
      </div>
      <div className="my-worlds-actions">
        <button type="button" disabled={busy} onClick={() => onOpen(record)}>Reopen and replay</button>
        {onReview && <button type="button" disabled={busy} onClick={() => onReview(record)}>Review changed experiment</button>}
        <button type="button" disabled={busy} onClick={() => download(record)}>Export</button>
        <button type="button" disabled={busy} onClick={() => void perform(async () => { await deleteWorld(record.id); await refresh(); setMessage("Saved world deleted. Any exported backup remains yours."); })}>Delete</button>
      </div>
    </li>)}</ul>}
  </section>
  </>;
}
