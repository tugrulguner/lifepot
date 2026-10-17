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

const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/tugrulguner/", mark: "in" },
  { label: "GitHub", href: "https://github.com/tugrulguner/lifepot", mark: "github" },
  { label: "X", href: "https://x.com/Tugrul_Guner", mark: "𝕏" },
];

function SocialMark({ mark }: { mark: string }) {
  if (mark === "github") return <span aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.08 3.33 1.58.1-.73.39-1.23.7-1.51-2.5-.28-5.12-1.25-5.12-5.56 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.16a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.16 3.08-1.16.62 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.62 5.28-5.13 5.56.4.35.75 1.03.75 2.08v3.06c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /></svg></span>;
  return <span aria-hidden="true">{mark}</span>;
}

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
      <nav className="family-socials" aria-label="Social media">
        {socials.map(({ label, href, mark }) => <a className="family-social ph-no-autocapture" key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} data-ph-no-autocapture="true"><SocialMark mark={mark} /></a>)}
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
      <nav aria-label="Social links" className="family-menu-socials">
        {socials.map(({ label, href, mark }) => <a className="family-social ph-no-autocapture" key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} data-ph-no-autocapture="true"><SocialMark mark={mark} />{label}</a>)}
      </nav>
      <FeedbackLink path={feedbackPath} />
      <nav aria-label="LifePot navigation" className="family-menu-product">
        <Link href="/">Overview</Link><Link href="/learn">Documentation</Link><Link href="/play">Play</Link>
      </nav>
    </section>
  </>;
}
