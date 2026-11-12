// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { NOT_STARTED_PREVIEW, NOT_STARTED_SUBLINE, NOT_STARTED_TITLE, NotStartedChips, previewOf } from "./NotStartedHere";

afterEach(cleanup);

describe("NotStartedChips", () => {
  it("shows one text chip per Corner, each a link to the Corner page", () => {
    render(
      <MemoryRouter>
        <NotStartedChips
          label={NOT_STARTED_TITLE}
          corners={[
            { spaceSlug: "sports-fitness", slug: "acroyoga", name: "Acroyoga" },
            { spaceSlug: "art-creative", slug: "puppetry", name: "Puppetry" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("list", { name: "Not started here yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acroyoga" }).getAttribute("href")).toBe("/corners/acroyoga");
    expect(screen.getByRole("link", { name: "Puppetry" }).getAttribute("href")).toBe("/corners/puppetry");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses the proposed copy", () => {
    expect(NOT_STARTED_TITLE).toBe("Not started here yet");
    expect(NOT_STARTED_SUBLINE).toBe("Tap one to be the first.");
  });

  it("shows only the first few chips of a group on /corners, in the order given", () => {
    const many = Array.from({ length: NOT_STARTED_PREVIEW + 4 }, (_, i) => i);
    expect(previewOf(many)).toEqual(many.slice(0, NOT_STARTED_PREVIEW));
    expect(previewOf([1, 2])).toEqual([1, 2]);
  });
});
