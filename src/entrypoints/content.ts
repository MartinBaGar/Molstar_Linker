import { findExtInText, MAX_URL_LENGTH, resolveUrl } from '~/utils/links';

// ==========================================
// 1. DEFINITIONS (Safe for Node.js to read)
// ==========================================

const PROCESSED = 'data-ms-processed';
const BADGE_CLASS = 'ms-badge';

interface SiteAdapter {
    matches(hostname: string): boolean;
    getSelector(): string; // Tells the scanner what elements to target
    shouldIgnore(element: HTMLElement, parsed: URL | null): boolean;
    findExt(element: HTMLElement, parsed: URL | null): string | null;
    resolveUrl(element: HTMLElement, parsed: URL | null): string | null;
    getPlacement(element: HTMLElement): InsertPosition;
}

// --- STANDARD ADAPTERS (Look for a[href]) ---

const GitHubAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'github.com' || hostname.endsWith('.github.com'),
    getSelector: () => 'a[href]',
    shouldIgnore: (element, _parsed) => {
        const isFileTreeLink = element.classList.contains('Link--primary');
        const isRawButton = element.dataset.testid === 'raw-button';
        return !isFileTreeLink && !isRawButton;
    },
    findExt: (_element, parsed) => parsed ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search)) : null,
    resolveUrl: (_element, parsed) => parsed ? resolveUrl(parsed) : null,
    getPlacement: (element) => element.dataset.testid === 'raw-button' ? 'beforebegin' : 'afterend',
};

const GitLabAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'gitlab.com' || hostname.includes('gitlab'),
    getSelector: () => 'a[href]',
    shouldIgnore: (element, _parsed) => {
        const isFileTreeLink = element.classList.contains('tree-item-link');
        const isDownloadButton = element.dataset.testid === 'download-button';
        return !isFileTreeLink && !isDownloadButton;
    },
    findExt: (_element, parsed) => parsed ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search)) : null,
    resolveUrl: (_element, parsed) => parsed ? resolveUrl(parsed) : null,
    getPlacement: () => 'afterend',
};

const FigshareAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'figshare.com' || hostname.endsWith('.figshare.com'),
    getSelector: () => 'a[href]',
    shouldIgnore: (element, _parsed) => {
        const isThumbnailDownload = element.dataset.controlId?.startsWith('thumbnail-download-item-');
        const isTooltipDownload = element.getAttribute('tooltip') === 'Download file';
        return !isThumbnailDownload && !isTooltipDownload;
    },
    findExt: (element, parsed) => {
        const ext = parsed ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search)) : null;
        if (ext) return ext;

        let el = element.parentElement;
        for (let depth = 0; el && depth < 3; el = el.parentElement, depth++) {
            const fromAttr = findExtInText(el.getAttribute('title'));
            if (fromAttr) return fromAttr;
            const fromChild = findExtInText(el.querySelector(':scope > [title]')?.getAttribute('title') ?? null);
            if (fromChild) return fromChild;
        }
        return null;
    },
    resolveUrl: (_element, parsed) => parsed ? resolveUrl(parsed) : null,
    getPlacement: () => 'afterend',
};

const ZenodoAdapter: SiteAdapter = {
    matches: (hostname) => hostname === 'zenodo.org' || hostname.endsWith('.zenodo.org'),
    getSelector: () => 'a[href]',
    shouldIgnore: (element, _parsed) => !element.closest('td.ten.wide'),
    findExt: (_element, parsed) => parsed ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search)) : null,
    resolveUrl: (_element, parsed) => parsed ? resolveUrl(parsed) : null,
    getPlacement: () => 'afterend',
};

const GenericAdapter: SiteAdapter = {
    matches: () => true,
    getSelector: () => 'a[href]',
    shouldIgnore: (_element, parsed) => !parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:'),
    findExt: (_element, parsed) => parsed ? (findExtInText(parsed.pathname) ?? findExtInText(parsed.search)) : null,
    resolveUrl: (_element, parsed) => parsed ? resolveUrl(parsed) : null,
    getPlacement: () => 'afterend',
};

// --- SPECIAL ADAPTERS (Look for Buttons/Divs) ---

