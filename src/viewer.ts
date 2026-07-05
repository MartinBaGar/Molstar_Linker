import type { InitMolstarMessage } from './types.js';
import { ALL_EXTENSIONS } from './extensions';
import { isSafeUrl } from './utils/links.js';
import { browser } from './utils/browser.js';


const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Iframe management
// ---------------------------------------------------------------------------

let currentIframe: HTMLIFrameElement | null = null;

/**
 * Spawns the sandbox iframe and sends it an INIT_MOLSTAR message once it
 * signals readiness.
 *
 * @param dataUri  base64 data URI to load, or null for an empty workspace
 * @param format   Mol* format string, or null for an empty workspace
 * @param rawUrl   original remote URL (used to extract filename for blob hash)
 */
function spawnIframe(dataUri: string | null, format: string | null, rawUrl: string | null): void {

    const iframe = document.createElement('iframe');
    iframe.src = 'sandbox.html';

    const sandboxReadyListener = (e: MessageEvent): void => {
        if (e.data?.action !== 'SANDBOX_READY' || e.source !== iframe.contentWindow) return;
        window.removeEventListener('message', sandboxReadyListener);

        const payload: InitMolstarMessage = {
            action: 'INIT_MOLSTAR',
            url: dataUri,
            format: format,
            originalUrl: rawUrl,
        };
        iframe.contentWindow!.postMessage(payload, '*');
    };

    const molstarReadyListener = (e: MessageEvent) => {
        if (e.data?.action !== 'MOLSTAR_READY' || e.source !== iframe.contentWindow) return;
        window.removeEventListener('message', molstarReadyListener);
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.remove();
    };

    window.addEventListener('message', sandboxReadyListener);
    window.addEventListener('message', molstarReadyListener);
    document.body.appendChild(iframe);
    currentIframe = iframe;
}

// ---------------------------------------------------------------------------
// Remote file fetch
// ---------------------------------------------------------------------------

async function bootWorkspace(rawUrl: string, safeFormat: string): Promise<void> {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
            <p>Downloading structure securely…</p>
        `;
    }

    try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
            throw new Error('File exceeds the 25 MB size limit.');
        }

        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error('File exceeds the 25 MB size limit.');

        // Firefox privacy-protection sanity check: an XML error page instead of
        // the actual file is a sign that tracking-protection blocked the request.
        const preview = await blob.slice(0, 150).text();
        if (preview.trim().startsWith('<?xml') || preview.includes('<Error>')) {
            throw new Error(
                'Download blocked by browser tracking protection. ' +
                'Please authorize this domain in the Studio settings.',
            );
        }

        const dataUri = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        console.log(dataUri, "\n", safeFormat, "\n", rawUrl)
        spawnIframe(dataUri, safeFormat, rawUrl);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Workspace fetch error:', error);
        const ld = document.getElementById('loading');
        if (ld) {
            ld.innerHTML = `
                <div style="background:white;padding:20px 30px;border-radius:8px;text-align:center;color:#333;max-width:400px;margin:0 auto">
                    <h3 style="margin-top:0;color:#d73a49">Download Blocked</h3>
                    <p style="font-size:14px;color:#555;margin-bottom:0;line-height:1.5">${message}</p>
                </div>
            `;
        }
    }
}

// ---------------------------------------------------------------------------
// Reusable UI helpers
// ---------------------------------------------------------------------------
function showFormatSelectorUI(loadingDiv: HTMLElement, rawUrl: string): void {
    const template = document.getElementById('format-selector-template') as HTMLTemplateElement;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    loadingDiv.innerHTML = '';
    loadingDiv.appendChild(clone);

    document.getElementById('format-confirm')?.addEventListener('click', () => {
        const sel = document.getElementById('format-select') as HTMLSelectElement;
        bootWorkspace(rawUrl, sel.value);
    });
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {

    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('fileUrl');
    const format = urlParams.get('format') ?? '';
    const loadingDiv = document.getElementById('loading');

    // SCENARIO 1: No URL → open an empty workspace
    if (!rawUrl) {
        if (loadingDiv) loadingDiv.innerText = 'Loading empty workspace…';
        spawnIframe(null, null, null);
        return;
    }

    // SCENARIO 2: URL present but unsafe
    if (!isSafeUrl(rawUrl)) {
        if (loadingDiv) loadingDiv.innerText = 'Error: request to unsafe or restricted URL blocked.';
        return;
    }

    // SCENARIO 3: URL present but format unknown (context-menu path)
    if (!ALL_EXTENSIONS.has(format)) {
        if (loadingDiv) showFormatSelectorUI(loadingDiv, rawUrl);
        return;
    }

    // SCENARIO 4: Known format + authorized domain → boot instantly
    bootWorkspace(rawUrl, format);
});

// At module top-level, after browser declaration:
browser.runtime.onMessage.addListener((message) => {
    if (message.action !== 'SETTINGS_UPDATED') return;
    if (!currentIframe?.contentWindow) return;

    currentIframe.contentWindow.postMessage(
        {
            action: 'APPLY_REPRESENTATION',
            settings: message.settings,
        },
        '*'
    );
});
