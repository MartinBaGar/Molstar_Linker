import { describe, expect, it } from "vitest";
import { isDefaultDomain } from "./domains";

describe("isDefaultDomain", () => {
  it("accepts the exact default domains", () => {
    expect(isDefaultDomain("github.com")).toBe(true);
    expect(isDefaultDomain("zenodo.org")).toBe(true);
  });

  it("accepts subdomains", () => {
    expect(isDefaultDomain("gist.github.com")).toBe(true);
  });

  it("ignores case", () => {
    expect(isDefaultDomain("GitHub.com")).toBe(true);
  });

  it("rejects lookalike hosts", () => {
    expect(isDefaultDomain("github.com.evil.io")).toBe(false);
    expect(isDefaultDomain("notgithub.com")).toBe(false);
  });

  it("rejects unrelated hosts", () => {
    expect(isDefaultDomain("codeberg.org")).toBe(false);
  });
});
