import { ALL_EXTENSIONS } from "virtual:molstar-extensions";
import {
  findExtInText,
  findExtInPageText,
  isSafeUrl,
  MAX_URL_LENGTH,
  resolveUrl,
} from "~/utils/links";

// ==========================================
// 1. DEFINITIONS (Safe for Node.js to read)
// ==========================================

const PROCESSED = "data-ms-processed";
const BADGE_CLASS = "ms-badge";

// Badge data lives here, not in the DOM: page scripts can edit data-* attributes
// and create lookalike buttons, but they cannot reach this map.
const BADGE_DATA = new WeakMap<
  HTMLButtonElement,
  { rawUrl: string; format: string }
>();

interface SiteAdapter {
  matches(hostname: string): boolean;
  getSelector(): string;
  shouldIgnore(element: HTMLElement, parsed: URL | null): boolean;
  findExt(element: HTMLElement, parsed: URL | null): string | null;
  resolveUrl(element: HTMLElement, parsed: URL | null): string | null;
  getPlacement(element: HTMLElement): InsertPosition;
}

// --- STANDARD ADAPTERS (Look for a[href]) ---

const GitHubAdapter: SiteAdapter = {
  matches: (hostname) =>
    hostname === "github.com" || hostname.endsWith(".github.com"),
  getSelector: () => "a[href]",
  shouldIgnore: (element, _parsed) => {
    const isFileTreeLink = element.classList.contains("Link--primary");
    const isRawButton = element.dataset.testid === "raw-button";
    return !isFileTreeLink && !isRawButton;
  },
  findExt: (_element, parsed) =>
    parsed
      ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search))
      : null,
  resolveUrl: (_element, parsed) => (parsed ? resolveUrl(parsed) : null),
  getPlacement: (element) =>
    element.dataset.testid === "raw-button" ? "beforebegin" : "afterend",
};

const GitLabAdapter: SiteAdapter = {
  matches: (hostname) =>
    hostname === "gitlab.com" || hostname.includes("gitlab"),
  getSelector: () => "a[href]",
  shouldIgnore: (element, _parsed) => {
    const isFileTreeLink = element.classList.contains("tree-item-link");
    const isDownloadButton = element.dataset.testid === "download-button";
    return !isFileTreeLink && !isDownloadButton;
  },
  findExt: (_element, parsed) =>
    parsed
      ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search))
      : null,
  resolveUrl: (_element, parsed) => (parsed ? resolveUrl(parsed) : null),
  getPlacement: () => "afterend",
};

const FigshareAdapter: SiteAdapter = {
  matches: (hostname) =>
    hostname === "figshare.com" || hostname.endsWith(".figshare.com"),
  getSelector: () => "a[href]",
  shouldIgnore: (element, _parsed) => {
    const isThumbnailDownload = element.dataset.controlId?.startsWith(
      "thumbnail-download-item-",
    );
    const isTooltipDownload =
      element.getAttribute("tooltip") === "Download file";
    return !isThumbnailDownload && !isTooltipDownload;
  },
  findExt: (element, parsed) => {
    const ext = parsed
      ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search))
      : null;
    if (ext) return ext;

    let el = element.parentElement;
    for (let depth = 0; el && depth < 3; el = el.parentElement, depth++) {
      const fromAttr = findExtInText(el.getAttribute("title"));
      if (fromAttr) return fromAttr;
      const fromChild = findExtInText(
        el.querySelector(":scope > [title]")?.getAttribute("title") ?? null,
      );
      if (fromChild) return fromChild;
    }
    return null;
  },
  resolveUrl: (_element, parsed) => (parsed ? resolveUrl(parsed) : null),
  getPlacement: () => "afterend",
};

const ZenodoAdapter: SiteAdapter = {
  matches: (hostname) =>
    hostname === "zenodo.org" || hostname.endsWith(".zenodo.org"),
  getSelector: () => "a[href]",
  shouldIgnore: (element, _parsed) => !element.closest("td.ten.wide"),
  findExt: (_element, parsed) =>
    parsed
      ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search))
      : null,
  resolveUrl: (_element, parsed) => (parsed ? resolveUrl(parsed) : null),
  getPlacement: () => "afterend",
};

