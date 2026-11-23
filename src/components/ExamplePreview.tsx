"use client";

import { useEffect, useRef, useState } from "react";

export default function ExamplePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intent = useRef<"auto" | "play" | "pause">("auto");
  const syncRef = useRef<() => void>(() => {});
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let visible = false;
    let alive = true;
    let pending = false;
    const sync = () => {
      const allowed = intent.current === "play" || (intent.current === "auto" && !motion.matches && !connection?.saveData);
      if (!allowed || !visible || document.visibilityState !== "visible") {
        video.pause();
        if (!allowed && intent.current === "auto" && video.hasAttribute("src")) {
          video.removeAttribute("src"); video.load();
        }
        return;
      }
      if (pending || !video.paused) return;
      // Set the source before play(), otherwise the first autoplay attempt rejects.
      if (!video.hasAttribute("src")) video.src = "/life-example.mp4";
      pending = true;
      void video.play().then(() => {
        if (alive && (!visible || document.visibilityState !== "visible" || intent.current === "pause")) video.pause();
      }).catch(() => {
        if (alive) { intent.current = "pause"; video.pause(); setActive(false); }
      }).finally(() => { pending = false; });
    };
    syncRef.current = sync;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer?.observe(video);
    motion.addEventListener("change", sync);
    connection?.addEventListener?.("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      alive = false; observer?.disconnect(); video.pause();
      motion.removeEventListener("change", sync);
      connection?.removeEventListener?.("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <div>
    <video ref={videoRef} data-example-video poster="/life-example-poster.jpg" preload="none" muted playsInline loop
      aria-label="Recorded example preview" onPlay={() => setActive(true)} onPause={() => setActive(false)} onError={() => setActive(false)} />
    <button type="button" aria-pressed={active} onClick={() => {
      intent.current = active ? "pause" : "play";
      syncRef.current();
    }}>{active ? "Pause preview" : "Play preview"}</button>
  </div>;
}
