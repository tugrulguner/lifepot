import type { MetadataRoute } from "next";
import { publicDocuments } from "./project-docs/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://lifepot.modepot.io/", changeFrequency: "monthly", priority: 1 },
    { url: "https://lifepot.modepot.io/learn", changeFrequency: "monthly", priority: 0.7 },
    { url: "https://lifepot.modepot.io/learn/player-guide", changeFrequency: "monthly", priority: 0.6 },
    { url: "https://lifepot.modepot.io/learn/developer-reference", changeFrequency: "monthly", priority: 0.6 },
    ...publicDocuments.map(({ slug }) => ({ url: `https://lifepot.modepot.io/project-docs/${slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
