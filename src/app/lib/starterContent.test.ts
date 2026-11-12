import { describe, expect, it } from "vitest";
import { starterContentFor, starterPursuit, starterWorkflow, isSafeResourceUrl } from "./starterContent";
import { validateWorkflow } from "./pursuitWorkflow";
import catalog from "../data/starterContent.json";

describe("published starter content", () => {
  it("has distinct activities and a usable Pursuit for all ten reviewed Corners", () => {
    expect(catalog.activities).toHaveLength(30);
    expect(catalog.pursuits).toHaveLength(10);
    expect(catalog.resources).toHaveLength(16);
    expect(new Set(catalog.activities.map(item => item.id)).size).toBe(30);
    for (const pursuit of catalog.pursuits) {
      const [space, slug] = pursuit.corner_key.split("/");
      const content = starterContentFor(space, slug);
      expect(content.activities).toHaveLength(3);
      expect(content.pursuits).toHaveLength(1);
      expect(content.activities.map(item => item.id)).toEqual(pursuit.starting_activity_ids);
      expect(validateWorkflow(starterWorkflow(pursuit))).toBeNull();
      expect(content.activities.every(item => item.cost_note.startsWith("Cost unknown"))).toBe(true);
    }
  });
  it("resolves merged Corners and never fills unrelated or unknown Corners", () => {
    expect(starterContentFor("art-creative", "watercolor").activities).toEqual(starterContentFor("art-creative", "painting").activities);
    expect(starterContentFor("custom", "unknown").activities).toEqual([]);
    expect(starterContentFor("custom", "unknown").resources).toEqual([]);
    expect(starterContentFor("gaming-tabletop", "chess").resources).toEqual([]);
    expect(starterContentFor("books-writing", "reading").resources.some(item => item.name === "Standard Ebooks")).toBe(true);
  });
  it("creates fresh, valid checklist IDs without copying sample progress or identity", () => {
    const template = starterPursuit("drawing-pursuit-01")!;
    const a = starterWorkflow(template), b = starterWorkflow(template);
    expect(a.tracking).toBe("checklist");
    expect(a.items.map(item => item.title)).toEqual(template.milestones.map(item => `${item.title}: ${item.instruction}`));
    expect(a.items.every(item => item.title.length <= 140)).toBe(true);
    for (const item of a.items) expect(item.id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
    expect(a.items.map(item => item.id)).not.toEqual(b.items.map(item => item.id));
    a.items[0].title = "My edited step";
    expect(template.milestones[0].title).not.toBe("My edited step");
    expect(a.finishBy).toBeUndefined();
    expect(a.startingUserId).toBeUndefined();
    expect(starterPursuit("untrusted-id")).toBeUndefined();
  });
  it("allows only credential-free HTTPS resource destinations", () => {
    expect(isSafeResourceUrl("https://standardebooks.org/")).toBe(true);
    for (const value of ["javascript:alert(1)", "data:text/html,hi", "http://example.com", "https://user:password@example.com", "/local"]) expect(isSafeResourceUrl(value)).toBe(false);
  });
});