const GenericAdapter: SiteAdapter = {
  matches: () => true,
  getSelector: () => "a[href]",
  shouldIgnore: (_element, parsed) =>
    !parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:"),
  findExt: (_element, parsed) =>
    parsed
      ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search))
      : null,
  resolveUrl: (_element, parsed) => (parsed ? resolveUrl(parsed) : null),
  getPlacement: () => "afterend",
};

// --- SPECIAL ADAPTERS (Look for Buttons/Divs) ---
const NextcloudAdapter: SiteAdapter = {
  matches: () => {
    return (
      document.head.hasAttribute("data-requesttoken") ||
      document.head.hasAttribute("data-user") ||
      !!document.querySelector(".files-list__row")
    );
  },
  getSelector: () => ".files-list__row-name-link",
  shouldIgnore: () => false,
  findExt: (element, _parsed) => {
    const extEl = element.querySelector(".files-list__row-name-ext");
    if (!extEl || !extEl.textContent) return null;
    const ext = extEl.textContent.trim().replace(".", "").toLowerCase();
    return ALL_EXTENSIONS.has(ext) ? ext : null;
  },
  resolveUrl: (element, _parsed) => {
    // NOTE: this selector ends with '-', which looks truncated. If the Nextcloud
    // badge never appears, inspect the DOM for the real class name.
    const nameEl = element.querySelector(".files-list__row-name-");
    const extEl = element.querySelector(".files-list__row-name-ext");
    if (!nameEl || !extEl) return null;

    const filename = nameEl.textContent?.trim() + extEl.textContent?.trim();

    const userMeta = document.head.querySelector('meta[name="user"]');
    const userId =
      userMeta?.getAttribute("content") ||
      document.head.getAttribute("data-user");

    // dir and filename come from the page: encode each path segment and refuse
    // '.'/'..' so they cannot change which endpoint is requested.
    const dir = new URLSearchParams(window.location.search).get("dir") || "/";
    const segments = (dir + "/" + filename).split("/").filter(Boolean);
    if (segments.some((s) => s === "." || s === "..")) return null;

    const baseDav = userId
      ? `/remote.php/dav/files/${encodeURIComponent(userId)}`
      : "/remote.php/webdav";
    const path = segments.map(encodeURIComponent).join("/");

    return `${window.location.protocol}//${window.location.host}${baseDav}/${path}`;
  },
  getPlacement: () => "afterend",
};

const FileSenderAdapter: SiteAdapter = {
  matches: (hostname) =>
    hostname.includes("filesender") ||
    !!document.querySelector('meta[name="description"][content*="FileSender"]'),

  getSelector: () => 'a[href*="download.php"][href*="files_ids="]',

  shouldIgnore: (element, parsed) => {
    if (!parsed) return true;
    const filesIds = parsed.searchParams.get("files_ids");
    return !filesIds || filesIds.includes(",");
  },

  findExt: (element, parsed) => {
    let currentEl = element.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!currentEl) break;
      const match = findExtInPageText(currentEl.textContent);
      if (match) return match;
      currentEl = currentEl.parentElement;
    }

    const allDownloadLinks = document.querySelectorAll(
      'a[href*="download.php"][href*="files_ids="]:not([href*="%2C"])',
    );
    if (allDownloadLinks.length === 1) {
      // Cap body text search to avoid regex on megabytes of DOM text.
      // 50 000 chars is enough to find any filename in a typical page header or table.
      const bodyText = (document.body.textContent ?? "").slice(0, 50_000);
      const match = findExtInPageText(bodyText);
      if (match) return match;
    }
    return null;
  },

  resolveUrl: (element, parsed) => {
    return element instanceof HTMLAnchorElement ? element.href : null;
  },

  getPlacement: () => "afterend",
};

// ==========================================

const ADAPTERS: SiteAdapter[] = [
  GitHubAdapter,
  GitLabAdapter,
  FigshareAdapter,
  ZenodoAdapter,
  NextcloudAdapter,
  FileSenderAdapter,
  GenericAdapter,
];

function getAdapter(hostname: string): SiteAdapter {
  return ADAPTERS.find((a) => a.matches(hostname)) ?? GenericAdapter;
}

// ==========================================
// 2. WXT ENTRYPOINT (Execution in the Browser)
// ==========================================

