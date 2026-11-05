// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SnapCarousel } from "./SnapCarousel";

vi.mock("../common/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount() {
  render(<MemoryRouter><SnapCarousel items={["Pottery", "Guitar", "Cooking", "Reading"]} getKey={name => name} renderItem={name => <a href={`/corners/${name.toLowerCase()}`}>{name}</a>} name="test.corners" label="Corners"/></MemoryRouter>);
  const carousel = screen.getByRole("group", { name: "Corners" });
  const list = screen.getByRole("list", { name: "Corners" });
  list.style.paddingLeft = "0px";
  Object.defineProperty(list, "offsetLeft", { value: 0 });
  Array.from(list.children).forEach((child, i) => Object.defineProperty(child, "offsetLeft", { value: i * 220 }));
  const scroll = vi.fn(({ left }: ScrollToOptions) => {
    list.scrollLeft = left ?? 0;
    fireEvent.scroll(list);
  });
  Object.defineProperty(list, "scrollTo", { value: scroll });
  return { carousel, list, scroll };
}

it("keeps advancing with arrow keys when dots are off, including after pointer scrolling", () => {
  const { carousel, list, scroll } = mount();
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 220, behavior: "auto" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 440, behavior: "auto" });
  list.scrollLeft = 660;
  fireEvent.scroll(list);
  fireEvent.keyDown(carousel, { key: "ArrowLeft" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 440, behavior: "auto" });
});

it("supports Home and End without affecting the links or moving beyond the final card", () => {
  const { carousel, scroll } = mount();
  fireEvent.keyDown(carousel, { key: "End" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 660, behavior: "auto" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 660, behavior: "auto" });
  fireEvent.keyDown(carousel, { key: "Home" });
  expect(scroll).toHaveBeenLastCalledWith({ left: 0, behavior: "auto" });
  expect(screen.getByRole("link", { name: "Guitar" }).getAttribute("href")).toBe("/corners/guitar");
});
