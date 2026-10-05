import { createElement, type ReactNode } from "react";
import Link from "next/link";

function safeHref(rawHref: string, sourceUrl?: string, image = false) {
  const href = sourceUrl && !/^(?:https?:|mailto:|#|\/\/)/i.test(rawHref)
    ? new URL(rawHref, sourceUrl)
    : rawHref;
  const value = href instanceof URL ? href.toString() : href;
  if (!/^https?:\/\//i.test(value) && /^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  return image && sourceUrl && href instanceof URL
    ? value.replace("github.com/tugrulguner/lifepot/blob/", "raw.githubusercontent.com/tugrulguner/lifepot/")
    : value;
}

export function renderInline(text: string, sourceUrl?: string): ReactNode[] {
  const safeMarkup = text
    .replace(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)")
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<\/?(?:p|strong|em|br)\b[^>]*>/gi, "");
  text = safeMarkup;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let plainStart = 0;
  const flushText = (end: number) => { if (end > plainStart) nodes.push(text.slice(plainStart, end)); };
  while (cursor < text.length) {
    if (text.startsWith("![", cursor)) {
      const closeLabel = text.indexOf("](", cursor + 2);
      const closeHref = closeLabel === -1 ? -1 : text.indexOf(")", closeLabel + 2);
      if (closeLabel !== -1 && closeHref !== -1) {
        const src = safeHref(text.slice(closeLabel + 2, closeHref), sourceUrl, true);
        if (src) {
          flushText(cursor);
          nodes.push(createElement("img", { key: cursor, src, alt: text.slice(cursor + 2, closeLabel), loading: "lazy" }));
          cursor = closeHref + 1; plainStart = cursor; continue;
        }
      }
    }
    const char = text[cursor];
    if (char === "`") {
      const end = text.indexOf("`", cursor + 1);
      if (end !== -1) { flushText(cursor); nodes.push(createElement("code", { key: cursor }, text.slice(cursor + 1, end))); cursor = end + 1; plainStart = cursor; continue; }
    }
    if (text.startsWith("**", cursor)) {
      const end = text.indexOf("**", cursor + 2);
      if (end !== -1) { flushText(cursor); nodes.push(createElement("strong", { key: cursor }, renderInline(text.slice(cursor + 2, end), sourceUrl))); cursor = end + 2; plainStart = cursor; continue; }
    }
    if (char === "[") {
      const closeLabel = text.indexOf("](", cursor + 1);
      const closeHref = closeLabel === -1 ? -1 : text.indexOf(")", closeLabel + 2);
      if (closeLabel !== -1 && closeHref !== -1) {
        const href = safeHref(text.slice(closeLabel + 2, closeHref), sourceUrl);
        if (href) {
          flushText(cursor);
          const label = renderInline(text.slice(cursor + 1, closeLabel), sourceUrl);
          nodes.push(/^https?:\/\//i.test(href) ? createElement("a", { key: cursor, href }, label) : createElement(Link, { key: cursor, href }, label));
          cursor = closeHref + 1; plainStart = cursor; continue;
        }
      }
    }
    cursor += 1;
  }
  flushText(text.length);
  return nodes;
}
