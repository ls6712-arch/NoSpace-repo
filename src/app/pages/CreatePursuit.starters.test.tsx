// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ save: vi.fn(async () => {}), user: { id: "owner" } as { id: string } | null }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("../lib/people", () => ({ usePeopleSearch: () => ({ people: [], loading: false }), fetchPerson: vi.fn(async () => null) }));
vi.mock("../lib/pursuitWorkflowStore", async original => ({ ...(await original<typeof import("../lib/pursuitWorkflowStore")>()), createWorkflow: state.save }));
vi.mock("./LegacyCreatePursuit", () => ({ CreatePursuit: () => <p>Legacy form</p>, PersonAvatar: () => null }));
import { CreatePursuit } from "./CreatePursuit";

beforeEach(() => { state.save.mockReset().mockResolvedValue(undefined); state.user = { id: "owner" }; });
afterEach(() => { cleanup(); localStorage.clear(); });
function mount(query: string) {
  render(<MemoryRouter initialEntries={[`/pursuits/new${query}`]}><Routes><Route path="/pursuits/new" element={<CreatePursuit/>}/><Route path="/pursuit/:id" element={<p>Saved Pursuit</p>}/></Routes></MemoryRouter>);
}

it("prefills editable title and steps and saves through the existing creation action only on submit", async () => {
  mount("?template=drawing-pursuit-01");
  expect((screen.getByRole("textbox", { name: "What do you want to do?" }) as HTMLInputElement).value).toBe("Make a small drawing collection");
  const steps = screen.getAllByRole("textbox", { name: "Checklist item" }) as HTMLInputElement[];
  expect(steps[0].value).toBe("Choose 3 subjects: Pick objects or views you can return to without buying anything.");
  expect(steps).toHaveLength(3);
  expect(state.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "What do you want to do?" }), { target: { value: "My pencil drawings" } });
  fireEvent.change(steps[0], { target: { value: "Choose things from my desk" } });
  fireEvent.click(screen.getByRole("button", { name: "Start a Pursuit" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
  const [project, invitees, signedIn] = state.save.mock.calls[0] as unknown as [Record<string, any>, string[], boolean];
  expect(project).toMatchObject({ title: "My pencil drawings", hobbySlug: "art-creative", subHobby: "drawing", shared: false, mode: "solo", ownerId: "owner" });
  expect(project.measure.workflow.items[0].title).toBe("Choose things from my desk");
  expect(project.measure.workflow.items.every((step: { id: string }) => /^[\da-f-]{36}$/i.test(step.id))).toBe(true);
  expect(project.measure.workflow.finishBy).toBeUndefined();
  expect(invitees).toEqual([]); expect(signedIn).toBe(true);
});

it("preserves normal query-prefill and legacy creation instead of treating arbitrary text as a template", () => {
  mount("?template=unknown&title=My+book&target=4");
  expect((screen.getByRole("textbox", { name: "What do you want to do?" }) as HTMLInputElement).value).toBe("My book");
  expect(screen.queryAllByRole("textbox", { name: "Checklist item" })).toHaveLength(0);
  expect(state.save).not.toHaveBeenCalled();
});

it("keeps creation failures editable for a deliberate retry", async () => {
  state.save.mockRejectedValueOnce(new Error("Could not save"));
  mount("?template=reading-pursuit-01");
  fireEvent.click(screen.getByRole("button", { name: "Start a Pursuit" }));
  await screen.findByRole("alert");
  expect(screen.getAllByRole("textbox", { name: "Checklist item" })).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Start a Pursuit" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));
  expect((state.save.mock.calls[0] as any[])[0].id).toBe((state.save.mock.calls[1] as any[])[0].id);
});

it("hands the selected Corner and edited title to the existing More options form", () => {
  mount("?template=drawing-pursuit-01");
  fireEvent.change(screen.getByRole("textbox", { name: "What do you want to do?" }), { target: { value: "My pencil drawings" } });
  const link = screen.getByRole("link", { name: "More options" });
  const query = new URLSearchParams(link.getAttribute("href")!.split("?")[1]);
  expect(query.get("title")).toBe("My pencil drawings");
  expect(query.get("hobby")).toBe("art-creative");
  expect(query.get("sub")).toBe("drawing");
  expect(query.get("legacy")).toBe("1");
  expect(state.save).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(screen.getByText("Legacy form")).toBeTruthy();
});
