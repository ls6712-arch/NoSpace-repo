import { Component, type ReactNode } from "react";

/**
 * Keeps one Discover section's failure to itself: if it throws while rendering,
 * that section is hidden and the rest of the page carries on (never an error
 * screen for the whole page).
 */
export class SectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[Discover] a section failed and was hidden:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
