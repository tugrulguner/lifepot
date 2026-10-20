"use client";

import { useRef, useState } from "react";
import productDemo from "@/data/product-demo.json";

const videoSource = "/demo/lifepot-explained-demo-537cbbf6.mp4";
const chapters = [
  { seconds: 0, time: "0:00", title: "Create a world", detail: "Set its organisms and conditions." },
  { seconds: 38, time: "0:38", title: "Observe and inspect", detail: "Read traits and follow a family." },
  { seconds: 106, time: "1:46", title: "Try another experiment", detail: "Turn an outcome into a new question." },
  { seconds: 136, time: "2:16", title: "Compare and replay", detail: "Compare runs and keep their history." },
];

export function ProductWalkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const playAttempt = useRef(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  function onPlay() {
    setStarted(true);
    setError(false);
    if (document.activeElement === startButton.current) video.current?.focus({ preventScroll: true });
  }
  function play(seconds: number) {
    const player = video.current;
    if (!player) return;
    const attempt = ++playAttempt.current;
    setError(false);
    if (player.error) player.load();
    if (player.readyState > 0) { pendingSeek.current = null; player.currentTime = seconds; }
    else pendingSeek.current = seconds;
    void player.play().catch((failure: unknown) => {
      if (attempt !== playAttempt.current) return;
      // Native pause cancels pending play without making the media unusable.
      if (failure instanceof DOMException && failure.name === "AbortError" && player.paused && !player.error) return;
      setError(true);
      setStarted(false);
    });
    player.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }
  function onMetadata() {
    if (video.current && pendingSeek.current !== null) {
      video.current.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
  }
  function onTimeUpdate() {
    const seconds = video.current?.currentTime ?? 0;
    let active = 0;
    chapters.forEach((chapter, index) => { if (seconds >= chapter.seconds) active = index; });
    setActiveChapter(active);
  }
  return <section className="overview-demo" id="watch-demo" aria-labelledby="demo-title">
    <div className="demo-intro">
      <div><p className="overview-kicker">LifePot in practice</p><h2 id="demo-title">Watch how it works</h2></div>
      <p id="demo-description">Follow one pond from its first organisms to its next experiment.</p>
    </div>
    <div className="demo-player">
      <div className="demo-player-heading">
        <p id="demo-format">Silent · on-screen explanations · 2 min 48 sec</p>
        <a href={videoSource} target="_blank" rel="noreferrer">Open video <span aria-hidden="true">↗</span></a>
      </div>
      <div className="demo-screen">
        <video ref={video} tabIndex={started ? 0 : -1} aria-label="LifePot explained product demo" aria-describedby="demo-description demo-format" controls playsInline preload="none" width="1920" height="1080" poster="/media/lifepot-explained-demo-537cbbf6.jpg" onLoadedMetadata={onMetadata} onTimeUpdate={onTimeUpdate} onPlay={onPlay} onError={() => { setError(true); setStarted(false); }}>
          <source src={videoSource} type="video/mp4" />
          <track kind="captions" src="/media/lifepot-explained-demo-537cbbf6.vtt" srcLang="en" label="English on-screen text" />
          <a href={videoSource}>Open the LifePot demo video</a>
        </video>
        {!started && <div className="demo-cover"><button ref={startButton} className="demo-start" onClick={() => play(0)} aria-label="Watch the walkthrough">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          <span>Watch the walkthrough</span>
        </button></div>}
      </div>
      <nav className="demo-chapters" aria-label="Walkthrough chapters">
        {chapters.map((chapter, index) => <button key={chapter.seconds} onClick={() => play(chapter.seconds)} aria-label={`${chapter.title}, ${chapter.time}`} aria-current={activeChapter === index ? "step" : undefined}>
          <span className="demo-chapter-top"><span aria-hidden="true">0{index + 1}</span><time dateTime={`PT${chapter.seconds}S`}>{chapter.time}</time></span>
          <span className="demo-chapter-title">{chapter.title}</span>
          <span className="demo-chapter-detail">{chapter.detail}</span>
        </button>)}
      </nav>
    </div>
    {error && <p className="demo-error" role="alert">The video could not be played. Try again or <a href={videoSource}>open it separately</a>.</p>}
    <details className="demo-transcript">
      <summary><span>Read the demo transcript</span><span className="demo-transcript-meta" aria-hidden="true">17 scenes · English <span className="demo-disclosure">+</span></span></summary>
      <ol>{productDemo.map((scene, index) => <li key={index}>
        <h3><span>{scene.time}</span> {scene.title}</h3>
        <p>{scene.caption}</p>
        <ul>{scene.notes.map(note => <li key={note}>{note}</li>)}</ul>
        <p>{scene.hint}</p>
      </li>)}</ol>
    </details>
  </section>;
}
