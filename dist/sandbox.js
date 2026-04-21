// src/sandbox.ts
//
// This script runs inside a sandboxed <iframe> (sandbox.html).
// It has no direct access to the extension APIs or the parent page's DOM.
// Communication with the viewer is entirely via postMessage.
import { MvsBuilder } from './mvs-builder.js';
// ---------------------------------------------------------------------------
// Allowed formats (mirrors viewer.ts — defence-in-depth)
// ---------------------------------------------------------------------------
const ALLOWED_FORMATS = new Set([
    'pdb', 'cif', 'mmcif', 'bcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz',
]);
// ---------------------------------------------------------------------------
// Step 1: Signal readiness to the parent viewer page.
// Must happen at the TOP of the script — the parent is already listening.
// ---------------------------------------------------------------------------
window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');
// ---------------------------------------------------------------------------
// Step 2: Mol* viewer instance (kept across re-loads in the same iframe)
// ---------------------------------------------------------------------------
let viewerInstance = null;
// FIX: Prevent "Unsafe attempt to load URL" errors
// Mol* attempts to use replaceState, which fails in sandboxed opaque origins.
window.history.replaceState = () => { };
window.history.pushState = () => { };
// FIX: Prevent "Permissions policy violation: xr-spatial-tracking"
// Mask the XR object so Mol* thinks WebVR is unsupported and doesn't probe it.
if ('xr' in navigator) {
    Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
}
// ---------------------------------------------------------------------------
// Step 3: Message handler
// ---------------------------------------------------------------------------
window.addEventListener('message', async (event) => {
    const msg = event.data;
    // Accept the message if it has our exact action signature
    if (!msg || msg.action !== 'INIT_MOLSTAR')
        return;
    const { url, format, settings, originalUrl } = msg;
    // SECURITY: url must be null (empty session) or a data: URI
    if (url !== null && (typeof url !== 'string' || !url.startsWith('data:'))) {
        console.error('Mol* Sandbox: rejected non-data URL');
        return;
    }
    // SECURITY: format must be null (empty session) or a known format string
    if (url !== null && (typeof format !== 'string' || !ALLOWED_FORMATS.has(format))) {
        console.error('Mol* Sandbox: rejected unknown format:', format);
        return;
    }
    try {
        // Always initialise the viewer first (whether we have a file or not)
        if (!viewerInstance) {
            viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: true,
                layoutShowControls: true,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: true,
                layoutShowLeftPanel: true,
            });
        }
        // Empty workspace requested — we are done
        if (url === null) {
            console.log('Mol* Sandbox: empty session opened.');
            return;
        }
        // -----------------------------------------------------------------------
        // Anti-lag fix: convert the large base64 data URI into a short blob URL.
        // Embedding a 10 MB base64 string directly in the MVS JSON causes severe
        // rendering stalls. A blob URL is just ~50 characters.
        // -----------------------------------------------------------------------
        const response = await fetch(url);
        const blob = await response.blob();
        let shortBlobUrl = URL.createObjectURL(blob);
        // Append the original filename as a hash fragment so Mol* can detect
        // the format from the URL when needed (fallback path)
        if (originalUrl) {
            try {
                const filename = new URL(originalUrl).pathname.split('/').pop();
                if (filename)
                    shortBlobUrl += `#${filename}`;
            }
            catch {
                // originalUrl might be a synthetic "local-file://" string — ignore
            }
        }
        // Build and load the MVS state tree
        const mvsTemplate = MvsBuilder._buildBaseTemplate(shortBlobUrl, format, settings);
        const mvsDataString = JSON.stringify(mvsTemplate);
        if (typeof viewerInstance.loadMvsData === 'function') {
            // Newer Mol* versions expose this convenience method
            await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
        }
        else {
            // Older Mol* — use the PluginExtensions API directly
            const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
            await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
        }
    }
    catch (err) {
        console.error('Mol* Sandbox: failed to load structure', err);
    }
});
