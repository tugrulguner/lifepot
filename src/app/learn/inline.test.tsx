// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderInline } from "./inline";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderMarkdown } from "./content";

describe("guide inline Markdown", () => {
  afterEach(cleanup);
  it("renders bold emphasis while retaining nested code and links", () => {
    render(<p>{renderInline("**bold `code` and [linked text](/learn)**")}</p>);
    const strong = screen.getByText((_, element) => element?.tagName === "STRONG");
    expect(strong).toHaveTextContent("bold code and linked text");
    expect(strong.querySelector("code")).toHaveTextContent("code");
    expect(strong.querySelector("a")).toHaveAttribute("href", "/learn");
    expect(strong.textContent).not.toContain("**");
  });

  it("renders every canonical player-guide emphasis span and preserves block markup", () => {
    const markdown = readFileSync(resolve(process.cwd(), "docs/learn/player-guide.md"), "utf8");
    const blocks = renderMarkdown(markdown);
    render(<>{blocks.map((block, index) => {
      if (block.kind === "code") return <pre key={index}><code>{block.text}</code></pre>;
      if (block.kind === "ul") return <ul key={index}>{(JSON.parse(block.text) as string[]).map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
      if (block.kind === "table") return <table key={index}><tbody>{(JSON.parse(block.text) as string[]).map((row, rowIndex) => <tr key={rowIndex}>{row.split("|").slice(1, -1).map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>)}</tbody></table>;
      return <p key={index}>{renderInline(block.text)}</p>;
    })}</>);
    expect(document.querySelectorAll("strong")).toHaveLength(15);
    expect(document.querySelector("pre code")).toBeInTheDocument();
    expect(document.querySelector("a[href]")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\*\*[^*]+\*\*/);
    cleanup();
    const developer = readFileSync(resolve(process.cwd(), "docs/learn/developer-reference.md"), "utf8");
    const developerBlocks = renderMarkdown(developer);
    render(<>{developerBlocks.map((block, index) => {
      if (block.kind === "code") return <pre key={index}><code>{block.text}</code></pre>;
      if (block.kind === "table") return <table key={index}><tbody>{(JSON.parse(block.text) as string[]).map((row, rowIndex) => <tr key={rowIndex}>{row.split("|").slice(1, -1).map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>)}</tbody></table>;
      return <p key={index}>{renderInline(block.text)}</p>;
    })}</>);
    expect(document.querySelector("table")).toBeInTheDocument();
    expect(document.querySelector("pre code")).toBeInTheDocument();
    expect(document.querySelector("a[href]")).toBeInTheDocument();
  });

  it("keeps code literal and refuses unsafe links and HTML interpretation", () => {
    render(<p>{renderInline("`**literal** <img src=x>` [unsafe](javascript:alert(1)) <img src=x>")}</p>);
    expect(screen.getByText("**literal** <img src=x>")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.body.textContent).toContain("unsafe");
    expect(document.querySelector("a")).toBeNull();
  });
});
