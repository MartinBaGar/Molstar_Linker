// content.js

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);

const GITLAB_PATTERNS = [{
  regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
  buildApiUrl: (domain, ns, ref, fp) =>
    `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
}];

function extractExtension(urlStr) {
  for (let ext of SUPPORTED_EXT) {
    if (new RegExp(`\\${ext}(?:[?#&]|$)`, 'i').test(urlStr)) return ext;
  }
  return null;
}

function getStructureInfo(href) {
  let parsedUrl;
  try { parsedUrl = new URL(href, window.location.origin); } 
  catch (e) { return null; }

  // Reject anchor jump links (e.g., #L10)
  if (parsedUrl.hash) return null; 

  const extWithQuery = extractExtension(parsedUrl.href);
  if (!extWithQuery) return null;
  
  const formatStr = extWithQuery === '.cif' ? 'mmcif' : extWithQuery.slice(1);
  const cleanUrl = parsedUrl.origin + parsedUrl.pathname; 

  // Reject Git UI pages that aren't physical raw files
  if (['/blame/', '/commits/', '/commit/', '/edit/', '/tree/', '/network/', '/compare/'].some(p => cleanUrl.includes(p))) return null;

  // FIX: Properly handle both /blob/ file views and /raw/ download links on GitHub
  if (cleanUrl.includes('github.com')) {
    const rawUrl = cleanUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
      .replace('/raw/', '/');
    return { rawUrl, formatStr };
  }

  for (const p of GITLAB_PATTERNS) {
    const match = cleanUrl.match(p.regex); 
    if (match) return { rawUrl: p.buildApiUrl(match[1], match[2], match[3], match[4]), formatStr };
  }

  return { rawUrl: parsedUrl.href, formatStr }; 
}

function makeBadge(rawUrl, formatStr, originalHref) {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.textContent = 'Mol* (Workspace)';
  badge.dataset.msBadge = 'true';
  badge.dataset.originalHref = originalHref;
  
  // Block mousedown/mouseup so GitLab doesn't trigger row navigation
  const blockEvent = (e) => { e.preventDefault(); e.stopPropagation(); };

  badge.addEventListener('click', (e) => {
    blockEvent(e);
    try {
      chrome.runtime.sendMessage({ action: "open_viewer", url: rawUrl, format: formatStr });
    } catch (err) {
      if (err.message.includes("Extension context invalidated")) {
        alert("Mol* Linker has been updated. Please refresh this page to open the workspace.");
      } else {
        console.error("Mol* Workspace Error:", err);
      }
    }
  });
  
  badge.addEventListener('mousedown', blockEvent);
  badge.addEventListener('mouseup', blockEvent);
  
  Object.assign(badge.style, {
    marginLeft: '6px', fontSize: '10px', border: 'none',
    backgroundColor: rawUrl.includes('gitlab') ? '#6a1b9a' : '#2da44e',
    color: 'white', padding: '2px 6px', borderRadius: '3px',
    textDecoration: 'none', fontWeight: 'bold', display: 'inline-block',
    verticalAlign: 'middle', cursor: 'pointer', lineHeight: 'normal'
  });
  return badge;
}

function injectMolstarLinker() {
  observer.disconnect();
  try {
    document.querySelectorAll('a[href]:not([data-ms-badge])').forEach(a => {
      if (a.dataset.msProcessed === 'true') return;
      
      // Skip pure line numbers (e.g. "10", "11") 
      const text = a.textContent.trim();
      if (/^\d+$/.test(text)) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      const info = getStructureInfo(a.href);
      if (!info) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      // Prevent cloning: Ensure this exact container doesn't already have this badge
      const parent = a.parentNode;
      if (parent && Array.from(parent.children).some(node => node.dataset.msBadge === 'true' && node.dataset.originalHref === a.href)) {
        a.dataset.msProcessed = 'true';
        return;
      }

      a.dataset.msProcessed = 'true';
      
      // FIX: Direct insertion! No more DOM climbing. It drops right next to the <a> tag.
      a.insertAdjacentElement('afterend', makeBadge(info.rawUrl, info.formatStr, a.href));
    });
  } catch (e) { console.warn("Mol* Linker Error:", e); }
  
  observer.observe(document.body, { childList: true, subtree: true });
}

const observer = new MutationObserver(() => {
  clearTimeout(window.msDebounce);
  window.msDebounce = setTimeout(injectMolstarLinker, 500);
});
observer.observe(document.body, { childList: true, subtree: true });
injectMolstarLinker();
