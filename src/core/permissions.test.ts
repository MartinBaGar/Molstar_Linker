import { describe, expect, it } from "vitest";
import { normalizeDomain } from "~/core/permissions";

describe("normalizeDomain: accepted input", () => {
  it("keeps a plain hostname", () => {
    expect(normalizeDomain("github.com")).toBe("github.com");
  });

  it("extracts the hostname from a full URL", () => {
    expect(normalizeDomain("https://gitlab.my-lab.org/foo/bar?x=1#top")).toBe(
      "gitlab.my-lab.org",
    );
  });

  it("lowercases", () => {
    expect(normalizeDomain("GitLab.My-Lab.org")).toBe("gitlab.my-lab.org");
  });

  it("drops the port", () => {
    expect(normalizeDomain("https://example.org:8443/x")).toBe("example.org");
  });

  it("keeps a wildcard prefix", () => {
    expect(normalizeDomain("*.my-lab.org")).toBe("*.my-lab.org");
  });

  it("converts international names to punycode", () => {
    expect(normalizeDomain("münchen.de")).toBe("xn--mnchen-3ya.de");
  });
});

describe("normalizeDomain: rejected input", () => {
  it("rejects empty or blank input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("rejects credentials in the URL", () => {
    expect(normalizeDomain("https://user:pw@host.com")).toBeNull();
    expect(normalizeDomain("evil.com#@github.com")).toBeNull();
  });

  it("rejects whitespace inside the name", () => {
    expect(normalizeDomain("a b.com")).toBeNull();
  });

  it("rejects a bare wildcard (that would mean every website)", () => {
    expect(normalizeDomain("*")).toBeNull();
  });

  it("rejects non-web pseudo URLs", () => {
    expect(normalizeDomain("about:blank")).toBeNull();
  });

  it("rejects names over 253 characters", () => {
    expect(normalizeDomain("a".repeat(250) + ".com")).toBeNull();
  });
});
