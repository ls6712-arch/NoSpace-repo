// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTypingTarget } from "./searchShortcut";

describe("isTypingTarget", () => {
  it("is true in a field, a text area, a select and editable text, so \"/\" is just a character there", () => {
    for (const tag of ["input", "textarea", "select"]) expect(isTypingTarget(document.createElement(tag))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    const box = document.createElement("div");
    box.setAttribute("role", "searchbox");
    const inner = document.createElement("span");
    box.appendChild(inner);
    expect(isTypingTarget(inner)).toBe(true);
  });

  it("is false on a page, a button or a link, so \"/\" opens search there", () => {
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.createElement("a"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
