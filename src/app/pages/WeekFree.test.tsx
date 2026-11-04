// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ id: "u1", read: vi.fn(), save: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: state.id }, isConfigured: true }) }));
vi.mock("../lib/tasteRemote", () => ({ fetchTaste: state.read }));
vi.mock("../lib/onboardingRemote", () => ({ savePrivate: state.save }));
import { WeekFree } from "./WeekFree";
const taste = (windows: string[]) => ({ picks: [], windows, budget: null });
const app = () => <MemoryRouter initialEntries={["/week/free?from=week"]}><Routes><Route path="/week/free" element={<WeekFree />} /><Route path="/calendar" element={<p>Calendar destination</p>} /></Routes></MemoryRouter>;
const show = async () => { let view!: ReturnType<typeof render>; await act(async () => { view = render(app()); }); return view; };
beforeEach(() => { state.id = "u1"; state.read.mockReset().mockResolvedValue(taste(["mon-day"])); state.save.mockReset().mockResolvedValue({ error: null }); });
afterEach(cleanup);
it("waits for saved choices before allowing edits or Save", async () => {
  let resolve!: (value: unknown) => void;
  state.read.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  await show();
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Monday daytime, off" }).closest("fieldset")?.disabled).toBe(true);
  await act(async () => { resolve(taste(["thu-eve"])); });
  expect(state.read).toHaveBeenCalledWith("u1", { strict: true });
  expect(screen.getByRole("button", { name: "Thursday evening, on", pressed: true })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
});
it("retries a failed read without saving an invented empty week", async () => {
  state.read.mockRejectedValueOnce(new Error("offline"));
  await show();
  expect(screen.getByRole("alert").textContent).toContain("couldn’t load");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(state.save).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); });
  expect(screen.getByRole("button", { name: "Monday daytime, on", pressed: true })).toBeTruthy();
});
it("saves an explicitly empty week and returns to Calendar", async () => {
  await show();
  fireEvent.click(screen.getByRole("button", { name: "Monday daytime, on" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(state.save).toHaveBeenCalledWith("u1", { free_windows: [] });
  expect(screen.getByText("Calendar destination")).toBeTruthy();
});
it("keeps edits after a failed save so the same selection can be retried", async () => {
  state.save.mockRejectedValueOnce(new Error("offline"));
  await show();
  fireEvent.click(screen.getByRole("button", { name: "Thursday evening, off" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
  expect(screen.getByRole("button", { name: "Thursday evening, on", pressed: true })).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(state.save).toHaveBeenLastCalledWith("u1", { free_windows: ["mon-day", "thu-eve"] });
  expect(screen.getByText("Calendar destination")).toBeTruthy();
});
it("discards the previous account's choices and ignores its late read", async () => {
  let resolve!: (value: unknown) => void;
  state.read.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const view = await show();
  state.id = "u2";
  state.read.mockResolvedValueOnce(taste(["fri-eve"]));
  await act(async () => { view.rerender(app()); });
  await act(async () => { resolve(taste(["mon-day"])); });
  expect(screen.getByRole("button", { name: "Monday daytime, off", pressed: false })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Friday evening, on", pressed: true })).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(state.save).toHaveBeenCalledWith("u2", { free_windows: ["fri-eve"] });
});
