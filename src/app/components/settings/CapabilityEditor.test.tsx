// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CapabilityEditor } from "./CapabilityEditor";
import { emptyCapability } from "../../lib/capabilityProfile";
const remote = vi.hoisted(() => ({ fetchCapability: vi.fn(), saveCapability: vi.fn(), deleteCapability: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "alice", is_anonymous: false } }) }));
vi.mock("../../lib/capabilityProfileRemote", () => remote);
vi.mock("../../lib/tasteRemote", () => ({ fetchTaste: async () => ({ picks: [], windows: [], budget: null }), fetchPasses: async () => [] }));
beforeEach(() => { vi.clearAllMocks(); remote.fetchCapability.mockResolvedValue(emptyCapability()); remote.saveCapability.mockResolvedValue(undefined); remote.deleteCapability.mockResolvedValue(undefined); });
afterEach(cleanup);
const show = async () => { render(<MemoryRouter><CapabilityEditor /></MemoryRouter>); fireEvent.click(screen.getByText("What Stubby knows")); await screen.findByText("Use my saved information"); };
it("makes consent optional and saves edited resources without auto-learning", async () => {
  await show(); const consent = screen.getByLabelText("Use my saved information") as HTMLInputElement;
  expect(consent.checked).toBe(false); fireEvent.click(consent);
  fireEvent.change(screen.getByLabelText("Equipment and resources"), { target: { value: "guitar\npaints" } });
  fireEvent.click(screen.getByText("Save changes"));
  await waitFor(() => expect(remote.saveCapability).toHaveBeenCalledWith(expect.objectContaining({ equipment: ["guitar", "paints"], consent: { memory: true, onboarding: false, feedback: false } }), undefined, "alice"));
});
it("asks before deleting and clears only after successful deletion", async () => {
  await show(); fireEvent.click(screen.getByText("Delete saved information"));
  expect(remote.deleteCapability).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Delete", { exact: true }));
  await waitFor(() => expect(remote.deleteCapability).toHaveBeenCalledTimes(1));
  await screen.findByText(/saved information and feedback are deleted/);
});
it("does not overwrite unreadable memory or report a failed save as success", async () => {
  remote.fetchCapability.mockRejectedValue(new Error("offline"));
  render(<MemoryRouter><CapabilityEditor /></MemoryRouter>); fireEvent.click(screen.getByText("What Stubby knows"));
  await screen.findByText(/couldn’t load/); expect(screen.queryByText("Save changes")).toBeNull();
});
