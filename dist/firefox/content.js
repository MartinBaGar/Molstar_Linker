"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content.ts
  var require_content = __commonJS({
    "src/content.ts"() {
      var SUPPORTED_EXT = /* @__PURE__ */ new Set([
        ".pdb",
        ".cif",
        ".mmcif",
        ".bcif",
        ".gro",
        ".mol",
        ".mol2",
        ".sdf",
        ".xyz",
        ".ent"
      ]);
      var MAX_URL_LENGTH = 2048;
      var GITLAB_PATTERN = /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/;
      function buildGitlabApiUrl(domain, ns, ref, fp) {
        return `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`;
      }
      var GIT_UI_PATHS = [
        "/blame/",
        "/commits/",
        "/commit/",
        "/edit/",
        "/tree/",
        "/network/",
        "/compare/"
      ];
      function extractExtFromText(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const ext of SUPPORTED_EXT) {
          if (lower.includes(ext)) return ext;
        }
        return null;
      }
      function extractExtFromUrl(urlStr) {
        for (const ext of SUPPORTED_EXT) {
          if (new RegExp(`\\${ext}(?:[?#&]|$)`, "i").test(urlStr)) return ext;
        }
        return null;
      }
      function getStructureInfo(href, linkElement) {
        if (!href || href.length > MAX_URL_LENGTH) return null;
        let parsed;
        try {
          parsed = new URL(href, window.location.origin);
        } catch {
          return null;
        }
        if (parsed.protocol !== "https:") return null;
        if (parsed.hash) return null;
        const urlNoQuery = parsed.origin + parsed.pathname;
        if (GIT_UI_PATHS.some((p) => urlNoQuery.includes(p))) return null;
        let ext = extractExtFromUrl(parsed.href);
        if (!ext) {
          ext = extractExtFromText(linkElement.textContent);
        }
        if (!ext) {
          const attrStr = [
            linkElement.title,
            linkElement.getAttribute("download"),
            linkElement.getAttribute("data-filename")
          ].join(" ");
          ext = extractExtFromText(attrStr);
        }
        if (!ext) {
          const titled = linkElement.closest("[title]");
          if (titled) ext = extractExtFromText(titled.title);
        }
        if (!ext) {
          const parent = linkElement.parentElement;
          if (parent && (parent.textContent?.length ?? 0) < 500) {
            ext = extractExtFromText(parent.textContent);
          }
        }
        if (!ext) return null;
        const formatStr = ext === ".cif" ? "mmcif" : ext === ".ent" ? "pdb" : ext.slice(1);
        if (urlNoQuery.includes("github.com")) {
          const rawUrl = urlNoQuery.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/").replace("/raw/", "/");
          return { rawUrl, formatStr };
        }
        const glMatch = urlNoQuery.match(GITLAB_PATTERN);
        if (glMatch) {
          return {
            rawUrl: buildGitlabApiUrl(glMatch[1], glMatch[2], glMatch[3], glMatch[4]),
            formatStr
          };
        }
        return { rawUrl: parsed.href, formatStr };
      }
      function makeBadge(rawUrl, formatStr, originalHref) {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.textContent = "M*L";
        badge.dataset.msBadge = "true";
        badge.dataset.originalHref = originalHref;
        const isGitLab = rawUrl.includes("gitlab");
        Object.assign(badge.style, {
          marginLeft: "6px",
          fontSize: "10px",
          border: "none",
          backgroundColor: isGitLab ? "#6a1b9a" : "#2da44e",
          color: "white",
          padding: "2px 6px",
          borderRadius: "3px",
          fontWeight: "bold",
          display: "inline-block",
          verticalAlign: "middle",
          cursor: "pointer",
          lineHeight: "normal"
        });
        const blockEvent = (e) => {
          e.preventDefault();
          e.stopPropagation();
        };
        badge.addEventListener("click", (e) => {
          blockEvent(e);
          if (!rawUrl.startsWith("https://")) return;
          try {
            chrome.runtime.sendMessage({ action: "open_viewer", url: rawUrl, format: formatStr });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes("Extension context invalidated")) {
              alert("Mol* Linker has been updated. Please refresh this page.");
            } else {
              console.error("Mol* Workspace Error:", err);
            }
          }
        });
        badge.addEventListener("mousedown", blockEvent);
        badge.addEventListener("mouseup", blockEvent);
        return badge;
      }
      function injectMolstarLinker() {
        observer.disconnect();
        try {
          document.querySelectorAll("a[href]:not([data-ms-badge])").forEach((a) => {
            if (a.dataset.msProcessed === "true") return;
            if (/^\d+$/.test(a.textContent?.trim() ?? "")) {
              a.dataset.msProcessed = "true";
              return;
            }
            const info = getStructureInfo(a.href, a);
            if (!info) {
              a.dataset.msProcessed = "true";
              return;
            }
            const parent = a.parentNode;
            if (parent && Array.from(parent.children).some(
              (n) => n.dataset.msBadge === "true" && n.dataset.originalHref === a.href
            )) {
              a.dataset.msProcessed = "true";
              return;
            }
            a.dataset.msProcessed = "true";
            a.insertAdjacentElement("afterend", makeBadge(info.rawUrl, info.formatStr, a.href));
          });
        } catch (err) {
          console.warn("Mol* Linker error:", err);
        }
        observer.observe(document.body, { childList: true, subtree: true });
      }
      var debounceTimer = null;
      var observer = new MutationObserver(() => {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(injectMolstarLinker, 500);
      });
      window.addEventListener("unload", () => {
        observer.disconnect();
        if (debounceTimer !== null) clearTimeout(debounceTimer);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      injectMolstarLinker();
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
