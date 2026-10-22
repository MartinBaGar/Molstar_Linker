import { EXT_REGEX, TEXT_EXT_REGEX } from "~/core/extensions.js";
export const GITLAB_URL_RE =
  /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/;

export const MAX_URL_LENGTH = 2048; // chars

// Real molecular structure files are almost never above 500 MB.
// A huge file could crash the browser tab and be used as a denial-of-service vector.
export const MAX_BYTES = 1000 * 1024 * 1024; // 1000 MB

// HTTP is allowed only in development builds.
// In production, plain HTTP allows man-in-the-middle attacks: a network
// attacker could silently replace the structure file in transit.
// import.meta.env.DEV is replaced at build time, so the unused branch is
// tree-shaken out of the production bundle.
const ALLOWED_PROTOCOLS = new Set(
  import.meta.env.DEV ? ["https:", "http:"] : ["https:"],
);

// Tested against URL.hostname, which the URL parser has already canonicalised:
// 2130706433, 0x7f.1 and 0177.0.0.1 all arrive as 127.0.0.1, and IPv6 arrives
// in brackets, lowercase and compressed.
const BLOCKED_HOSTS: RegExp[] = [
  // --- IPv4 ---
  /^0\.\d+\.\d+\.\d+$/, // "this network"; 0.0.0.0 reaches localhost on Linux/macOS
  /^10\.\d+\.\d+\.\d+$/, // private
  /^127\.\d+\.\d+\.\d+$/, // loopback
  /^169\.254\.\d+\.\d+$/, // link-local
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // private
  /^192\.168\.\d+\.\d+$/, // private
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/, // CGNAT
  /^(22[4-9]|2[3-5]\d)\.\d+\.\d+\.\d+$/, // multicast / reserved

  // --- IPv6 ---
  /^\[::/, // ::, ::1, ::ffff:x (IPv4-mapped), IPv4-compatible
  /^\[f[cd][0-9a-f]{2}:/i, // ULA fc00::/7
  /^\[fe[89ab][0-9a-f]:/i, // link-local fe80::/10
  /^\[64:ff9b:/i, // NAT64
  /^\[2002:/i, // 6to4 (embeds an IPv4 address)
  /^\[2001:0:/i, // Teredo

  // --- Names ---
  /(^|\.)localhost\.?$/i, // localhost, localhost., x.localhost
  /\.(local|localdomain|internal|lan|home\.arpa)\.?$/i,
];

/**
 * Normalizes a domain (e.g., strips `https://` or `www.`).
 * Kept for compatibility; PermissionsManager.cleanDomain is the newer one.
 */
export function cleanDomain(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/**
 * Checks if a URL is safe: HTTPS only in production, no credentials, no
 * private/loopback/internal hosts.
 * This is defense in depth. It cannot detect public names that resolve to
 * private addresses; CORS and host permissions are the other protections.
 */
export function isSafeUrl(urlStr: string): boolean {
  if (typeof urlStr !== "string" || urlStr.length > MAX_URL_LENGTH)
    return false;

  try {
    const u = new URL(urlStr);

    if (!ALLOWED_PROTOCOLS.has(u.protocol) || !u.hostname) return false;
    if (u.username || u.password) return false;

    const host = u.hostname;

    // Single-label names ("intranet", "router") are never public sites.
    if (!host.includes(".") && !host.startsWith("[")) return false;

    return !BLOCKED_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

/**
 * Extracts a file extension from a URL or text.
 */
export function findExtInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(EXT_REGEX);
  return m ? m[1].toLowerCase() : null;
}

export function findExtInPageText(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const m = text.match(TEXT_EXT_REGEX);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Generates a permission pattern for a domain (kept for compatibility).
 */
export function getMatchPattern(domain: string): string {
  return `*://${cleanDomain(domain)}/*`;
}

export function resolveUrl(parsed: URL): string {
  if (parsed.hostname === "github.com") {
    const base = parsed.href;
    if (base.includes("/blob/")) {
      return base
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");
    }
    if (base.includes("/raw/")) {
      return base
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/raw/", "/");
    }
    return base.replace("github.com", "raw.githubusercontent.com");
  } else if (parsed.hostname.includes("gitlab")) {
    const base = parsed.href.split("?")[0].split("#")[0];
    const m = GITLAB_URL_RE.exec(base);
    if (!m) return parsed.href;
    const [, , project, ref, filePath] = m;
    return (
      // parsed.host (not the regex capture) so userinfo can never leak in
      `https://${parsed.host}/api/v4/projects/` +
      `${encodeURIComponent(project)}/repository/files/` +
      `${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`
    );
  } else {
    return parsed.href;
  }
}

function fileNameFromUrl(urlStr: string): string | undefined {
  try {
    const u = new URL(urlStr);
    // GitLab API form: .../repository/files/<url-encoded path>/raw
    const gl = /\/repository\/files\/([^/]+)\/raw$/.exec(u.pathname);
    const path = gl ? decodeURIComponent(gl[1]) : u.pathname;
    return path.split("/").pop() || undefined;
  } catch {
    return undefined;
  }
}

export function getFileNameFromBlob(blob: Blob, originalUrl?: string) {
  let shortBlobUrl = URL.createObjectURL(blob);
  let filename: string | undefined;
  if (originalUrl) {
    filename = fileNameFromUrl(originalUrl);
    if (filename) shortBlobUrl += `#${filename}`;
  }
  return { shortBlobUrl, filename };
}
