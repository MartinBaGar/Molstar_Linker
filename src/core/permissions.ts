// Hostname we are willing to request access for and register scripts on.
// Optional "*." prefix for subdomains. No scheme, port, path, or bare "*".
export const DOMAIN_RE = /^(\*\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/**
 * Turns user input or a full URL ("https://gitlab.my-lab.org/foo",
 * "*.my-lab.org", ...) into a plain hostname, or null if unacceptable.
 */
export function normalizeDomain(input: string): string | null {
  let s = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!s || /[\s@]/.test(s)) return null;

  s = s.replace(/^(?:\*|[a-z][a-z0-9+.-]*):\/\//, ""); // scheme
  s = s.replace(/[/?#].*$/, ""); // path, query, hash
  s = s.replace(/:\d{1,5}$/, ""); // port (match patterns ignore it)

  let wildcard = false;
  if (s.startsWith("*.")) {
    wildcard = true;
    s = s.slice(2);
  }

  try {
    s = new URL(`https://${s}`).hostname; // lowercases + punycodes IDNs
  } catch {
    return null;
  }

  const result = (wildcard ? "*." : "") + s;
  return result.length <= 253 && DOMAIN_RE.test(result) ? result : null;
}

export const PermissionsManager = {
  // Backwards-compatible: accepts a URL or a hostname.
  // Returns "" when the input is not an acceptable host
  // (about:, moz-extension:, bare "*", ...).
  cleanDomain(url: string): string {
    return normalizeDomain(url) ?? "";
  },

  getMatchPattern(domain: string): string {
    return `*://${this.cleanDomain(domain)}/*`;
  },

  // Must stay stable: Chrome keeps registered scripts across restarts.
  getScriptId(domain: string): string {
    return `ms-script-${this.cleanDomain(domain).replace(/[^a-z0-9]/gi, "-")}`;
  },

  // Must be called directly from a click handler (user gesture).
  // The content script itself is registered by background.ts when it sees
  // permissions.onAdded.
  async requestAndRegister(input: string): Promise<boolean> {
    const domain = this.cleanDomain(input);
    if (!domain) return false;

    try {
      // Keep this the FIRST await so the user gesture is still valid.
      const granted = await browser.permissions.request({
        origins: [this.getMatchPattern(domain)],
      });
      if (!granted) return false;

      const data = (await browser.storage.sync.get({
        customDomains: [],
      })) as { customDomains: string[] };

      if (!data.customDomains.includes(domain)) {
        await browser.storage.sync.set({
          customDomains: [...data.customDomains, domain],
        });
      }
      return true;
    } catch (err) {
      console.error("Mol* Linker — permission error:", err);
      return false;
    }
  },

  async revokeAndUnregister(input: string): Promise<boolean> {
    // Old entries may not be normalized; always let the user remove them.
    const clean = this.cleanDomain(input);
    const domain = clean || input;

    try {
      if (clean) {
        const id = this.getScriptId(clean);

        if (browser.scripting?.unregisterContentScripts) {
          await browser.scripting
            .unregisterContentScripts({ ids: [id] })
            .catch(() => {});
        }

        await browser.permissions.remove({
          origins: [this.getMatchPattern(clean)],
        });
      }

      const data = (await browser.storage.sync.get({
        customDomains: [],
      })) as { customDomains: string[] };
      await browser.storage.sync.set({
        customDomains: data.customDomains.filter((d) => d !== domain),
      });

      return true;
    } catch (err) {
      console.error("Mol* Linker — revoke error:", err);
      return false;
    }
  },
};
