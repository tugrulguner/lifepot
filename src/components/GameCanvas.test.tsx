// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { GameCanvas } from "./GameCanvas";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterEach(cleanup);

test("offers a no-model preset through the existing guided setup", () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  expect(screen.getByTestId("interpreter-source")).toHaveTextContent("Deterministic fallback");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeInTheDocument();
  expect(screen.getByText(/configured species/)).toBeInTheDocument();
});
