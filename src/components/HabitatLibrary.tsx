"use client";

import { useEffect, useRef, useState } from "react";
import type { HabitatCheckpoint } from "@/game/habitat-checkpoint";
import { encodeHabitatCheckpoint, MAX_HABITAT_CHECKPOINT_BYTES } from "@/game/habitat-checkpoint";
import { deleteHabitat, importHabitat, listHabitats, loadHabitat } from "@/game/habitat-storage";
import styles from "./HabitatLibrary.module.css";

type Props = { onOpen: (checkpoint: HabitatCheckpoint) => void; refreshKey?: number };
function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "The habitat operation failed. Your running habitat has not been changed.";
}
function speciesNames(checkpoint: HabitatCheckpoint): string[] {
  const fromIntent = checkpoint.setup?.namedIntent?.species?.map(species => species.name).filter(Boolean) ?? [];
  if (fromIntent.length) return fromIntent;
  return checkpoint.state.config.rules?.species?.map(species => species.id) ?? [];
}
function habitatState(checkpoint: HabitatCheckpoint): string {
  if (checkpoint.state.outcome === "extinct" || checkpoint.state.stats?.population === 0) return "Extinct";
  const limit = checkpoint.state.fixedHabitat?.observationLimit;
  if (limit !== undefined && checkpoint.state.generation >= limit) return "Observation window complete";
  return "Paused";
}
export function HabitatLibrary({ onOpen, refreshKey = 0 }: Props) {
  const [habitats, setHabitats] = useState<HabitatCheckpoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestRef.current += 1; };
  }, []);

  useEffect(() => {
    const request = ++requestRef.current;
    let active = true;
    listHabitats().then(rows => {
      if (active && mountedRef.current && request === requestRef.current) setHabitats(rows);
    }).catch(reason => {
      if (active && mountedRef.current && request === requestRef.current) setError(errorText(reason));
    });
    return () => { active = false; };
  }, [refreshKey, refreshNonce]);

  const perform = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setMessage("");
    try { await operation(); }
    catch (reason) { if (mountedRef.current) setError(errorText(reason)); }
    finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const open = (checkpoint: HabitatCheckpoint) => void perform(async () => {
    const latest = await loadHabitat(checkpoint.id);
    if (mountedRef.current) onOpen(latest);
  });

  const importFile = (file?: File) => void perform(async () => {
    if (!file) return;
    try {
      if (file.size > MAX_HABITAT_CHECKPOINT_BYTES) throw new Error("Habitat backup exceeds the 8 MiB import limit.");
      await importHabitat(await file.text());
      if (!mountedRef.current) return;
      setMessage("Habitat backup imported on this device. It was not opened or advanced.");
      setRefreshNonce(value => value + 1);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  });

  const download = (checkpoint: HabitatCheckpoint) => {
    if (busyRef.current) return;
    setError(""); setMessage("");
    let url: string | undefined;
    try {
      const text = encodeHabitatCheckpoint(checkpoint);
      url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "lifepot-habitat.json";
      document.body.append(anchor); anchor.click(); anchor.remove();
      setMessage(`Backup exported for ${checkpoint.name || "unnamed habitat"}. Its checksum detects accidental changes; it is not authentication.`);
    } catch (reason) { setError(errorText(reason)); }
    finally { if (url) { const completedUrl = url; setTimeout(() => URL.revokeObjectURL(completedUrl), 0); } }
  };

  const remove = (checkpoint: HabitatCheckpoint) => {
    if (busyRef.current || !window.confirm(`Delete “${checkpoint.name || "unnamed habitat"}” from this device? This cannot be undone here.`)) return;
    void perform(async () => {
      await deleteHabitat(checkpoint.id);
      if (!mountedRef.current) return;
      setMessage("Habitat deleted from this device. Any exported backup remains yours.");
      setRefreshNonce(value => value + 1);
    });
  };

  return <section className={`${styles.library} ph-no-capture`} data-ph-no-capture="true" aria-label="Saved habitats — fixed-habitat checkpoints" aria-busy={busy}>
    <details className={styles.shelf} open>
      <summary className={styles.summary} aria-label={`Saved habitats (${habitats.length})`}>
        <span>Saved habitats</span><span className={styles.count}>{habitats.length}</span>
      </summary>
      <div className={styles.content}>
        <p className={styles.disclosure}>Saved only on this device in browser storage. The browser may clear or evict local data; export a backup to keep a copy. No account or sync. These are fixed-rule habitats: no runtime AI, no offline advance, and reopening resumes the saved checkpoint without reseeding.</p>
        <div className={styles.importRow}>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>Import habitat backup</button>
          <input ref={fileRef} className={styles.file} disabled={busy} type="file" accept="application/json,.json" aria-label="Import a habitat backup" onChange={event => void importFile(event.target.files?.[0])} />
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {message && <p role="status" className={styles.message}>{message}</p>}
        {habitats.length === 0 ? <p>No saved habitats on this device yet.</p> : <ul className={styles.list}>
          {habitats.map(checkpoint => {
            const sample = checkpoint.evidence.samples.at(-1);
            const followed = checkpoint.evidence.followedFamily;
            const names = speciesNames(checkpoint);
            const limit = checkpoint.state.fixedHabitat?.observationLimit;
            return <li className={styles.item} key={checkpoint.id}>
              <div className={styles.summaryText}>
                <h3>{checkpoint.name || "Unnamed habitat"}</h3>
                <p>{habitatState(checkpoint)} · Generation {checkpoint.state.generation}{limit === undefined ? "" : ` / window ${limit}`}</p>
                <p>Population {sample?.population ?? checkpoint.state.stats?.population ?? 0}</p>
                {followed && <p>Followed family {followed.lineage} · population {followed.population}</p>}
                {checkpoint.evidence.lineageExtinction.length > 0 && <p>Followed-family losses: {checkpoint.evidence.lineageExtinction.map(loss => `lineage ${loss.lineage} at generation ${loss.generation}`).join(" · ")}</p>}
                {names.length > 0 && <p>Species: {names.join(", ")}</p>}
                {checkpoint.evidence.firstExtinction.length > 0 && <p>Species losses: {checkpoint.evidence.firstExtinction.map(loss => `${loss.speciesId} at generation ${loss.generation}`).join(" · ")}</p>}
              </div>
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={() => open(checkpoint)}>Open paused habitat: {checkpoint.name || "Unnamed habitat"}</button>
                <button type="button" disabled={busy} onClick={() => download(checkpoint)}>Export habitat: {checkpoint.name || "Unnamed habitat"}</button>
                <button type="button" disabled={busy} onClick={() => remove(checkpoint)}>Delete habitat: {checkpoint.name || "Unnamed habitat"}</button>
              </div>
            </li>;
          })}
        </ul>}
      </div>
    </details>
  </section>;
}
