"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const resources = [
  { label: "ModePot", href: "https://modepot.io/" },
  { label: "GitHub", href: "https://github.com/tugrulguner/lifepot" },
  { label: "Community", href: "https://discord.gg/u3AANZr6RG" },
  { label: "About Tugrul", href: "https://tugrul.modepot.io/" },
];

export function FamilyHeader({ children }: { children?: ReactNode }) {
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
      <Link className="family-product" href="/" aria-label="LifePot home">LifePot</Link>
      <nav className="family-desktop-resources" aria-label="ModePot family">
        {resources.map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
      </nav>
      <a className="family-compact-home" href="https://modepot.io/">ModePot</a>
      <div className="family-header-actions">
        {children}
        <button ref={button} className="family-menu-toggle" type="button" aria-expanded={open} aria-controls="family-menu" onClick={() => setOpen(value => !value)}>Menu</button>
      </div>
    </header>
    <section id="family-menu" className="family-menu" role="region" aria-label="Menu" hidden={!open}>
      <nav aria-label="ModePot family" className="family-menu-resources">
        {resources.slice(1).map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
      </nav>
      <nav aria-label="LifePot navigation" className="family-menu-product">
        <Link href="/">Overview</Link><Link href="/learn">Learn</Link><Link href="/play">Play</Link>
      </nav>
    </section>
  </>;
}
