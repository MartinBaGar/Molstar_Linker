"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/background.ts
  var require_background = __commonJS({
    "src/background.ts"() {
      function isSafeUrl(urlStr) {
        try {
          return new URL(urlStr).protocol === "https:";
        } catch {
          return false;
        }
      }
      var ALLOWED_FORMATS = /* @__PURE__ */ new Set([
        "pdb",
        "cif",
        "mmcif",
        "bcif",
        "gro",
        "mol",
        "mol2",
        "sdf",
        "xyz"
      ]);
      chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
          id: "open-molstar",
          title: "Open in Mol* Workspace",
          contexts: ["link"]
        });
      });
      chrome.contextMenus.onClicked.addListener((info, _tab) => {
        if (info.menuItemId !== "open-molstar" || !info.linkUrl) return;
        if (!isSafeUrl(info.linkUrl)) {
          console.warn("Mol* Linker: blocked unsafe context-menu URL:", info.linkUrl);
          return;
        }
        const viewerUrl = chrome.runtime.getURL(
          `viewer.html?fileUrl=${encodeURIComponent(info.linkUrl)}&format=unknown`
        );
        chrome.tabs.create({ url: viewerUrl });
      });
      chrome.runtime.onMessage.addListener(
        (message, sender) => {
          if (message.action !== "open_viewer") return;
          if (!sender.tab?.id) return;
          if (!message.url || !isSafeUrl(message.url)) return;
          if (!ALLOWED_FORMATS.has(message.format)) return;
          const viewerUrl = chrome.runtime.getURL(
            `viewer.html?fileUrl=${encodeURIComponent(message.url)}&format=${encodeURIComponent(message.format)}`
          );
          chrome.tabs.create({ url: viewerUrl });
        }
      );
      chrome.permissions.onAdded.addListener((permissions) => {
        const origins = permissions.origins ?? [];
        if (origins.length === 0 || !chrome.scripting?.registerContentScripts) return;
        chrome.scripting.registerContentScripts([{
          id: `dynamic-molstar-${Date.now()}`,
          matches: origins,
          js: ["config.js", "content.js"],
          runAt: "document_end"
        }]).catch((err) => console.error("Mol* Linker \u2014 dynamic script registration failed:", err));
      });
    }
  });
  require_background();
})();
//# sourceMappingURL=background.js.map
