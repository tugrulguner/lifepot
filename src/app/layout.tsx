import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifePot — Artificial life shaped by your world",
  description: "Define an environment and fitness priorities, then watch cellular populations evolve across a deterministic 50×50 world.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
