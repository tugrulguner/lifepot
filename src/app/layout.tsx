import type { Metadata } from "next";
import { PostHogProvider } from "./posthog-provider";
import "./globals.css";

const siteUrl = "https://lifepot.modepot.io";
const title = "LifePot — Artificial life shaped by your world";
const description = "Shape a deterministic artificial-life world. Jev proposes typed ecology, LifePot validates it, and replayable code runs the simulation.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "LifePot",
  category: "science education",
  alternates: { canonical: "/", types: { "text/plain": "/llms.txt", "text/markdown": "/learn/developer-reference/markdown" } },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "LifePot",
    title,
    description,
    images: [{ url: "/lifepot-lockup.png", width: 1200, height: 900, alt: "LifePot: bounded artificial life and replayable evolution" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/lifepot-lockup.png", width: 1200, height: 900, alt: "LifePot: bounded artificial life and replayable evolution" }],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/lifepot-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('lifepot-theme')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(_){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "LifePot",
              url: siteUrl,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Any",
              description,
              codeRepository: "https://github.com/tugrulguner/lifepot",
              license: "https://opensource.org/license/mit",
              isPartOf: { "@type": "Organization", name: "ModePot", url: "https://modepot.io/" },
              creator: { "@type": "Organization", name: "ModePot", url: "https://modepot.io/" },
            }).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
