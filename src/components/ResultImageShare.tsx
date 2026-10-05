"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DEFAULT_GENERATIONS } from "@/game/world";
import type { SimulationState } from "@/game/world";
import { buildResultImageModel, createResultImageBlob, RESULT_IMAGE_URL } from "@/game/result-image";

type Props = { state: SimulationState; question: string; evidence?: import("@/game/run-evidence").RunEvidence };

export default function ResultImageShare({ state, question, evidence }: Props) {
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generationRef = useRef(0);
  useEffect(() => () => { generationRef.current++; if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  let canShareFile = false;
  try { canShareFile = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && !!preparedFile && navigator.canShare({ files: [preparedFile] }); } catch { canShareFile = false; }

  async function prepare() {
    const request = ++generationRef.current; const optedIn = includeQuestion; setBusy(true); setMessage("");
    try {
      const reason = state.outcome === "extinct" ? `The population became extinct at generation ${state.generation}.` : state.generation >= DEFAULT_GENERATIONS ? `Observation horizon reached at generation ${DEFAULT_GENERATIONS}.` : state.outcome === "running" ? `Simulation stopped at generation ${state.generation}, before the ${DEFAULT_GENERATIONS}-generation observation horizon.` : `The simulation ended: ${state.outcome} at generation ${state.generation}.`;
      const latest = evidence?.samples[evidence.samples.length - 1];
      const blob = await createResultImageBlob(buildResultImageModel(state, optedIn ? question : "", reason, latest ? { births: latest.births, deaths: latest.deaths, kills: latest.kills, history: evidence?.samples.map(sample => ({ generation: sample.generation, population: sample.population })) } : undefined));
      if (generationRef.current !== request || (!includeQuestion && optedIn)) return;
      if (blob.type !== "image/png") throw new Error("PNG creation failed");
      const file = new File([blob], `lifepot-generation-${state.generation}.png`, { type: "image/png" });
      setPreviewUrl(URL.createObjectURL(blob)); setPreparedFile(file); setMessage("Preview ready. The image has not been shared.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prepare the result image."); }
    finally { if (generationRef.current === request) setBusy(false); }
  }

  function download() {
    if (!preparedFile) return;
    const url = URL.createObjectURL(preparedFile); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = preparedFile.name; anchor.click(); URL.revokeObjectURL(url);
  }

  async function share() {
    if (!preparedFile || !canShareFile || typeof navigator.share !== "function") return;
    try { await navigator.share({ files: [preparedFile], title: "LifePot world result" }); setMessage("Share sheet opened. LifePot cannot confirm whether you posted it."); }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") setMessage("Sharing was cancelled."); else setMessage("Could not open the share sheet. Download the image instead."); }
  }

  return <section className="result-image result-image-share" aria-label="Share final world image">
    <button type="button" onClick={prepare} disabled={busy}>{busy ? "Preparing image…" : "Prepare result image"}</button>
    {busy && <p role="status">Preparing PNG…</p>}
    <label><input type="checkbox" checked={includeQuestion} onChange={event => { generationRef.current++; setBusy(false); setIncludeQuestion(event.target.checked); setPreparedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} /> Include my question in the image</label>
    {previewUrl && <div className="result-image__preview"><p>Preview ready</p><Image unoptimized width={1600} height={1000} src={previewUrl} alt="Final world share preview" /><p>{RESULT_IMAGE_URL}</p><button type="button" onClick={() => { setPreparedFile(null); setPreviewUrl(null); setMessage("Preview removed."); }}>Remove preview</button></div>}
    {preparedFile && <div className="result-image__actions"><button type="button" onClick={download}>Download image</button>{canShareFile && <button type="button" onClick={share}>Share image</button>}</div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
