"use client";

import Link from "next/link";
import { SiteThemeControl } from "./SiteThemeControl";
import { useEffect, useRef, useState, type ReactNode } from "react";

const resources = [
  { label: "ModePot", href: "https://modepot.io/" },
  { label: "GitHub", href: "https://github.com/tugrulguner/lifepot" },
  { label: "Community", href: "https://discord.gg/u3AANZr6RG" },
  { label: "About Tugrul", href: "https://tugrul.modepot.io/" },
];

export function FeedbackLink({ path }: { path: "/" | "/learn" | "/play" }) {
  const title = `LifePot feedback — ${path}`;
  const body = `LifePot page: ${path}\n\nPlease describe the issue or feedback. Avoid including private questions, replay data, saved-world names, or other personal information.`;
  const href = `https://github.com/tugrulguner/lifepot/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return <a className="family-feedback ph-no-autocapture" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Feedback / report an issue for ${path} (opens in a new tab)`} data-ph-no-autocapture="true">Feedback / issue</a>;
}

export function FamilyHeader({ children, feedbackPath = "/play" }: { children?: ReactNode; feedbackPath?: "/" | "/learn" | "/play" }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <header className="family-header">
      <Link className="family-product" href="/" aria-label="LifePot home"><span>Life<span className="family-wordmark-pot">Pot</span></span></Link>
      <nav className="family-desktop-resources" aria-label="ModePot family">
        {resources.map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
      </nav>
      <a className="family-compact-home" href="https://modepot.io/">ModePot</a>
      <div className="family-header-actions">
        <FeedbackLink path={feedbackPath} />
        <Link className="family-desktop-docs" href="/learn">Documentation</Link>
        {children ?? <SiteThemeControl />}
        <button ref={button} className="family-menu-toggle" type="button" aria-expanded={open} aria-controls="family-menu" onClick={() => setOpen(value => !value)}>Menu</button>
      </div>
    </header>
    <section id="family-menu" className="family-menu" role="region" aria-label="Menu" hidden={!open}>
      <nav aria-label="ModePot family" className="family-menu-resources">
        {resources.slice(1).map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
      </nav>
      <FeedbackLink path={feedbackPath} />
      <nav aria-label="LifePot navigation" className="family-menu-product">
        <Link href="/">Overview</Link><Link href="/learn">Documentation</Link><Link href="/play">Play</Link>
      </nav>
    </section>
  </>;
}
