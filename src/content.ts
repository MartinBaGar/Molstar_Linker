// src/content.ts
import { findExtInText, MAX_URL_LENGTH, resolveUrl } from './utils/links';

// =============================================================================
// SHARED — Extension registry & helpers
// =============================================================================

const PROCESSED = 'data-ms-processed';
const BADGE_CLASS = 'ms-badge';

// =============================================================================
// SHARED — Adapter interface
// =============================================================================
// Every site section below must produce an object that satisfies this shape.
// The engine only calls these three methods — nothing else leaks between sites.

interface SiteAdapter {
    // Return true if this adapter should handle the given hostname.
    matches(hostname: string): boolean;

    // Return true if this specific link should be silently skipped.
    // Use this to exclude nav elements, breadcrumbs, UI chrome, etc.
    // Return false if you have nothing to exclude yet — fill in later.
    shouldIgnore(anchor: HTMLAnchorElement, parsed: URL): boolean;

    // Return the file extension (e.g. "pdb") if this link points to a structure,
    // or null if it does not. Use findExtInText() on whatever signals you trust
    // for this site. Leave returning null until you know what to target.
    findExt(anchor: HTMLAnchorElement, parsed: URL): string | null;

    // Return the direct download URL for this link.
    // If no transformation is needed just return parsed.href.
    resolveUrl(parsed: URL): string;
    // Per-link placement — called after shouldIgnore passes.
    // Return 'afterend' to inject the badge after the link (default),
    // or 'beforebegin' to inject it before.
    getPlacement(anchor: HTMLAnchorElement): InsertPosition;
}

// =============================================================================
// SITE — GitHub
// =============================================================================

const GitHubAdapter: SiteAdapter = {

    matches: (hostname) => hostname === 'github.com' || hostname.endsWith('.github.com'),

    shouldIgnore: (anchor, _parsed) => {
        const isFileTreeLink = anchor.classList.contains('Link--primary');
        const isRawButton = anchor.dataset.testid === 'raw-button';
        return !isFileTreeLink && !isRawButton;
    },

    findExt: (_anchor, parsed) => {
        return findExtInText(parsed.pathname) ?? findExtInText(parsed.search);
    },

    resolveUrl: (parsed) => resolveUrl(parsed),

    getPlacement: (anchor) => {
        if (anchor.dataset.testid === 'raw-button') return 'beforebegin';
        return 'afterend';
    },
};


// =============================================================================
// SITE — GitLab
// =============================================================================

const GitLabAdapter: SiteAdapter = {

    matches: (hostname) => hostname === 'gitlab.com' || hostname.includes('gitlab'),

    shouldIgnore: (anchor, _parsed) => {
        const isFileTreeLink = anchor.classList.contains('tree-item-link');
        const isDownloadButton = anchor.dataset.testid === 'download-button';
        return !isFileTreeLink && !isDownloadButton;
    },

    findExt: (_anchor, parsed) => {
        return findExtInText(parsed.pathname) ?? findExtInText(parsed.search);
    },

    resolveUrl: (parsed) => resolveUrl(parsed),

    getPlacement: (_anchor) => 'afterend',
};


// =============================================================================
// SITE — Figshare
// =============================================================================

const FigshareAdapter: SiteAdapter = {

    matches: (hostname) => hostname === 'figshare.com' || hostname.endsWith('.figshare.com'),

    shouldIgnore: (anchor, _parsed) => {
        const isThumbnailDownload = anchor.dataset.controlId?.startsWith('thumbnail-download-item-');
        const isTooltipDownload = anchor.getAttribute('tooltip') === 'Download file';
        return !isThumbnailDownload && !isTooltipDownload;
    },
    findExt: (anchor, _parsed) => {
        let ext = findExtInText(_parsed.pathname) ?? findExtInText(_parsed.search);
        if (ext) return ext;

        // Only look within immediate vicinity — max 3 levels up
        let el = anchor.parentElement;
        let depth = 0;
        while (el && depth < 3) {
            const title = el.getAttribute('title');
            if (title) {
                ext = findExtInText(title);
                if (ext) break;
            }
            const titledSibling = el.querySelector(':scope > [title]');
            if (titledSibling) {
                ext = findExtInText(titledSibling.getAttribute('title'));
                if (ext) break;
            }
            el = el.parentElement;
            depth++;
        }

        return ext;
    },

    resolveUrl: (parsed) => resolveUrl(parsed),

    getPlacement: (_anchor) => 'afterend',
};


// =============================================================================
// SITE — Zenodo
// =============================================================================

const ZenodoAdapter: SiteAdapter = {

    matches: (hostname) => hostname === 'zenodo.org' || hostname.endsWith('.zenodo.org'),

    shouldIgnore: (anchor, _parsed) => {
        const isFileLink = anchor.closest('td.ten.wide')
        return !isFileLink;
    },

    findExt: (_anchor, parsed) => {
        return findExtInText(parsed.pathname) ?? findExtInText(parsed.search);
    },

    resolveUrl: (parsed) => parsed.href,

    getPlacement: (_anchor) => 'afterend',
};


// =============================================================================
// SITE — Generic fallback
// =============================================================================
// Catches any site not listed above. Be conservative here — false positives
// on unknown sites are worse than missing a badge. Start with the safest
// signals (URL pathname, link text) and only add wider rings if needed.

