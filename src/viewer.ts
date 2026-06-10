// src/viewer.ts

import type { InitMolstarMessage } from './types.js';
import { ALL_EXTENSIONS } from './extensions';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

// ---------------------------------------------------------------------------
// Security constants
// ---------------------------------------------------------------------------
const ALLOWED_URL_SCHEMES = new Set(['https:']);

// SSRF protection: block requests to private/loopback/link-local ranges
const BLOCKED_RANGES = [
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^\[?::1\]?$/,
  /^\[?fc[0-9a-f]{2}:/i,
  /^localhost$/i,
];

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function isSafeUrl(urlStr: string): boolean {
  try {
    const { protocol, hostname } = new URL(urlStr);
    return ALLOWED_URL_SCHEMES.has(protocol) &&
           !BLOCKED_RANGES.some(r => r.test(hostname));
  } catch {
    return false;
  }
}

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
function spawnIframe(
  dataUri: string | null,
  format:  string | null,
  rawUrl:  string | null,
): void {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.remove();

  // Replace any existing iframe (e.g. user drops a second file)
  if (currentIframe) {
    currentIframe.remove();
    currentIframe = null;
  }

    const iframe = document.createElement('iframe');
    iframe.src = 'sandbox.html';
    iframe.style.cssText = 'width:100%; height:100%; border:none;';

    // FIX F1: Sandboxed extension pages report origin 'null' (the string).
    // postMessage(data, 'null') throws a SyntaxError. We use '*' as the
    // target origin but guard strictly on e.source === iframe.contentWindow
    // so only our own sandbox can trigger the INIT_MOLSTAR branch.
    const messageListener = (e: MessageEvent): void => {
      if (e.data?.action !== 'SANDBOX_READY' || e.source !== iframe.contentWindow) return;
      // Remove before sending so a second SANDBOX_READY doesn't re-init
      window.removeEventListener('message', messageListener);

      const payload: InitMolstarMessage = {
        action:      'INIT_MOLSTAR',
        url:         dataUri,
        format:      format,
        originalUrl: rawUrl,
        // TODO Pass filename so it is correctly labelled in the tree
      };
      iframe.contentWindow!.postMessage(payload, '*');
    };

    // Listener must be registered BEFORE the iframe is appended so we never
    // miss the SANDBOX_READY signal.
    window.addEventListener('message', messageListener);
    document.body.appendChild(iframe);
    currentIframe = iframe;
}

// ---------------------------------------------------------------------------
// Remote file fetch
// ---------------------------------------------------------------------------

async function bootWorkspace(rawUrl: string, safeFormat: string): Promise<void> {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.innerText = 'Downloading structure securely…';

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

    spawnIframe(dataUri, safeFormat, rawUrl);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Workspace fetch error:', error);
    const ld = document.getElementById('loading');
    if (ld) {
      ld.innerHTML = `
        <div style="background:white;padding:20px 30px;border-radius:8px;
                    box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                    color:#333;max-width:400px;margin:0 auto">
          <h3 style="margin-top:0;color:#d73a49">Download Blocked</h3>
          <p style="font-size:14px;color:#555;margin-bottom:0;line-height:1.5">${message}</p>
        </div>`;
    }
  }
}

// ---------------------------------------------------------------------------
// Reusable UI helpers
// ---------------------------------------------------------------------------

function showUnauthorizedDomainUI(
  loadingDiv: HTMLElement,
  targetDomain: string,
): void {
  loadingDiv.innerHTML = `
    <div style="background:white;padding:20px 30px;border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                color:#333;max-width:400px;margin:0 auto">
      <h3 style="margin-top:0;color:#d73a49">Unauthorized Domain</h3>
      <p style="font-size:14px;color:#666;margin-bottom:20px">
        Trying to open a link from <strong>${targetDomain}</strong>.<br><br>
        Would you like to authorize this domain in the Studio?
      </p>
      <div style="display:flex;gap:10px">
        <button id="auth-cancel"
          style="background:#eee;color:#333;border:none;padding:10px;
                 font-weight:bold;border-radius:4px;cursor:pointer;flex:1">
          Cancel
        </button>
        <button id="auth-confirm"
          style="background:#0969da;color:white;border:none;padding:10px;
                 font-weight:bold;border-radius:4px;cursor:pointer;flex:1">
          Yes, Authorize
        </button>
      </div>
    </div>`;

  document.getElementById('auth-confirm')?.addEventListener('click', () => {
    extApi.tabs.create({ url: `options.html?domain=${encodeURIComponent(targetDomain)}` });
    window.close();
  });
  document.getElementById('auth-cancel')?.addEventListener('click', () => {
    loadingDiv.innerHTML = `
      <div style="background:white;padding:20px 30px;border-radius:8px;
                  box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                  color:#d73a49;max-width:400px;margin:0 auto;
                  font-weight:bold;font-size:16px">
        Not authorized. Operation cancelled.
      </div>`;
  });
}

function showFormatSelectorUI(
  loadingDiv: HTMLElement,
  rawUrl: string,
): void {
  loadingDiv.innerHTML = `
    <div style="background:white;padding:20px 30px;border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                color:#333;max-width:400px;margin:0 auto">
      <h3 style="margin-top:0;color:#2c3e50">Unknown File Format</h3>
      <p style="font-size:14px;color:#666;margin-bottom:20px">
        Format could not be detected automatically.<br>Please select it below:
      </p>
      <select id="format-select"
        style="padding:8px;font-size:14px;border-radius:4px;
               border:1px solid #ccc;width:100%;margin-bottom:15px">
        <option value="pdb">PDB</option>
        <option value="mmcif">mmCIF / CIF</option>
        <option value="gro">GRO (Gromacs)</option>
        <option value="sdf">SDF</option>
        <option value="mol">MOL</option>
        <option value="mol2">MOL2</option>
        <option value="xyz">XYZ</option>
        <option value="bcif">BCIF (binary CIF)</option>
      </select>
      <button id="format-confirm"
        style="background:#2da44e;color:white;border:none;
               padding:10px 20px;font-weight:bold;border-radius:4px;
               cursor:pointer;width:100%">
        Launch Workspace
      </button>
    </div>`;

  document.getElementById('format-confirm')?.addEventListener('click', () => {
    const sel = document.getElementById('format-select') as HTMLSelectElement;
    bootWorkspace(rawUrl, sel.value);
  });
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {

  const urlParams  = new URLSearchParams(window.location.search);
  const rawUrl     = urlParams.get('fileUrl');
  const format     = urlParams.get('format') ?? '';
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
    const targetDomain = new URL(rawUrl).hostname.replace(/^www\./, '');
    const DEFAULT_DOMAINS = ['github.com', 'raw.githubusercontent.com', 'gitlab.com', 'rcsb.org', 'alphafold.ebi.ac.uk'];
    const isDefault = DEFAULT_DOMAINS.some(d => targetDomain.includes(d));

    if (!isDefault) {
      const storageData = await new Promise<{ customDomains: string[] }>(
        resolve => extApi.storage.sync.get({ customDomains: [] }, resolve),
      );
      if (!storageData.customDomains.includes(targetDomain)) {
        if (loadingDiv) showUnauthorizedDomainUI(loadingDiv, targetDomain);
        return;
      }
    }

    if (loadingDiv) showFormatSelectorUI(loadingDiv, rawUrl);
    return;
  }

  // SCENARIO 5: Known format + authorized domain → boot instantly
  bootWorkspace(rawUrl, format);
});

// At module top-level, after extApi declaration:
extApi.runtime.onMessage.addListener((message) => {
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
