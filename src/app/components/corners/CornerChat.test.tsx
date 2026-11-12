// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../lib/heicConversion", () => ({ convertHeicIfNeeded: async (f: File) => f, isHeicFile: () => false }));

import { Composer, PresenceLine, TypingDots } from "./CornerChat";

beforeAll(() => {
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => {};
});
afterEach(cleanup);

const noop = () => {};
const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

describe("Composer", () => {
  it("is disabled while a message is sending", () => {
    render(
      <Composer sending draft="hello" onDraft={noop} pending={[{ id: "1", file: file("a.jpg"), preview: "blob:1" }]} onPick={noop} onRemove={noop} onSend={noop} error={null} />,
    );
    expect((screen.getByLabelText("Message the Corner") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Add a photo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remove attachment" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends only when there are words or a photo", () => {
    const onSend = vi.fn();
    const { rerender } = render(<Composer sending={false} draft="  " onDraft={noop} pending={[]} onPick={noop} onRemove={noop} onSend={onSend} error={null} />);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Composer sending={false} draft="hi" onDraft={noop} pending={[]} onPick={noop} onRemove={noop} onSend={onSend} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("stops offering photos at 4", () => {
    const four = ["1", "2", "3", "4"].map((id) => ({ id, file: file(`${id}.jpg`), preview: `blob:${id}` }));
    render(<Composer sending={false} draft="" onDraft={noop} pending={four} onPick={noop} onRemove={noop} onSend={noop} error={null} />);
    expect((screen.getByRole("button", { name: "Add a photo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets photo previews be removed before sending", async () => {
    function Harness() {
      const [pending, setPending] = useState([
        { id: "1", file: file("a.jpg"), preview: "blob:1" },
        { id: "2", file: file("b.jpg"), preview: "blob:2" },
      ]);
      return <Composer sending={false} draft="" onDraft={noop} pending={pending} onPick={noop} onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))} onSend={noop} error={null} />;
    }
    render(<Harness />);
    expect(screen.getAllByRole("button", { name: "Remove attachment" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove attachment" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Remove attachment" })).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove attachment" })).toBeNull());
  });
});

describe("PresenceLine", () => {
  it("shows nothing when you are alone, and no digits otherwise", () => {
    const { container, rerender } = render(<PresenceLine names={[]} />);
    expect(container.textContent).toBe("");
    rerender(<PresenceLine names={["Maya", "Sam", "Lee", "Priya"]} />);
    expect(screen.getByRole("status").textContent).toBe("Maya, Sam and others are here now");
    expect(screen.getByRole("status").textContent).not.toMatch(/\d/);
  });
});

describe("TypingDots", () => {
  it("shows first names only", () => {
    const { container } = render(<TypingDots names={["Maya", "Sam"]} />);
    expect(container.textContent).toBe("Maya, Sam");
  });
});
