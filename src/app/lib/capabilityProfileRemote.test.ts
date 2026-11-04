import { expect, it, vi } from "vitest";
import { emptyCapability } from "./capabilityProfile";
import { fetchCapability, saveCapability, deleteCapability } from "./capabilityProfileRemote";
vi.mock("../../lib/supabase", () => ({ supabase: null }));
function client(anonymous = false) {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { profile: emptyCapability() }, error: null })), upsert: vi.fn(async () => ({ error: null })) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "alice", is_anonymous: anonymous } }, error: null })) }, from: vi.fn(() => chain), rpc: vi.fn(async () => ({ error: null })), chain };
}
it("reads and writes only the verified caller, never an id supplied by a form", async () => {
  const c = client(); const sdk = c as unknown as Parameters<typeof fetchCapability>[0];
  await fetchCapability(sdk); expect(c.chain.eq).toHaveBeenCalledWith("user_id", "alice");
  await saveCapability(emptyCapability(), sdk); expect(c.chain.upsert).toHaveBeenCalledWith({ user_id: "alice", profile: emptyCapability() }, { onConflict: "user_id" });
  await deleteCapability(sdk); expect(c.rpc).toHaveBeenCalledWith("forget_stubby_memory", { expected_user: "alice" });
});
it("rejects anonymous memory writes and surfaces database failures", async () => {
  const guest = client(true); await expect(saveCapability(emptyCapability(), guest as never)).rejects.toThrow("Log in"); expect(guest.from).not.toHaveBeenCalled();
  const c = client(); c.chain.upsert.mockResolvedValue({ error: { code: "42501" } } as never);
  await expect(saveCapability(emptyCapability(), c as never)).rejects.toThrow("weren’t saved");
});

it("refuses stale-editor reads, writes and deletes after an account switch", async () => {
  const c = client();
  await expect(fetchCapability(c as never, "bob")).rejects.toThrow("account changed");
  await expect(saveCapability(emptyCapability(), c as never, "bob")).rejects.toThrow("account changed");
  await expect(deleteCapability(c as never, "bob")).rejects.toThrow("account changed");
  expect(c.from).not.toHaveBeenCalled(); expect(c.rpc).not.toHaveBeenCalled();
});
