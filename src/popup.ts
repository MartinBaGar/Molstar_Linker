// src/popup.ts

import { PermissionsManager } from './permissions.js';
import { isDefaultDomain } from './utils/domains.js';
import { ViewerConfig } from './config.js';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

document.addEventListener('DOMContentLoaded', async () => {
  // -------------------------------------------------------------------------
  // Open the Advanced Options page
  // -------------------------------------------------------------------------
  document.getElementById('open-options')?.addEventListener('click', () => {
    extApi.runtime.openOptionsPage();
  });

  // -------------------------------------------------------------------------
  // Open an empty Mol* workspace in a new tab
  // -------------------------------------------------------------------------
  document.getElementById('open-empty-viewer')?.addEventListener('click', () => {
    extApi.tabs.create({ url: extApi.runtime.getURL(ViewerConfig.viewerUrl) });
    window.close();
  });

  // -------------------------------------------------------------------------
  // Custom domain detection
  // If the current tab's domain is neither a default nor an authorized
  // custom domain, show the "Authorize in Studio" prompt.
  // -------------------------------------------------------------------------
  try {
    const tabs = await new Promise<chrome.tabs.Tab[]>(
      resolve => extApi.tabs.query({ active: true, currentWindow: true }, resolve),
    );
    const tab = tabs[0];

    if (tab?.url?.startsWith('http')) {
      const currentDomain = PermissionsManager.cleanDomain(tab.url);
      const isDefault = isDefaultDomain(currentDomain);

      const storage = await new Promise<{ customDomains: string[] }>(
        resolve => extApi.storage.sync.get({ customDomains: [] }, resolve),
      );

      if (!isDefault && !storage.customDomains.includes(currentDomain)) {
        const promptDiv = document.getElementById('custom-domain-prompt') as HTMLDivElement | null;
        const enableBtn = document.getElementById('enable-domain-btn')   as HTMLButtonElement | null;

        if (promptDiv && enableBtn) {
          promptDiv.style.display   = 'block';
          enableBtn.textContent     = 'Authorize in Studio';
          enableBtn.style.backgroundColor = 'var(--primary)';

          // TODO: See rewrite in todo.org
          enableBtn.addEventListener('click', () => {
            extApi.tabs.create({
              url: `options.html?domain=${encodeURIComponent(currentDomain)}`,
            });
            window.close();
          });
        }
      }
    }
  } catch (err) {
    console.error('Mol* Linker: domain detection failed', err);
  }
});
