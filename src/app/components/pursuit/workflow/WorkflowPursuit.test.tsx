// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  getJournal,
  type Project,
  type PursuitMember,
} from "../../../lib/journal";
import {
  emptyWorkflowData,
  type WorkflowData,
} from "../../../lib/pursuitWorkflow";
import { WorkflowPursuit } from "./WorkflowPursuit";
import { compatibleProject } from "../../../lib/pursuitCompatibility";
const state = vi.hoisted(() => ({
  data: {} as WorkflowData,
  members: [] as PursuitMember[],
  search: [] as { id: string; displayName: string }[],
  put: vi.fn(),
  remote: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "owner" },
    profile: { display_name: "Owner" },
    isConfigured: true,
  }),
}));
vi.mock("../../../context/ContentContext", () => ({
  useContent: () => ({ posts: [] }),
}));
vi.mock("../../../context/PrivateLogsContext", () => ({
  usePrivateLogs: () => ({ logs: [] }),
}));
vi.mock("../../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => state.rpc(...args) },
}));
vi.mock("../../../lib/pursuitsRemote", () => ({
  fetchPursuitAsProject: (...args: unknown[]) => state.remote(...args),
}));
vi.mock("../../../lib/usePursuitProgress", () => ({
  usePursuitMembers: () => state.members,
}));
vi.mock("../../../lib/people", () => ({
  usePeopleSearch: () => ({ people: state.search, loading: false }),
}));
vi.mock("../../../lib/pursuitWorkflowStore", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../lib/pursuitWorkflowStore")
  >()),
  useWorkflowData: () => ({
    data: state.data,
    loading: false,
    error: "",
    retry: vi.fn(),
    put: state.put,
  }),
}));
const owner: PursuitMember = {
  userId: "owner",
  displayName: "Owner",
  role: "owner",
  status: "joined",
};
const maya: PursuitMember = {
  userId: "maya",
  displayName: "Maya",
  role: "member",
  status: "joined",
};
function project(patch: Partial<Project> = {}): Project {
  return {
    id: crypto.randomUUID(),
    title: "Mindfulness",
    startedAt: Date.now(),
    ownerId: "owner",
    role: "owner",
    mode: "solo",
    shared: false,
    measure: {
      kind: "count",
      target: 0,
      unit: "",
      allowDecimals: false,
      allowPartial: false,
      defaultAmount: 1,
      startingAmount: 0,
      workflow: { version: 2, tracking: "updates", unit: "", items: [] },
    },
    ...patch,
  };
}
function show(p = project()) {
  state.data.sessions = [
    {
      id: "future",
      pursuit_id: p.id,
      user_id: "owner",
      title: "Next practice",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      place: "",
      note: "",
      cancelled: false,
      series_id: "series",
      timezone: "UTC",
    },
    {
      id: "past",
      pursuit_id: p.id,
      user_id: "owner",
      title: "Previous practice",
      starts_at: new Date(Date.now() - 86400000).toISOString(),
      place: "",
      note: "",
      cancelled: false,
      series_id: "old-series",
      timezone: "UTC",
    },
  ];
  return render(
    <MemoryRouter>
      <WorkflowPursuit project={p} />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.data = emptyWorkflowData();
  state.members = [owner];
  state.search = [];
  state.remote.mockReset().mockResolvedValue(null);
  state.rpc.mockReset().mockResolvedValue({ error: null });
  state.put
    .mockReset()
    .mockImplementation(async (key: string, rows: WorkflowData["sessions"]) => {
      if (key === "sessions")
        state.data.sessions = state.data.sessions.map(
          (s) => rows.find((r) => r.id === s.id) ?? s,
        );
    });
});
afterEach(cleanup);
describe("personal and shared Pursuit session workflow", () => {
  it.each(["solo", undefined] as const)(
    "keeps personal controls when mode is %s, even with public visibility",
    (mode) => {
      show(project({ mode, shared: true }));
      expect(screen.queryByRole("button", { name: "I’m in" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Can’t make it" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Discuss" })).toBeNull();
      expect(screen.queryByText("No one has responded yet.")).toBeNull();
      expect(
        screen.queryByText("Attendance does not log progress automatically."),
      ).toBeNull();
      expect(screen.getByText("Just me")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Invite people" }),
      ).toBeTruthy();
    },
  );
  it("separates past and later sessions from the single next session", () => {
    show();
    const region = screen.getByRole("region", { name: "Next session" });
    expect(
      within(region).getByText("Next practice").closest("details"),
    ).toBeNull();
    const past = within(region)
      .getByText("Previous practice")
      .closest("details");
    expect(past).not.toBeNull();
    expect(past!.open).toBe(false);
    expect(within(region).getByText("Past sessions")).toBeTruthy();
  });
  it("removes only the chosen personal session while preserving its record", async () => {
    show();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove", hidden: false })[0],
    );
    await waitFor(() =>
      expect(state.put).toHaveBeenCalledWith("sessions", [
        expect.objectContaining({ id: "future", cancelled: true }),
      ]),
    );
    await waitFor(() => expect(screen.queryByText("Next practice")).toBeNull());
    expect(state.data.sessions.find((s) => s.id === "past")!.cancelled).toBe(
      false,
    );
    expect(state.data.contributions).toHaveLength(0);
  });
  it("shows personal context when planning a session", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Plan a session" }));
    expect(
      await within(screen.getByRole("dialog")).findByText("Just me"),
    ).toBeTruthy();
  });
  it("requires an invitation before showing group session actions", () => {
    show(project({ mode: "together" }));
    expect(screen.queryByRole("button", { name: "I’m in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discuss" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Plan a session" })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Invite people" }).length,
    ).toBeGreaterThan(0);
  });
  it("shows RSVP and discussion for a private Pursuit explicitly shared with friends", () => {
    state.members = [owner, maya];
    show(project({ mode: "together", shared: false }));
    expect(screen.getByRole("button", { name: "I’m in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Can’t make it" })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Discuss" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Attendance does not log progress automatically."),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
  it("counts declined responses rather than claiming nobody responded", () => {
    state.members = [owner, maya];
    state.data.attendance = [
      { session_id: "future", user_id: "maya", going: false },
    ];
    show(project({ mode: "together" }));
    expect(screen.getByText("Can’t make it: Maya")).toBeTruthy();
    const next = screen.getByText("Next practice").parentElement!;
    expect(within(next).queryByText("No one has responded yet.")).toBeNull();
  });
  it.each([false, true])(
    "makes invitations explicit without changing public visibility, legacy: %s",
    async (legacy) => {
      const raw = project();
      if (legacy) delete raw.measure!.workflow;
      const p = legacy ? compatibleProject(raw) : raw;
      state.search = [{ id: "maya", displayName: "Maya" }];
      show(p);
      fireEvent.click(screen.getByRole("button", { name: "Invite people" }));
      await screen.findByRole("dialog");
      state.remote.mockResolvedValue({
        ...raw,
        mode: "together",
        shared: false,
      });
      state.rpc.mockImplementation(async () => {
        state.members = [owner, { ...maya, status: "invited" }];
        return { error: null };
      });
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: /^Invite$/,
        }),
      );
      await waitFor(() =>
        expect(state.rpc).toHaveBeenCalledWith("invite_pursuit_workflow", {
          p_id: p.id,
          p_user: "maya",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.getByRole("heading", { name: "Friends" })).toBeTruthy();
      expect(screen.getByText("Invited")).toBeTruthy();
      expect(screen.getByRole("button", { name: "I’m in" })).toBeTruthy();
      expect(getJournal().projects.find((x) => x.id === p.id)?.shared).toBe(
        false,
      );
      expect(state.rpc).toHaveBeenCalledTimes(1);
    },
  );
});