const NextcloudAdapter: SiteAdapter = {
    matches: () => {
        // Generically detect ANY Nextcloud instance without hardcoding domains.
        // Nextcloud consistently injects these attributes into the <head> on load.
        return document.head.hasAttribute('data-requesttoken') ||
               document.head.hasAttribute('data-user') ||
               !!document.querySelector('.files-list__row');
    },
    getSelector: () => '.files-list__row-name-link',
    shouldIgnore: () => false,
    findExt: (element, _parsed) => {
        const extEl = element.querySelector('.files-list__row-name-ext');
        if (!extEl || !extEl.textContent) return null;
        const ext = extEl.textContent.trim().replace('.', '').toLowerCase();
        return ['pdb', 'cif', 'gro', 'sdf', 'mol', 'mol2', 'xyz'].includes(ext) ? ext : null;
    },
    resolveUrl: (element, _parsed) => {
        const nameEl = element.querySelector('.files-list__row-name-');
        const extEl = element.querySelector('.files-list__row-name-ext');
        if (!nameEl || !extEl) return null;

        const filename = nameEl.textContent?.trim() + extEl.textContent?.trim();

        // Find User ID dynamically (checks standard Nextcloud metadata)
        const userMeta = document.head.querySelector('meta[name="user"]');
        const userId = userMeta?.getAttribute('content') || document.head.getAttribute('data-user');

        const urlParams = new URLSearchParams(window.location.search);
        const dir = urlParams.get('dir') || '/';
        const cleanDir = dir.endsWith('/') ? dir : dir + '/';

        // If a user ID is found, use the specific user DAV path.
        // If missing (e.g. public links or custom setups), fallback to generic WebDAV endpoint.
        const baseDav = userId ? `/remote.php/dav/files/${userId}` : '/remote.php/webdav';

        return `https://${window.location.hostname}${baseDav}${cleanDir}${filename}`;
    },
    getPlacement: () => 'afterend',
};

// ==========================================

const ADAPTERS: SiteAdapter[] = [
    GitHubAdapter,
    GitLabAdapter,
    FigshareAdapter,
    ZenodoAdapter,
    NextcloudAdapter,
    GenericAdapter,
];

function getAdapter(hostname: string): SiteAdapter {
    return ADAPTERS.find(a => a.matches(hostname)) ?? GenericAdapter;
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
        // "<all_urls>" // <--- This allows the script to scan new websites for Nextcloud markers
    ],
    runAt: 'document_end',
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

        function createBadge(rawUrl: string, formatStr: string, originalHref: string): HTMLButtonElement {
            ensureStyles();
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = BADGE_CLASS;
            badge.textContent = 'Mol*';
            badge.dataset.rawUrl = rawUrl;
            badge.dataset.formatStr = formatStr;
            badge.dataset.originalHref = originalHref;
            return badge;
        }

        function processElement(element: HTMLElement): void {
            const processed = element.getAttribute(PROCESSED);
            if (processed === 'true') return;

            element.parentElement?.querySelectorAll(`.${BADGE_CLASS}`).forEach(b => b.remove());
            element.setAttribute(PROCESSED, 'true');

            const adapter = getAdapter(window.location.hostname);

            let parsed: URL | null = null;
            if (element instanceof HTMLAnchorElement && element.href) {
                if (element.href.length > MAX_URL_LENGTH) return;
                try { parsed = new URL(element.href); } catch { }
            }

            if (adapter.shouldIgnore(element, parsed)) return;

            const formatStr = adapter.findExt(element, parsed);
            const rawUrl = adapter.resolveUrl(element, parsed);

            if (!formatStr || !rawUrl) return;

            const originalHref = element instanceof HTMLAnchorElement ? element.href : '';
            element.insertAdjacentElement(adapter.getPlacement(element), createBadge(rawUrl, formatStr, originalHref));
        }

        // --- Event Listeners ---

        document.addEventListener('contextmenu', (event: MouseEvent) => {
            if (event.altKey) {
                event.stopImmediatePropagation();
            }
        }, true);

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
        function scanAllElements(): void {
            observer.disconnect();
            try {
                const adapter = getAdapter(window.location.hostname);
                document.querySelectorAll<HTMLElement>(adapter.getSelector()).forEach(processElement);
            } catch (err) {
                console.warn('[Mol* Linker]', err);
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
    }
});
