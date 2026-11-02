import { describe, expect, it } from "vitest";
import { normalizeDomain } from "~/core/permissions";

describe("normalizeDomain", () => {
  it.each([
    ["github.com", "github.com"],
    ["https://github.com/user/repo?x=1#top", "github.com"],
    ["GitHub.COM", "github.com"],
    ["github.com:8080", "github.com"],
    ["münchen.de", "xn--mnchen-3ya.de"],
  ])("accepts %j -> %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "https://user:pw@host.com",
    "host .com",
    "*",
    "about:blank",
    "localhost",
    "ftp://example.com",
    "*.*.example.com",
    "*.example.org",
  ])("rejects %j", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });

  it("rejects hostnames longer than 253 characters", () => {
    expect(normalizeDomain("a".repeat(254) + ".com")).toBeNull();
  });

  it.each(["github.com", "münchen.de"])(
    "output of %j is stable when normalized again",
    (input) => {
      const once = normalizeDomain(input);
      expect(once).not.toBeNull();
      expect(normalizeDomain(once ?? "")).toBe(once);
    },
  );
});
