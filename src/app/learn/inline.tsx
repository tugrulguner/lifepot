import { createElement, type ReactNode } from "react";
import Link from "next/link";

function safeHref(rawHref: string) {
  const href = rawHref.startsWith("../")
    ? `https://github.com/tugrulguner/lifepot/blob/main/docs/${rawHref.slice(3)}`
    : rawHref;
  if (/^https?:\/\//i.test(href) || !/^[a-z][a-z\d+.-]*:/i.test(href)) return href;
  return null;
}

export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let plainStart = 0;

  const flushText = (end: number) => {
    if (end > plainStart) nodes.push(text.slice(plainStart, end));
  };

  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "`") {
      const end = text.indexOf("`", cursor + 1);
      if (end !== -1) {
        flushText(cursor);
        nodes.push(createElement("code", { key: cursor }, text.slice(cursor + 1, end)));
        cursor = end + 1;
        plainStart = cursor;
        continue;
      }
    }
    if (text.startsWith("**", cursor)) {
      const end = text.indexOf("**", cursor + 2);
      if (end !== -1) {
        flushText(cursor);
        nodes.push(createElement("strong", { key: cursor }, renderInline(text.slice(cursor + 2, end))));
        cursor = end + 2;
        plainStart = cursor;
        continue;
      }
    }
    if (char === "[") {
      const closeLabel = text.indexOf("](", cursor + 1);
      const closeHref = closeLabel === -1 ? -1 : text.indexOf(")", closeLabel + 2);
      if (closeLabel !== -1 && closeHref !== -1) {
        const href = safeHref(text.slice(closeLabel + 2, closeHref));
        if (href) {
          flushText(cursor);
          const label = renderInline(text.slice(cursor + 1, closeLabel));
          nodes.push(/^https?:\/\//i.test(href)
            ? createElement("a", { key: cursor, href }, label)
            : createElement(Link, { key: cursor, href }, label));
          cursor = closeHref + 1;
          plainStart = cursor;
          continue;
        }
      }
    }
    cursor += 1;
  }
  flushText(text.length);
  return nodes;
}
