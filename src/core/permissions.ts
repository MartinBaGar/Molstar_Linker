const DOMAIN_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  const wildcard = s.startsWith("*.");
  if (wildcard) s = s.slice(2);
  if (!s.includes("://")) s = `https://${s}`;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname;
  if (!host.includes(".") || host.length > 253 || !DOMAIN_RE.test(host))
    return null;
  return wildcard ? `*.${host}` : host;
}

export const PermissionsManager = {
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
    // Old entries may not be normalized (e.g. "https://github.com"),
    // so the user must always be able to remove them.
    const clean = this.cleanDomain(input);

    try {
      if (clean) {
        const id = this.getScriptId(clean);

        // Rejects if nothing was registered under this id. That's fine:
        // we still want to remove the permission and the stored entry.
        await browser.scripting
          .unregisterContentScripts({ ids: [id] })
          .catch(() => {});

        await browser.permissions.remove({
          origins: [this.getMatchPattern(clean)],
        });
      }

      const data = (await browser.storage.sync.get({
        customDomains: [],
      })) as { customDomains: string[] };
      await browser.storage.sync.set({
        customDomains: data.customDomains.filter(
          (d) => d !== clean && d !== input,
        ),
      });

      return true;
    } catch (err) {
      console.error("Mol* Linker — revoke error:", err);
      return false;
    }
  },
};
