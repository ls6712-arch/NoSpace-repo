import { beforeEach, expect, it, vi } from "vitest";
import { emptyPersonalization } from "./personalization";
import { readPersonalization, savePersonalization } from "./personalizationRemote";
vi.mock("../../lib/supabase", () => ({ supabase: null }));
function client() {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { personalization: emptyPersonalization(), revision: 2 }, error: null })) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "alice", is_anonymous: false } }, error: null })) }, from: vi.fn(() => query), query,
    rpc: vi.fn(async () => ({ data: { value: emptyPersonalization(), revision: 3 }, error: null })) };
}
beforeEach(vi.clearAllMocks);
it("distinguishes missing from unavailable and invalid data", async () => {
  const c=client(); expect((await readPersonalization("alice", c as never)).status).toBe("ready");
  c.query.maybeSingle.mockResolvedValueOnce({ data:null,error:null } as never);
  expect((await readPersonalization("alice",c as never)).status).toBe("missing");
  c.query.maybeSingle.mockResolvedValueOnce({ data:null,error:{code:"PGRST204"} } as never);
  expect((await readPersonalization("alice",c as never)).status).toBe("unavailable");
  c.query.maybeSingle.mockResolvedValueOnce({ data:{personalization:{version:99},revision:2},error:null } as never);
  expect((await readPersonalization("alice",c as never)).status).toBe("invalid");
});
it("refuses stale-account reads and writes before contacting storage", async () => {
  const c=client(); expect((await readPersonalization("bob",c as never)).status).toBe("unavailable");
  await expect(savePersonalization("bob",2,{motivations:["make"]},c as never)).rejects.toThrow("account changed");
  expect(c.from).not.toHaveBeenCalled(); expect(c.rpc).not.toHaveBeenCalled();
});
it("sends partial revision-checked edits and surfaces a concurrent save", async () => {
  const c=client(); await savePersonalization("alice",2,{motivations:["make"]},c as never);
  expect(c.rpc).toHaveBeenCalledWith("save_personalization",{expected_user:"alice",expected_revision:2,changes:{motivations:["make"]}});
  c.rpc.mockResolvedValueOnce({data:null,error:{code:"40001"}} as never);
  await expect(savePersonalization("alice",2,{rhythm:[]},c as never)).rejects.toThrow("changed elsewhere");
});
