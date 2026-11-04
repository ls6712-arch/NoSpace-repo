// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HumanQuestion } from "./HumanPreferences";
import { emptyPersonalization } from "../../../lib/personalization";
import { emptyCapability } from "../../../lib/capabilityProfile";
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),next:vi.fn(),user:{id:"alice"}}));
vi.mock("../../../context/AuthContext",()=>({useAuth:()=>({user:mocks.user})}));
vi.mock("../OnboardingContext",()=>({useOnboarding:()=>({next:mocks.next})}));
vi.mock("../../../lib/personalizationRemote",()=>({readPreferenceBundle:(...args:unknown[])=>mocks.read(...args),savePersonalization:(...args:unknown[])=>mocks.save(...args)}));
vi.mock("../../../lib/tasteRemote",()=>({EMPTY_TASTE:{picks:[],windows:[],budget:null},fetchTaste:async()=>({picks:[],windows:[],budget:null}),fetchPasses:async()=>[]}));
afterEach(cleanup);
beforeEach(()=>{
 vi.clearAllMocks();mocks.user={id:"alice"};
 mocks.read.mockResolvedValue({value:emptyPersonalization(),capability:emptyCapability(),revision:4});
 mocks.save.mockResolvedValue({value:emptyPersonalization(),revision:5});
});
it("allows one interest and sends its real relationship and experience",async()=>{
 render(<HumanQuestion question="interests"/>);
 await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.change(screen.getByLabelText("Find an interest"),{target:{value:"guitar"}});
 fireEvent.click(screen.getByRole("button",{name:"Guitar"}));
 fireEvent.change(screen.getByLabelText("How does this fit you?"),{target:{value:"returning"}});
 fireEvent.click(screen.getByLabelText("I’m new to this"));
 fireEvent.click(screen.getByRole("button",{name:"Next"}));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith("alice",4,{interests:[{key:"music/guitar",relationship:"returning",experience:"beginner"}]}));
 await waitFor(()=>expect(mocks.next).toHaveBeenCalled());
});
it("Skip preserves saved answers without making a write",async()=>{
 mocks.read.mockResolvedValue({value:{...emptyPersonalization(),motivations:["make"]},capability:emptyCapability(),revision:4});
 render(<HumanQuestion question="motivations"/>);
 await screen.findByRole("button",{name:"Making something"});
 fireEvent.click(screen.getByRole("button",{name:"Skip for now"}));
 expect(mocks.save).not.toHaveBeenCalled();expect(mocks.next).toHaveBeenCalledWith({reaction:"shrug"});
});
it("keeps failed reads visible and disables saving instead of writing empty values",async()=>{
 mocks.read.mockRejectedValue(new Error("Offline"));
 render(<HumanQuestion question="rhythm"/>);
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","Offline");
 expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(true);
 expect(mocks.save).not.toHaveBeenCalled();
});
it("retains the draft when a stale save fails and does not advance",async()=>{
 mocks.save.mockRejectedValue(new Error("Your preferences changed elsewhere. Reload before saving."));
 render(<HumanQuestion question="motivations"/>);
 await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole("button",{name:"Making something"}));fireEvent.click(screen.getByRole("button",{name:"Next"}));
 expect(await screen.findByRole("alert")).toHaveProperty("textContent",expect.stringContaining("changed elsewhere"));
 expect(screen.getByRole("button",{name:"Making something"}).getAttribute("aria-pressed")).toBe("true");expect(mocks.next).not.toHaveBeenCalled();
});
it("does not apply a late response after an account changes",async()=>{
 let done!:(v:unknown)=>void;mocks.read.mockReturnValueOnce(new Promise(r=>{done=r;}));
 const view=render(<HumanQuestion question="motivations"/>);
 mocks.user={id:"bob"};view.rerender(<HumanQuestion question="motivations"/>);
 await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
 await act(async()=>done({value:{...emptyPersonalization(),motivations:["make"]},capability:emptyCapability(),revision:4}));
 expect(screen.getByRole("button",{name:"Making something"}).getAttribute("aria-pressed")).toBe("false");
});
