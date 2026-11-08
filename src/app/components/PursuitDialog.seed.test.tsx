// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Post } from "../data/posts";

const navigate = vi.fn();
vi.mock("react-router", async (orig) => ({ ...(await orig<typeof import("react-router")>()), useNavigate: () => navigate }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("../context/CornersContext", () => ({ useCorners: () => ({ cornersFor: () => [] }), isDiscoverable: () => true }));

import { PursuitDialog } from "./PursuitDialog";

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

const seed = { id: 42, hobbySlug: "crafts-making", subHobby: "embroidery", caption: "First row done. More soon.", creator: "Maya" } as Post;

describe("PursuitDialog with a seed Moment (Make your version)", () => {
  it("opens the create flow with the Moment it started because of, its Corner, and the title from the first sentence", () => {
    render(<PursuitDialog open onOpenChange={() => {}} seedPost={seed} />);
    expect(navigate).toHaveBeenCalledTimes(1);
    const url = new URL(navigate.mock.calls[0][0] as string, "https://x.test");
    expect(url.pathname).toBe("/pursuits/new");
    expect(url.searchParams.get("from")).toBe("42");
    expect(url.searchParams.get("hobby")).toBe("crafts-making");
    expect(url.searchParams.get("sub")).toBe("embroidery");
    expect(url.searchParams.get("title")).toBe("First row done");
  });
  it("without a seed it opens the plain create flow", () => {
    render(<PursuitDialog open onOpenChange={() => {}} />);
    expect(navigate).toHaveBeenCalledWith("/pursuits/new");
  });
});
