// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDEAS_EMPTY_LINE, IDEAS_LOOSEN_LINK, IdeasRow } from "./IdeasRow";

afterEach(cleanup);

describe("IdeasRow empty state", () => {
  it("says Nothing fits that mix yet and offers Show more ideas, which loosens Spend", () => {
    const onLoosen = vi.fn();
    render(
      <MemoryRouter>
        <IdeasRow ideas={[]} passTagFor={() => null} onShown={() => {}} onOpen={() => {}} onLoosen={onLoosen} />
      </MemoryRouter>,
    );
    expect(IDEAS_EMPTY_LINE).toBe("Nothing fits that mix yet");
    expect(IDEAS_LOOSEN_LINK).toBe("Show more ideas");
    expect(screen.getByText("Nothing fits that mix yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more ideas" }));
    expect(onLoosen).toHaveBeenCalledTimes(1);
  });
});
