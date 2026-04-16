// content.js

const StorageAPI = {
  core: typeof globalThis.browser !== 'undefined' ? globalThis.browser : chrome,
  get: function(keys, callback) { this.core.storage.sync.get(keys, callback); },
  set: function(data, callback) { this.core.storage.sync.set(data, callback); }
};

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);

const GITLAB_PATTERNS = [
  {
    regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
    buildApiUrl: (domain, ns, ref, fp) =>
      `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
  }
];

function extractExtension(urlStr) {
  for (let ext of SUPPORTED_EXT) {
    const regex = new RegExp(`\\${ext}(?:[?#&]|$)`, 'i');
    if (regex.test(urlStr)) return ext;
  }
  return null;
}

// UPDATE: Now it just returns { rawUrl, formatStr } instead of building the MVS JSON
function getStructureInfo(href) {
  const ext = extractExtension(href);
  if (!ext) return null;
  
  // Mol* uses 'mmcif' for .cif files
  const formatStr = ext === '.cif' ? 'mmcif' : ext.slice(1);

  let parsedUrl;
  try {
    parsedUrl = new URL(href, window.location.origin);
  } catch (e) {
    return null; 
  }
  const urlStr = parsedUrl.href;

  if (urlStr.includes('github.com')) {
    let rawUrl = null;
    if (urlStr.includes('/blob/')) {
      rawUrl = urlStr.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else if (urlStr.includes('/raw/refs/heads/')) {
      rawUrl = urlStr.replace('github.com', 'raw.githubusercontent.com').replace('/raw/refs/heads/', '/');
    }
    if (rawUrl) return { rawUrl, formatStr };
  }

  for (const p of GITLAB_PATTERNS) {
    const match = urlStr.match(p.regex);
    if (!match) continue;
    const rawUrl = p.buildApiUrl(match[1], match[2], match[3], match[4]);
    return { rawUrl, formatStr };
  }

  // Universal Fallback
  return { rawUrl: urlStr, formatStr };
}

// UPDATE: Takes the rawUrl and formatStr directly
function makeBadge(rawUrl, formatStr) {
  const badge = document.createElement('a');
  badge.textContent = 'Mol* (Workspace)';
  badge.href = "#"; 
  badge.setAttribute('data-ms-badge', 'true');
  
  // THE FIX: Use chrome.runtime directly
  badge.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Call the global chrome API directly instead of StorageAPI.core
    chrome.runtime.sendMessage({
      action: "open_viewer",
      url: rawUrl,
      format: formatStr
    });
  };
  
  Object.assign(badge.style, {
    marginLeft: '6px',
    fontSize: '10px',
    backgroundColor: rawUrl.includes('gitlab') ? '#6a1b9a' : '#2da44e',
    color: 'white',
    padding: '1px 5px',
    borderRadius: '3px',
    textDecoration: 'none',
    fontWeight: 'bold',
    display: 'inline-block',
    verticalAlign: 'middle',
    cursor: 'pointer' 
  });
  return badge;
}

function injectMolstarLinker() {
  try {
    document.querySelectorAll('a[href]').forEach(a => {
      if (a.getAttribute('data-ms-processed') === a.href) return;
      
      const structureInfo = getStructureInfo(a.href);
      if (!structureInfo) return;
      
      a.setAttribute('data-ms-processed', a.href);
      
      if (a.nextElementSibling && a.nextElementSibling.hasAttribute('data-ms-badge')) {
        return;
      }

      a.insertAdjacentElement('afterend', makeBadge(structureInfo.rawUrl, structureInfo.formatStr));
    });
  } catch (e) { 
    console.warn("Linker Error:", e); 
  }
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(injectMolstarLinker, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

injectMolstarLinker();
