// viewer.js

const ALLOWED_URL_SCHEMES = ['https:'];
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
const MAX_BYTES = 25 * 1024 * 1024;

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

// The core fetching and rendering logic, wrapped in a function so we can delay it if needed
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

        chrome.storage.sync.get(null, (storedSettings) => {
            const defaults = AppConfig.getDefaults();
            const finalSettings = { ...defaults };
            for (const key of Object.keys(defaults)) {
                if (key in storedSettings) finalSettings[key] = storedSettings[key];
            }
            if (Array.isArray(storedSettings.customRules)) {
                finalSettings.customRules = storedSettings.customRules;
            }

            if (loadingDiv) loadingDiv.remove();

            const iframe = document.createElement('iframe');
            iframe.src = 'sandbox.html';
            iframe.allow = 'xr-spatial-tracking';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

            iframe.onload = () => {
                iframe.contentWindow.postMessage({
                    action: 'INIT_MOLSTAR',
                    url: dataUri,
                    format: safeFormat,
                    settings: finalSettings,
                    originalUrl: rawUrl
                }, '*');
            };

            document.body.appendChild(iframe);
        });

    } catch (error) {
        console.error("Workspace Fetch Error:", error);
        if (loadingDiv) loadingDiv.innerText = `Failed to load structure file. ${error.message}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('fileUrl');
    const format = urlParams.get('format');
    const loadingDiv = document.getElementById('loading');

    if (!rawUrl || !isSafeUrl(rawUrl)) {
        loadingDiv.innerText = 'Error: Blocked request to unsafe or missing URL.';
        return;
    }

    // If the format is unknown (from the Right-Click menu), prompt the user!
    if (!ALLOWED_FORMATS.has(format)) {
        loadingDiv.innerHTML = `
            <div style="background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center; color: #333;">
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
            loadingDiv.innerHTML = 'Downloading structure securely...'; // Reset UI
            bootWorkspace(rawUrl, selectedFormat);
        });
        
    } else {
        // If we already know the format from the badge click, boot instantly
        bootWorkspace(rawUrl, format);
    }
});
