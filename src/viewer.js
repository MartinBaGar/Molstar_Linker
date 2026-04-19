// viewer.js

const ALLOWED_URL_SCHEMES = ['https:'];
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'cif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
const MAX_BYTES = 25 * 1024 * 1024;

let currentIframe = null; // Keep track of the active viewer iframe

function isSafeUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        if (!ALLOWED_URL_SCHEMES.includes(u.protocol)) return false;
        if (BLOCKED_HOSTNAMES.has(u.hostname)) return false;
        const ipv4 = u.hostname.match(/^(\d+)\.(\d+)/);
        if (ipv4) {
            const [, a, b] = ipv4.map(Number);
            if (a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) return false;
        }
        return true;
    } catch {
        return false;
    }
}

// --- NEW: Reusable Iframe Spawner ---
function spawnIframe(dataUri, format, rawUrl) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.remove();

    // Destroy existing iframe if the user drops a new file
    if (currentIframe) {
        currentIframe.remove();
        currentIframe = null;
    }

    chrome.storage.sync.get(null, (storedSettings) => {
        const defaults = AppConfig.getDefaults();
        const finalSettings = { ...defaults };
        for (const key of Object.keys(defaults)) {
            if (key in storedSettings) finalSettings[key] = storedSettings[key];
        }
        if (Array.isArray(storedSettings.customRules)) {
            finalSettings.customRules = storedSettings.customRules;
        }

        const iframe = document.createElement('iframe');
        iframe.src = 'sandbox.html';
        iframe.allow = 'xr-spatial-tracking';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

        iframe.onload = () => {
            iframe.contentWindow.postMessage({
                action: 'INIT_MOLSTAR',
                url: dataUri, // This will be null for empty sessions
                format: format,
                settings: finalSettings,
                originalUrl: rawUrl
            }, '*');
        };

        document.body.appendChild(iframe);
        currentIframe = iframe;
    });
}

// --- CORE FETCHING LOGIC (For GitLab/GitHub Links) ---
async function bootWorkspace(rawUrl, safeFormat) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.innerText = 'Downloading structure securely...';

    try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
            throw new Error('File exceeds the 25 MB size limit.');
        }

        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error('File exceeds the 25 MB size limit.');

        const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        spawnIframe(dataUri, safeFormat, rawUrl);

    } catch (error) {
        console.error("Workspace Fetch Error:", error);
        if (loadingDiv) loadingDiv.innerText = `Failed to load structure file. ${error.message}`;
    }
}

// --- NEW: Full-Page Drag & Drop ---
function setupDragAndDrop() {
    const overlay = document.createElement('div');
    overlay.id = 'dnd-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); color: white; display: none; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; font-family: sans-serif; z-index: 9999; border: 4px dashed var(--success, #2da44e); box-sizing: border-box; flex-direction: column; gap: 15px;';
    overlay.innerHTML = `<span>📂 Drop Structure File Here</span><span style="font-size: 16px; color: #ccc;">Supported: PDB, mmCIF, SDF, GRO, XYZ</span>`;
    document.body.appendChild(overlay);

    let dragCounter = 0;

    // Detect when file enters the window
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.style.display = 'flex';
    });

    // Detect when file leaves the window
    window.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) overlay.style.display = 'none';
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    // Detect the drop
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.style.display = 'none';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        let ext = file.name.split('.').pop().toLowerCase();
        let format = ext;
        if (ext === 'ent') format = 'pdb'; // Handle .ent files as PDB
        if (ext === 'cif') format = 'mmcif'; // Handle .cif files as mmCIF

        if (!ALLOWED_FORMATS.has(format)) {
            alert(`Unsupported file format: .${ext}. Please use PDB, mmCIF, SDF, etc.`);
            return;
        }

        // Convert dropped file to Data URI and inject into iframe
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUri = event.target.result;
            spawnIframe(dataUri, format, 'local-file://' + file.name);
        };
        reader.readAsDataURL(file);
    });
}

// --- INITIALIZATION ---
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // ALWAYS initialize Drag & Drop so it's ready even if the workspace is empty
    setupDragAndDrop();

    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('fileUrl');
    const format = urlParams.get('format');
    const localBlob = urlParams.get('localBlob');
    const filename = urlParams.get('filename');
    const loadingDiv = document.getElementById('loading');

    // SCENARIO 0: Handoff from Options Page (Blob URL)
    if (localBlob && (localBlob.startsWith('blob:chrome-extension://') || localBlob.startsWith('blob:moz-extension://'))) {
        if (loadingDiv) loadingDiv.innerText = 'Transferring local file...';
        try {
            // Fetch the blob from the options tab so it lives permanently in this tab
            const response = await fetch(localBlob);
            const blob = await response.blob();
            const dataUri = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            spawnIframe(dataUri, format, 'local-file://' + (filename || 'structure'));
        } catch (err) {
            console.error("Blob Transfer Error:", err);
            if (loadingDiv) loadingDiv.innerText = 'Failed to transfer local file.';
        }
        return;
    }

    // SCENARIO 1: Empty Session (Opened via Popup Button)
    if (!rawUrl) {
        if (loadingDiv) loadingDiv.innerText = 'Loading empty workspace...';
        spawnIframe(null, null, null);
        return;
    }

    // SCENARIO 2: Invalid/Unsafe URL
    if (!isSafeUrl(rawUrl)) {
        if (loadingDiv) loadingDiv.innerText = 'Error: Blocked request to unsafe or missing URL.';
        return;
    }

    // SCENARIO 3: Remote URL with unknown format (Prompt user)
    if (!ALLOWED_FORMATS.has(format)) {
        loadingDiv.innerHTML = `
            <div style="background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center; color: #333; max-width: 400px; margin: 0 auto;">
                <h3 style="margin-top: 0; color: #2c3e50;">Unknown File Format</h3>
                <p style="font-size: 14px; color: #666; margin-bottom: 20px;">We couldn't detect the structure format automatically. Please select it below:</p>
                <select id="format-select" style="padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc; width: 100%; margin-bottom: 15px;">
                    <option value="pdb">PDB</option>
                    <option value="mmcif">mmCIF / CIF</option>
                    <option value="gro">GRO (Gromacs)</option>
                    <option value="sdf">SDF</option>
                    <option value="mol">MOL</option>
                    <option value="xyz">XYZ</option>
                </select>
                <button id="format-confirm" style="background: #2da44e; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 4px; cursor: pointer; width: 100%;">
                    Launch Workspace
                </button>
            </div>
        `;
        
        document.getElementById('format-confirm').addEventListener('click', () => {
            const selectedFormat = document.getElementById('format-select').value;
            loadingDiv.innerHTML = 'Downloading structure securely...';
            bootWorkspace(rawUrl, selectedFormat);
        });
        
    } else {
        // SCENARIO 4: Remote URL with known format (Boot instantly)
        bootWorkspace(rawUrl, format);
    }
});
