import type { MetadataRoute } from "next";
import { publicDocuments } from "./project-docs/content";
import { guides } from "./learn/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://lifepot.modepot.io/", changeFrequency: "monthly", priority: 1 },
    { url: "https://lifepot.modepot.io/learn", changeFrequency: "monthly", priority: 0.7 },
    { url: "https://lifepot.modepot.io/play", changeFrequency: "monthly", priority: 0.8 },
    ...guides.map(({ slug }) => ({ url: `https://lifepot.modepot.io/learn/${slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...publicDocuments.map(({ slug }) => ({ url: `https://lifepot.modepot.io/project-docs/${slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
