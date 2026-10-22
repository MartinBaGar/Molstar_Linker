import { isSafeUrl, resolveUrl, findExtInText } from "~/utils/links.js";
import { DOMAIN_RE, PermissionsManager } from "~/core/permissions.js";

if (typeof browser !== "undefined" && !browser.commands) {
  (browser as any).commands = {
    onCommand: { addListener: () => {} },
  };
}

// Format hints are file extensions ("pdb", "cif", "unknown"…), nothing else.
const FORMAT_RE = /^[a-z0-9]{0,16}$/i;

export default defineBackground(() => {
  // ---------------------------------------------------------------------------
  // FEATURE 1: Context menu — "Open in Mol* Viewer"
  // ---------------------------------------------------------------------------

  if (browser.contextMenus) {
    browser.runtime.onInstalled.addListener(() => {
      browser.contextMenus.create({
        id: "open-molstar",
        title: "Open in Mol* Viewer",
        contexts: ["link"],
      });
    });

    browser.contextMenus.onClicked.addListener((info: any, _tab: any) => {
      if (info.menuItemId !== "open-molstar" || !info.linkUrl) return;

      if (!isSafeUrl(info.linkUrl)) {
        console.warn(
          "Mol* Linker: blocked unsafe context-menu URL:",
          info.linkUrl,
        );
        return;
      }

      const extension = findExtInText(info.linkUrl) || "unknown";
      const url = new URL(info.linkUrl);
      const resolvedUrl = resolveUrl(url);
      if (!isSafeUrl(resolvedUrl)) return;

      const viewerUrl = new URL(browser.runtime.getURL("/viewer.html"));
      viewerUrl.searchParams.append("fileUrl", resolvedUrl);
      viewerUrl.searchParams.append("format", extension);

      browser.tabs.create({ url: viewerUrl.toString() });
    });
  }

  // ---------------------------------------------------------------------------
  // FEATURE 2: Message router — handles "open_viewer" from content scripts
  // ---------------------------------------------------------------------------
  browser.runtime.onMessage.addListener((message: any, sender: any) => {
    if (message?.action !== "open_viewer") return;

    // Must come from a real tab of this extension
    if (!sender?.tab?.id || sender.id !== browser.runtime.id) return;

    // Validate URL and format before building the viewer URL.
    // (The viewer re-validates both; this is defense in depth.)
    if (typeof message.url !== "string" || !isSafeUrl(message.url)) return;
    const format = typeof message.format === "string" ? message.format : "";
    if (!FORMAT_RE.test(format)) return;

    const viewerUrl = new URL(browser.runtime.getURL("/viewer.html"));
    viewerUrl.searchParams.append("fileUrl", message.url);
    viewerUrl.searchParams.append("format", format);

    browser.tabs.create({ url: viewerUrl.toString() });
  });

  // --- HELPER 1: Register script for future page loads ---
  async function registerScriptForDomain(
    domain: string,
    pattern: string,
  ): Promise<void> {
    const id = PermissionsManager.getScriptId(domain);

    try {
      if (browser.scripting?.registerContentScripts) {
        // Chrome MV3 Path
        const existing = await browser.scripting.getRegisteredContentScripts({
          ids: [id],
        });
        if (existing.length === 0) {
          await browser.scripting.registerContentScripts([
            {
              id,
              matches: [pattern],
              js: ["content-scripts/content.js"],
              runAt: "document_end",
            },
          ]);
        }
      } else if ((browser as any).contentScripts?.register) {
        // Firefox MV2 Path
        await (browser as any).contentScripts.register({
          matches: [pattern],
          js: [{ file: "content-scripts/content.js" }],
          runAt: "document_end",
        });
      }
    } catch (err) {
      console.warn(
        `Mol* Linker — failed to register script for ${domain}:`,
        err,
      );
    }
  }

  // --- HELPER 2: Inject script into already open tabs (no refresh needed) ---
  async function injectScriptIntoExistingTabs(pattern: string): Promise<void> {
    try {
      const tabs = await browser.tabs.query({ url: pattern });
      for (const tab of tabs) {
        if (!tab.id) continue;
        if (browser.scripting?.executeScript) {
          await browser.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ["/content-scripts/content.js"],
            })
            .catch(() => {});
        } else {
          await (browser.tabs as any)
            .executeScript(tab.id, { file: "content-scripts/content.js" })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn(
        `Mol* Linker — failed to inject into active tabs for ${pattern}:`,
        err,
      );
    }
  }

  // ===========================================================================
  // SCENARIO 1: Browser Startup / Extension Update
  // ===========================================================================
  browser.runtime.onStartup.addListener(reRegisterCustomDomains);
  browser.runtime.onInstalled.addListener(reRegisterCustomDomains);

  async function reRegisterCustomDomains(): Promise<void> {
    const data = (await browser.storage.sync.get({ customDomains: [] })) as {
      customDomains: string[];
    };

    for (const domain of data.customDomains) {
      if (typeof domain !== "string" || !DOMAIN_RE.test(domain)) continue;
      const pattern = `*://${domain}/*`;
      // Just register for future loads (no need to active-inject on startup)
      await registerScriptForDomain(domain, pattern);
    }
  }

  // ===========================================================================
  // SCENARIO 2: User Authorizes a New Domain via Popup
  // ===========================================================================
  browser.permissions.onAdded.addListener(async (permissions) => {
    if (!permissions.origins) return;

    for (const origin of permissions.origins) {
      const domain = origin.replace(/^\*:\/\//, "").replace(/\/\*$/, "");
      // Skips "*" / <all_urls>: we never auto-inject into every website.
      if (!domain || !DOMAIN_RE.test(domain)) continue;

      try {
        // 1. Save to storage so the startup script remembers it next time
        const data = (await browser.storage.sync.get({
          customDomains: [],
        })) as {
          customDomains: string[];
        };
        if (!data.customDomains.includes(domain)) {
          data.customDomains.push(domain);
          await browser.storage.sync.set({ customDomains: data.customDomains });
        }

        // 2. Register for future loads
        await registerScriptForDomain(domain, origin);

        // 3. Inject NOW so badges appear immediately without refreshing
        await injectScriptIntoExistingTabs(origin);
      } catch (err) {
        console.error(
          "Mol* Linker — Background permission injection failed:",
          err,
        );
      }
    }
  });
});
