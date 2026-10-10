"use client";
import { useEffect, useState } from "react";
type Theme = "light" | "dark" | "auto";

// Documentation/overview control; the game's own control and renderer stay unchanged.
export function SiteThemeControl() {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = localStorage.getItem("lifepot-theme");
      const value = stored === "light" || stored === "dark" ? stored : "auto";
      setTheme(value);
      document.documentElement.dataset.theme = value === "auto" ? (media.matches ? "dark" : "light") : value;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  function change(value: Theme) {
    localStorage.setItem("lifepot-theme", value);
    setTheme(value);
    const dark = value === "dark" || (value === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  return <label className="theme-control">Theme <select aria-label="Color theme" value={theme} onChange={event => change(event.target.value as Theme)}><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
