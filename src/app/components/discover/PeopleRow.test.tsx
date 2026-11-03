// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Post } from "../../data/posts";

const peopleByIds = vi.fn(async (ids: string[]) =>
  ids.map((id) => ({ id, username: id, displayName: `Name ${id}`, hobbyKeys: [], postCount: 1 })),
);
vi.mock("../../lib/people", async (real) => ({ ...(await real<typeof import("../../lib/people")>()), peopleByIds: (ids: string[]) => peopleByIds(ids) }));

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const { PeopleRow } = await import("./PeopleRow");

afterEach(() => {
  cleanup();
  peopleByIds.mockClear();
});

const post = (id: number, userId: string, createdAt: number) => ({ id, userId, createdAt }) as unknown as Post;

describe("PeopleRow", () => {
  it("shows each author once, newest first, never the viewer", async () => {
    const posts = [post(1, "a", 1), post(2, "me", 5), post(3, "b", 3), post(4, "a", 4)];
    render(
      <MemoryRouter>
        <PeopleRow posts={posts} viewerId="me" heading={<h2>People near you</h2>} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Name a")).toBeTruthy());
    expect(peopleByIds).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.queryByText("Name me")).toBeNull();
  });

  it("leaves the whole section out with nobody to show", () => {
    const { container } = render(
      <MemoryRouter>
        <PeopleRow posts={[post(1, "me", 1)]} viewerId="me" heading={<h2>People near you</h2>} />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe("");
    expect(peopleByIds).not.toHaveBeenCalled();
  });
});
