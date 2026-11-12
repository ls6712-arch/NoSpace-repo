import { expect, it, vi } from "vitest";
import { sendFeedback } from "./stubbyAsk";
vi.mock("../../lib/supabase",()=>({supabase:null}));
it("uses the owner-checked RPC for optional reasons without sending private text or an owner id",async()=>{
 const c={rpc:vi.fn().mockResolvedValue({error:null}),from:vi.fn()};
 expect(await sendFeedback(12,"down",c as never,{reason:"price",scope:"request"})).toBe(true);
 expect(c.rpc).toHaveBeenCalledWith("record_stubby_feedback",{pick:12,reaction:"down",reason:"price",scope:"request"});expect(c.from).not.toHaveBeenCalled();
 c.rpc.mockResolvedValue({error:{code:"42501"}});
 expect(await sendFeedback(12,"down",c as never,{reason:"activity",scope:"usual"})).toBe(false);
});
it("rejects invalid temporary scope and preserves old clients",async()=>{
 const c={rpc:vi.fn(),from:vi.fn().mockReturnValue({insert:vi.fn().mockResolvedValue({error:null})})};
 expect(await sendFeedback(12,"down",c as never,{reason:"today",scope:"usual"})).toBe(false);
 expect(c.rpc).not.toHaveBeenCalled();expect(c.from).not.toHaveBeenCalled();
 expect(await sendFeedback(12,"up",c as never)).toBe(true);
});
