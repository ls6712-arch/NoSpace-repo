// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/SocialContext", () => ({ useSocial: () => ({ isShared: true, markAllRead: vi.fn(), markNotificationsRead: vi.fn(), respond: vi.fn() }) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../lib/useNotificationBadge", () => ({
  useNotificationBadge: () => ({ groups: [], groupedUnread: 0, incoming: [], incomingFollows: [], badgeCount: 0 }),
}));

import { NotificationsMenu } from "./NotificationsMenu";

afterEach(cleanup);

describe("the rail's Notifications menu", () => {
  it("does not close the rail's other panel when it is not the one open", () => {
    // The bug: a press inside the More menu told the rail to close it, so
    // Settings, Theme and Log out never got the tap.
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <NotificationsMenu variant="rail" open={false} onOpenChange={onOpenChange} />
        <button type="button">Settings</button>
      </MemoryRouter>,
    );
    fireEvent.pointerDown(document.body.querySelector("button:last-of-type")!);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on a press outside while it is open", () => {
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <NotificationsMenu variant="rail" open onOpenChange={onOpenChange} />
        <p>Elsewhere</p>
      </MemoryRouter>,
    );
    fireEvent.pointerDown(document.body.querySelector("p:last-of-type")!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