export default defineContentScript({
  matches: [
    "*://*.github.com/*",
    "*://*.gitlab.com/*",
    "*://*.figshare.com/*",
    "*://*.zenodo.org/*",
  ],
  runAt: "document_end",
  main() {
    let stylesInjected = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const OBS_OPTIONS: MutationObserverInit = {
      childList: true,
      subtree: true,
    };

    function ensureStyles(): void {
      if (stylesInjected) return;
      stylesInjected = true;
      const style = document.createElement("style");
      style.textContent = `
      .${BADGE_CLASS} {
      display: inline-block; vertical-align: middle;
      margin-left: 6px; margin-right: 6px;
      padding: 2px 6px;
      font-size: 10px; font-weight: bold; line-height: normal;
      border: none; border-radius: 3px;
      color: white; cursor: pointer;
      background: #2da44e;
      position: relative; z-index: 9999;
      }
      .${BADGE_CLASS}:hover { opacity: 0.85; }
            `;
      document.head.appendChild(style);
    }

    function createBadge(rawUrl: string, formatStr: string): HTMLButtonElement {
      ensureStyles();
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = BADGE_CLASS;
      badge.textContent = "Mol*";
      BADGE_DATA.set(badge, { rawUrl, format: formatStr });
      return badge;
    }

    function processElement(element: HTMLElement): void {
      const processed = element.getAttribute(PROCESSED);
      if (processed === "true") return;

      element.parentElement
        ?.querySelectorAll(`.${BADGE_CLASS}`)
        .forEach((b) => b.remove());
      element.setAttribute(PROCESSED, "true");

      const adapter = getAdapter(window.location.hostname);

      let parsed: URL | null = null;
      if (element instanceof HTMLAnchorElement && element.href) {
        if (element.href.length > MAX_URL_LENGTH) return;
        try {
          parsed = new URL(element.href);
        } catch {}
      }

      if (adapter.shouldIgnore(element, parsed)) return;

      const formatStr = adapter.findExt(element, parsed);
      const rawUrl = adapter.resolveUrl(element, parsed);

      if (!formatStr || !rawUrl) return;

      element.insertAdjacentElement(
        adapter.getPlacement(element),
        createBadge(rawUrl, formatStr),
      );
    }

    // --- Event Listeners ---

    document.addEventListener(
      "contextmenu",
      (event: MouseEvent) => {
        if (event.altKey) {
          event.stopImmediatePropagation();
        }
      },
      true,
    );

    document.addEventListener("click", (event: MouseEvent) => {
      // Synthetic clicks (a page script calling .click()) are not user intent.
      if (!event.isTrusted) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const badge = target.closest<HTMLButtonElement>(`.${BADGE_CLASS}`);
      if (!badge) return;

      // Only badges created by this script are in the map; a page-made
      // lookalike is ignored and its click is left alone.
      const data = BADGE_DATA.get(badge);
      if (!data) return;

      event.preventDefault();
      event.stopPropagation();

      // Full validation at the point of use, not just at badge creation time.
      if (!isSafeUrl(data.rawUrl)) return;

      const onError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Extension context invalidated")) {
          alert("Mol* Linker was updated — please refresh this page.");
        } else {
          console.error("[Mol* Linker]", err);
        }
      };

      try {
        browser.runtime
          .sendMessage({
            action: "open_viewer",
            url: data.rawUrl,
            format: data.format,
          })
          .catch(onError);
      } catch (err) {
        onError(err);
      }
    });

    document.addEventListener("mousedown", (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`.${BADGE_CLASS}`))
        event.preventDefault();
    });

    window.addEventListener("pagehide", () => {
      observer.disconnect();
      if (debounceTimer !== null) clearTimeout(debounceTimer);
    });

    // --- Observer Logic ---
    function scanAllElements(): void {
      observer.disconnect();
      try {
        const adapter = getAdapter(window.location.hostname);
        document
          .querySelectorAll<HTMLElement>(adapter.getSelector())
          .forEach(processElement);
      } catch (err) {
        console.warn("[Mol* Linker]", err);
      } finally {
        observer.observe(document.body, OBS_OPTIONS);
      }
    }

    const observer = new MutationObserver(() => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAllElements, 300);
    });

    observer.observe(document.body, OBS_OPTIONS);
    scanAllElements();
  },
});
