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

describe("isSafeUrl", () => {
  it.each([
    "https://github.com/user/repo/file.pdb",
    "https://raw.githubusercontent.com/user/repo/main/a.cif",
    "https://github.com.evil.io/a.pdb", // public host, so allowed
    "https://172.15.255.255/a.pdb", // just below the private range
    "https://172.32.0.1/a.pdb", // just above the private range
    "https://[2606:4700:4700::1111]/a.pdb", // public IPv6
  ])("accepts %j", (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    "",
    "not a url",
    "ftp://example.com/a.pdb",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pw@example.com/a.pdb",
    "https://localhost/a.pdb",
    "https://app.localhost/a.pdb",
    "https://intranet/a.pdb",
    "https://printer.local/a.pdb",
    "https://db.internal/a.pdb",
    "https://127.0.0.1/a.pdb",
    "https://2130706433/a.pdb", // 127.0.0.1 as one integer
    "https://0x7f.1/a.pdb", // 127.0.0.1 in hex
    "https://0.0.0.0/a.pdb",
    "https://10.0.0.1/a.pdb",
    "https://172.16.0.1/a.pdb",
    "https://192.168.1.1/a.pdb",
    "https://169.254.169.254/a.pdb", // cloud metadata address
    "https://100.64.0.1/a.pdb", // CGNAT
    "https://[::1]/a.pdb",
    "https://[::ffff:127.0.0.1]/a.pdb", // IPv4-mapped IPv6
    "https://[fd00::1]/a.pdb",
    "https://[fe80::1]/a.pdb",
    "http://127.0.0.1/a.pdb", // blocked host, whatever the mode
  ])("rejects %j", (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it("rejects URLs longer than 2048 characters", () => {
    expect(isSafeUrl("https://example.com/" + "a".repeat(2048))).toBe(false);
  });

  it("allows plain http only in dev builds", () => {
    expect(isSafeUrl("http://example.com/a.pdb")).toBe(import.meta.env.DEV);
  });
});

describe("resolveUrl", () => {
  it.each([
    // GitHub: blob and raw pages -> raw.githubusercontent.com
    [
      "https://github.com/user/repo/blob/main/a.pdb",
      "https://raw.githubusercontent.com/user/repo/main/a.pdb",
    ],
    [
      "https://github.com/user/repo/raw/main/a.pdb",
      "https://raw.githubusercontent.com/user/repo/main/a.pdb",
    ],
    // GitLab: file page -> API URL
    [
      "https://gitlab.com/group/proj/-/blob/main/dir/a.pdb",
      "https://gitlab.com/api/v4/projects/group%2Fproj/repository/files/dir%2Fa.pdb/raw?ref=main",
    ],
    // Other hosts are left alone
    ["https://example.org/data/a.pdb", "https://example.org/data/a.pdb"],
  ])("rewrites %j", (input, expected) => {
    expect(resolveUrl(new URL(input))).toBe(expected);
  });

  it.each([
    [
      "https://github.com/blob/repo/blob/main/a.pdb", // user named "blob"
      "https://raw.githubusercontent.com/blob/repo/main/a.pdb",
    ],
    [
      "https://github.com/user/repo/raw/main/blob/a.pdb", // folder named "blob"
      "https://raw.githubusercontent.com/user/repo/main/blob/a.pdb",
    ],
  ])("keeps names that look like path markers: %j", (input, expected) => {
    expect(resolveUrl(new URL(input))).toBe(expected);
  });

  it.each([
    [
      "https://git.my-lab.org/group/proj/-/blob/main/a.pdb", // self-hosted
      "https://git.my-lab.org/api/v4/projects/group%2Fproj/repository/files/a.pdb/raw?ref=main",
    ],
    [
      "https://gitlab.com/group/proj/-/blob/main/a.pdb?ref_type=heads", // query string GitLab adds
      "https://gitlab.com/api/v4/projects/group%2Fproj/repository/files/a.pdb/raw?ref=main",
    ],
    [
      "https://example.org/a/-/b", // not a file URL, left alone
      "https://example.org/a/-/b",
    ],
  ])("handles GitLab-style URL %j", (input, expected) => {
    expect(resolveUrl(new URL(input))).toBe(expected);
  });
});
