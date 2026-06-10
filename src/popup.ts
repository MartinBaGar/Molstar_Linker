// src/popup.ts

import { PermissionsManager } from './permissions.js';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

document.addEventListener('DOMContentLoaded', async () => {
  // -------------------------------------------------------------------------
  // 3. Open the Advanced Options page
  // -------------------------------------------------------------------------
  document.getElementById('open-options')?.addEventListener('click', () => {
    extApi.runtime.openOptionsPage();
  });

  // -------------------------------------------------------------------------
  // 4. Open an empty Mol* workspace in a new tab
  // -------------------------------------------------------------------------
  document.getElementById('open-empty-viewer')?.addEventListener('click', () => {
    extApi.tabs.create({ url: extApi.runtime.getURL('viewer.html') });
    window.close();
  });

  // -------------------------------------------------------------------------
  // 5. Custom domain detection
  //    If the current tab's domain is neither a default nor an authorized
  //    custom domain, show the "Authorize in Studio" prompt.
  // -------------------------------------------------------------------------
  try {
    const tabs = await new Promise<chrome.tabs.Tab[]>(
      resolve => extApi.tabs.query({ active: true, currentWindow: true }, resolve),
    );
    const tab = tabs[0];

    if (tab?.url?.startsWith('http')) {
      const currentDomain = PermissionsManager.cleanDomain(tab.url);
      const DEFAULT_DOMAINS = ['github.com', 'raw.githubusercontent.com', 'gitlab.com', 'rcsb.org', 'alphafold.ebi.ac.uk'];
      const isDefault = DEFAULT_DOMAINS.some(d => currentDomain.includes(d));

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