const GenericAdapter: SiteAdapter = {

    matches: () => true, // always matches — must stay last in ADAPTERS

    shouldIgnore: (_anchor, parsed) => {
        // Reject non-navigable protocols regardless of site
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return true;
        return false;
    },

    // TODO: decide what the fallback behaviour should be for unknown sites.
    // Start minimal and expand only when you see real cases that need it.
    findExt: (_anchor, _parsed) => {
        return null;
    },

    resolveUrl: (parsed) => parsed.href,

    getPlacement: (_anchor) => 'afterend',
};


// =============================================================================
// SHARED — Adapter registry
// =============================================================================
// Order matters: first match wins. GenericAdapter must always be last.

const ADAPTERS: SiteAdapter[] = [
    GitHubAdapter,
    GitLabAdapter,
    FigshareAdapter,
    ZenodoAdapter,
    GenericAdapter,
];

function getAdapter(hostname: string): SiteAdapter {
    return ADAPTERS.find(a => a.matches(hostname)) ?? GenericAdapter;
}


// =============================================================================
// SHARED — Link analysis
// =============================================================================
// The single entry point the engine calls per link.
// Picks the right adapter, delegates, returns a result or null.

interface StructureInfo {
    rawUrl: string;
    formatStr: string;
    adapter: SiteAdapter;
}

function analyseLink(anchor: HTMLAnchorElement): StructureInfo | null {
    if (!anchor.href || anchor.href.length > MAX_URL_LENGTH) return null;

    let parsed: URL;
    try { parsed = new URL(anchor.href); } catch { return null; }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

    const adapter = getAdapter(parsed.hostname);

    if (adapter.shouldIgnore(anchor, parsed)) return null;
    const formatStr = adapter.findExt(anchor, parsed);
    if (!formatStr) return null;

    const rawUrl = adapter.resolveUrl(parsed);

    return { rawUrl, formatStr, adapter };
}


// =============================================================================
// SHARED — Badge
// =============================================================================

let stylesInjected = false;
function ensureStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
    .${BADGE_CLASS} {
      display: inline-block; vertical-align: middle;
      margin-left: 6px; padding: 2px 6px;
      margin-right: 6px; padding: 2px 6px;
      font-size: 10px; font-weight: bold; line-height: normal;
      border: none; border-radius: 3px;
      color: white; cursor: pointer;
      background: #2da44e;
      position: relative;
      z-index: 9999;
    }
    .${BADGE_CLASS}:hover { opacity: 0.85; }
  `;
    document.head.appendChild(style);
}

function createBadge(info: StructureInfo, originalHref: string): HTMLButtonElement {
    ensureStyles();
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = BADGE_CLASS;
    badge.textContent = 'Mol*';
    badge.dataset.rawUrl = info.rawUrl;
    badge.dataset.formatStr = info.formatStr;
    badge.dataset.originalHref = originalHref;
    return badge;
}


// =============================================================================
// SHARED — Click handling
// =============================================================================

document.addEventListener('click', (event: MouseEvent) => {
    const badge = (event.target as HTMLElement).closest<HTMLButtonElement>(`.${BADGE_CLASS}`);
    if (!badge) return;
    event.preventDefault();
    event.stopPropagation();
    const { rawUrl = '', formatStr = '' } = badge.dataset;
    if (!rawUrl.startsWith('http')) return;
    try {
        chrome.runtime.sendMessage({ action: 'open_viewer', url: rawUrl, format: formatStr });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Extension context invalidated')) {
            alert('Mol* Linker was updated — please refresh this page.');
        } else {
            console.error('[Mol* Linker]', err);
        }
    }
});

document.addEventListener('mousedown', (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest(`.${BADGE_CLASS}`)) event.preventDefault();
});


// =============================================================================
// SHARED — Processing pipeline
// =============================================================================

// Skips links nested inside an element we already processed.
// Prevents duplicate badges when links are nested in complex layouts.
function hasProcessedAncestor(anchor: HTMLAnchorElement): boolean {
    let node = anchor.parentElement;
    while (node) {
        if (node.hasAttribute(PROCESSED)) return true;
        node = node.parentElement;
    }
    return false;
}

function processLink(anchor: HTMLAnchorElement): void {
    const previousHref = anchor.getAttribute(PROCESSED);
    const currentHref = anchor.href;

    // Stale or missing badge — remove it and reset
    if (previousHref !== currentHref) {
        anchor.parentElement
            ?.querySelectorAll(`.${BADGE_CLASS}`)
            .forEach(b => b.remove());
        anchor.removeAttribute(PROCESSED);
    }

    // Already up to date
    if (previousHref === currentHref) return;

    const info = analyseLink(anchor);
    if (!info) {
        // Stamp even on failure so we don't retry endlessly on non-structure links
        anchor.setAttribute(PROCESSED, currentHref);
        return;
    }

    anchor.setAttribute(PROCESSED, currentHref);

    if (hasProcessedAncestor(anchor)) return;

    const placement = info.adapter.getPlacement(anchor);
    anchor.insertAdjacentElement(placement, createBadge(info, anchor.href));
}

const OBS_OPTIONS = { childList: true, subtree: true };
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAllLinks, 300);
});

function scanAllLinks(): void {
    observer.disconnect();
    try {
        document
            .querySelectorAll<HTMLAnchorElement>('a[href]')
            .forEach(processLink);
    } catch (err) {
        console.warn('[Mol* Linker]', err);
    } finally {
        observer.observe(document.body, OBS_OPTIONS);
    }
}

window.addEventListener('unload', () => {
    observer.disconnect();
    if (debounceTimer !== null) clearTimeout(debounceTimer);
});


// =============================================================================
// SHARED — Bootstrap
// =============================================================================

observer.observe(document.body, OBS_OPTIONS);
scanAllLinks();
