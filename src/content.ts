// src/content.ts
import { DataFormatRegistry } from 'molstar/lib/mol-plugin-state/formats/registry';


// =============================================================================
// SHARED — Extension registry & helpers
// =============================================================================
// Nothing to change here. Mol* tells us which extensions it supports.
// EXT_REGEX is the single regex used by every adapter to detect extensions.

const _reg = new DataFormatRegistry();

const ALL_EXTENSIONS = [
  ...Array.from(_reg.extensions),
  ...Array.from(_reg.binaryExtensions),
];

// Where Mol*'s internal format name differs from the bare extension string
const FORMAT_EXCEPTIONS: Record<string, string> = {
  cif:   'mmcif',
  mmcif: 'mmcif',
  bcif:  'mmcif',
  ent:   'pdb',
};

// One pre-compiled regex, reused everywhere — never rebuilt per link
const EXT_REGEX = new RegExp(`\\.(${ALL_EXTENSIONS.join('|')})(?:[?#&]|$)`, 'i');

// Searches any string for a supported extension. Returns e.g. "pdb" or null.
function findExtInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(EXT_REGEX);
  return m ? m[1].toLowerCase() : null;
}

const MAX_URL_LENGTH = 2048;
const PROCESSED      = 'data-ms-processed';
const BADGE_CLASS    = 'ms-badge';


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
}


// =============================================================================
// SITE — GitHub
// =============================================================================

const GitHubAdapter: SiteAdapter = {

  matches: (hostname) => hostname === 'github.com' || hostname.endsWith('.github.com'),

  // TODO: add selectors for UI elements that should never get a badge
  // e.g. breadcrumb links, commit author links, tab headers...
  // Hint: use anchor.closest('.your-selector') to check parent containers
  shouldIgnore: (_anchor, _parsed) => {
    return false;
  },

  // TODO: decide which signals you trust on GitHub to detect a structure file
  // Available helpers: findExtInText(string)
  // Available inputs:  parsed.pathname, parsed.search, anchor.textContent,
  //                    anchor.title, anchor.getAttribute('download'), ...
  findExt: (_anchor, _parsed) => {
    return null;
  },

  // GitHub viewer URLs need rewriting to raw.githubusercontent.com
  // This is the only part that is filled in because it is mechanical,
  // not a targeting decision.
  resolveUrl: (parsed) => {
    const base = parsed.origin + parsed.pathname;
    if (base.includes('/blob/')) {
      return base
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }
    return base.replace('github.com', 'raw.githubusercontent.com');
  },
};


// =============================================================================
// SITE — GitLab
// =============================================================================

const GITLAB_URL_RE = /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/;

const GitLabAdapter: SiteAdapter = {

  matches: (hostname) => hostname === 'gitlab.com' || hostname.includes('gitlab'),

  // TODO: add selectors for UI elements that should never get a badge
  shouldIgnore: (_anchor, _parsed) => {
    return false;
  },

  // TODO: decide which signals you trust on GitLab to detect a structure file
  findExt: (_anchor, _parsed) => {
    return null;
  },

  // GitLab viewer URLs need rewriting to the repository files API.
  // Filled in for the same reason as GitHub — it is mechanical.
  resolveUrl: (parsed) => {
    const base = parsed.origin + parsed.pathname;
    const m = GITLAB_URL_RE.exec(base);
    if (!m) return parsed.href;
    const [, domain, project, ref, filePath] = m;
    return (
      `https://${domain}/api/v4/projects/` +
      `${encodeURIComponent(project)}/repository/files/` +
      `${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`
    );
  },
};


// =============================================================================
// SITE — Figshare
// =============================================================================

const FigshareAdapter: SiteAdapter = {

  matches: (hostname) => hostname === 'figshare.com' || hostname.endsWith('.figshare.com'),

  // TODO: anything to exclude on Figshare?
  shouldIgnore: (_anchor, _parsed) => {
    return false;
  },

  // TODO: Figshare URLs are opaque — the extension won't be in the pathname.
  // You will likely need to look at surrounding DOM. Explore the page and
  // decide which signals are reliable before filling this in.
  findExt: (_anchor, _parsed) => {
    return null;
  },

  resolveUrl: (parsed) => parsed.href,
};


// =============================================================================
// SITE — Zenodo
// =============================================================================

const ZenodoAdapter: SiteAdapter = {

  matches: (hostname) => hostname === 'zenodo.org' || hostname.endsWith('.zenodo.org'),

  // TODO: anything to exclude on Zenodo?
  shouldIgnore: (_anchor, _parsed) => {
    return false;
  },

  // TODO: explore a Zenodo record page and decide which signal is most reliable.
  // Is it the link text? The URL? An attribute? Fill in once you know.
  findExt: (_anchor, _parsed) => {
    return null;
  },

  resolveUrl: (parsed) => parsed.href,
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
  rawUrl:    string;
  formatStr: string;
}

function analyseLink(anchor: HTMLAnchorElement): StructureInfo | null {
  if (!anchor.href || anchor.href.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try { parsed = new URL(anchor.href); } catch { return null; }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const adapter = getAdapter(parsed.hostname);

  if (adapter.shouldIgnore(anchor, parsed)) return null;

  const ext = adapter.findExt(anchor, parsed);
  if (!ext) return null;

  const formatStr = FORMAT_EXCEPTIONS[ext] ?? ext;
  const rawUrl    = adapter.resolveUrl(parsed);

  return { rawUrl, formatStr };
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
      font-size: 10px; font-weight: bold; line-height: normal;
      border: none; border-radius: 3px;
      color: white; cursor: pointer;
      background: #2da44e;
    }
    .${BADGE_CLASS}:hover { opacity: 0.85; }
  `;
  document.head.appendChild(style);
}

function createBadge(info: StructureInfo, originalHref: string): HTMLButtonElement {
  ensureStyles();
  const badge = document.createElement('button');
  badge.type        = 'button';
  badge.className   = BADGE_CLASS;
  badge.textContent = 'Mol*';
  badge.dataset.rawUrl       = info.rawUrl;
  badge.dataset.formatStr    = info.formatStr;
  badge.dataset.originalHref = originalHref;
  return badge;
}


// =============================================================================
// SHARED — Click handling (single delegated listener for all badges)
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
  if (anchor.hasAttribute(PROCESSED)) return;
  anchor.setAttribute(PROCESSED, 'true');

  // Skip pure numeric text (e.g. GitHub line-number anchors)
  if (/^\d+$/.test(anchor.textContent?.trim() ?? '')) return;

  if (hasProcessedAncestor(anchor)) return;

  const info = analyseLink(anchor);
  if (!info) return;

  anchor.insertAdjacentElement('afterend', createBadge(info, anchor.href));
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
      .querySelectorAll<HTMLAnchorElement>(`a[href]:not([${PROCESSED}])`)
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
