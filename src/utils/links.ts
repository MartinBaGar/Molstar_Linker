import { DataFormatRegistry } from 'molstar/lib/mol-plugin-state/formats/registry';

const _reg = new DataFormatRegistry();

export const ALL_EXTENSIONS = new Set([
    ...Array.from(_reg.extensions),
    ...Array.from(_reg.binaryExtensions),
]);

// One pre-compiled regex, reused everywhere — never rebuilt per link
export const EXT_REGEX = new RegExp(`\\.(${[...ALL_EXTENSIONS].join('|')})(?:[?#&]|$)`, 'i');

export const MAX_URL_LENGTH = 2048; // chars
export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Normalizes a domain (e.g., strips `https://` or `www.`).
 * @param url - The URL or domain to clean.
 * @returns The cleaned domain (e.g., `github.com`).
 */
export function cleanDomain(url: string): string {
    try {
        const parsed = new URL(url.includes('://') ? url : `https://${url}`);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
}

/**
 * Checks if a URL is safe (HTTPS-only, no private IPs, no localhost).
 * @param urlStr - The URL to validate.
 * @returns `true` if the URL is safe.
 */
export function isSafeUrl(urlStr: string): boolean {
    try {
        const { protocol, hostname } = new URL(urlStr);
        if (protocol !== 'https:') return false;

        // Block private/loopback IPs and localhost
        const blockedRanges = [
            /^10\.\d+\.\d+\.\d+$/,
            /^192\.168\.\d+\.\d+$/,
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
            /^169\.254\.\d+\.\d+$/,
            /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
            /^127\.\d+\.\d+\.\d+$/,
            /^\[?::1\]?$/,
            /^\[?fc[0-9a-f]{2}:/i,
            /^localhost$/i,
        ];
        return !blockedRanges.some(r => r.test(hostname));
    } catch {
        return false;
    }
}

/**
 * Extracts a file extension from a URL or text.
 * @param text - The text to search (e.g., URL or link text).
 * @returns The extension (e.g., `"pdb"`) or `null` if none found.
 */
// Searches any string for a supported extension. Returns e.g. "pdb" or null.
export function findExtInText(text: string | null | undefined): string | null {
    if (!text) return null;
    const m = text.match(EXT_REGEX);
    return m ? m[1].toLowerCase() : null;
}

/**
 * Generates a Chrome permission pattern for a domain.
 * @param domain - The domain to allow (e.g., `github.com`).
 * @returns The match pattern (e.g., `*://github.com/*`).
 */
export function getMatchPattern(domain: string): string {
    return `*://${cleanDomain(domain)}/*`;
}

// export function
