import { describe, expect, it } from "vitest";
import { findExtInText } from "~/utils/links";

describe("findExtInText", () => {
  it("finds a known extension in a path", () => {
    expect(findExtInText("/user/repo/blob/main/1abc.pdb")).toBe("pdb");
  });

  it("returns null when there is no known extension", () => {
    expect(findExtInText("/user/repo/blob/main/readme.txt")).toBeNull();
  });
});
