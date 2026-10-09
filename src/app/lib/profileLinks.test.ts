import { describe, expect, it } from "vitest";
import { normalizeUrl, safeHttpUrl } from "./profileLinks";

describe("safeHttpUrl", () => {
  it("keeps http and https links", () => {
    expect(safeHttpUrl("https://github.com/name")).toBe("https://github.com/name");
    expect(safeHttpUrl("http://example.org/")).toBe("http://example.org/");
  });

  it("rejects script, data and other schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("  JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects empty and unparseable input", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it("never leaves a script scheme looking usable", () => {
    expect(safeHttpUrl(normalizeUrl("javascript:alert(1)"))).toBeNull();
  });
});
