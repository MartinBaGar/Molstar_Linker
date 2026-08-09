import { findExtInText, MAX_URL_LENGTH, resolveUrl } from '~/utils/links';

// ==========================================
// 1. DEFINITIONS (Safe for Node.js to read)
// ==========================================

const PROCESSED = 'data-ms-processed';
const BADGE_CLASS = 'ms-badge';

interface SiteAdapter {
    matches(hostname: string): boolean;
    shouldIgnore(anchor: HTMLAnchorElement, parsed: URL): boolean;
    findExt(anchor: HTMLAnchorElement, parsed: URL): string | null;
    resolveUrl(parsed: URL): string;
    getPlacement(anchor: HTMLAnchorElement): InsertPosition;
}

const GitHubAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'github.com' || hostname.endsWith('.github.com'),
    shouldIgnore: (anchor, _parsed) => {
        const isFileTreeLink = anchor.classList.contains('Link--primary');
        const isRawButton = anchor.dataset.testid === 'raw-button';
        return !isFileTreeLink && !isRawButton;
    },
    findExt: (_anchor, parsed) => findExtInText(parsed.pathname) ?? findExtInText(parsed.search),
    resolveUrl: (parsed) => resolveUrl(parsed),
    getPlacement: (anchor) => anchor.dataset.testid === 'raw-button' ? 'beforebegin' : 'afterend',
};

const GitLabAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'gitlab.com' || hostname.includes('gitlab'),
    shouldIgnore: (anchor, _parsed) => {
        const isFileTreeLink = anchor.classList.contains('tree-item-link');
        const isDownloadButton = anchor.dataset.testid === 'download-button';
        return !isFileTreeLink && !isDownloadButton;
    },
    findExt: (_anchor, parsed) => findExtInText(parsed.pathname) ?? findExtInText(parsed.search),
    resolveUrl: (parsed) => resolveUrl(parsed),
    getPlacement: () => 'afterend',
};

const FigshareAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'figshare.com' || hostname.endsWith('.figshare.com'),
    shouldIgnore: (anchor, _parsed) => {
        const isThumbnailDownload = anchor.dataset.controlId?.startsWith('thumbnail-download-item-');
        const isTooltipDownload = anchor.getAttribute('tooltip') === 'Download file';
        return !isThumbnailDownload && !isTooltipDownload;
    },
    findExt: (anchor, parsed) => {
        const ext = findExtInText(parsed.pathname) ?? findExtInText(parsed.search);
        if (ext) return ext;

        let el = anchor.parentElement;
        for (let depth = 0; el && depth < 3; el = el.parentElement, depth++) {
            const fromAttr = findExtInText(el.getAttribute('title'));
            if (fromAttr) return fromAttr;
            const fromChild = findExtInText(el.querySelector(':scope > [title]')?.getAttribute('title') ?? null);
            if (fromChild) return fromChild;
        }
        return null;
    },
    resolveUrl: (parsed) => resolveUrl(parsed),
    getPlacement: () => 'afterend',
};

const ZenodoAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'zenodo.org' || hostname.endsWith('.zenodo.org'),
    shouldIgnore: (anchor, _parsed) => !anchor.closest('td.ten.wide'),
    findExt: (_anchor, parsed) => findExtInText(parsed.pathname) ?? findExtInText(parsed.search),
    resolveUrl: (parsed) => resolveUrl(parsed),
    getPlacement: () => 'afterend',
};

const GenericAdapter: SiteAdapter = {
    matches: () => true,
    shouldIgnore: (_anchor, parsed) => parsed.protocol !== 'https:' && parsed.protocol !== 'http:',
    findExt: () => null,
    resolveUrl: (parsed) => resolveUrl(parsed),
    getPlacement: () => 'afterend',
};

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
    return { rawUrl: adapter.resolveUrl(parsed), formatStr, adapter };
}

// ==========================================
// 2. WXT ENTRYPOINT (Execution in the Browser)
// ==========================================

export default defineContentScript({
    matches: [
        "*://*.github.com/*",
        "*://*.gitlab.com/*",
        "*://*.figshare.com/*",
        "*://*.zenodo.org/*"
    ],
    runAt: 'document_end',
    // EVERYTHING inside main() only runs when injected into the live webpage
    main() {
        let stylesInjected = false;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const OBS_OPTIONS: MutationObserverInit = { childList: true, subtree: true };

        function ensureStyles(): void {
            if (stylesInjected) return;
            stylesInjected = true;
            const style = document.createElement('style');
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

        function processLink(anchor: HTMLAnchorElement): void {
            const previousHref = anchor.getAttribute(PROCESSED);
            const currentHref = anchor.href;
            if (previousHref === currentHref) return;

            anchor.parentElement?.querySelectorAll(`.${BADGE_CLASS}`).forEach(b => b.remove());
            anchor.setAttribute(PROCESSED, currentHref);

            const info = analyseLink(anchor);
            if (!info) return;

            anchor.insertAdjacentElement(info.adapter.getPlacement(anchor), createBadge(info, currentHref));
        }

        // --- Event Listeners ---
        document.addEventListener('click', (event: MouseEvent) => {
            const badge = (event.target as HTMLElement).closest<HTMLButtonElement>(`.${BADGE_CLASS}`);
            if (!badge) return;
            event.preventDefault();
            event.stopPropagation();
            const { rawUrl = '', formatStr = '' } = badge.dataset;
            if (!rawUrl.startsWith('http')) return;
            try {
                browser.runtime.sendMessage({ action: 'open_viewer', url: rawUrl, format: formatStr });
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

        window.addEventListener('unload', () => {
            observer.disconnect();
            if (debounceTimer !== null) clearTimeout(debounceTimer);
        });

        // --- Observer Logic ---
        function scanAllLinks(): void {
            observer.disconnect();
            try {
                document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(processLink);
            } catch (err) {
                console.warn('[Mol* Linker]', err);
            } finally {
                observer.observe(document.body, OBS_OPTIONS);
            }
        }

        const observer = new MutationObserver(() => {
            if (debounceTimer !== null) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(scanAllLinks, 300);
        });

        observer.observe(document.body, OBS_OPTIONS);
        scanAllLinks();
    }
});
