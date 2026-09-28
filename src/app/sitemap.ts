import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://lifepot.modepot.io/", changeFrequency: "monthly", priority: 1 }];
}
