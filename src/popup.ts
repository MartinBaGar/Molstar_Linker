import { PermissionsManager } from './permissions.js';
import { isDefaultDomain } from './utils/domains.js';
import { ViewerConfig } from './config.js';
import { browser } from './utils/browser.js';
import './styles/popup.css';

document.addEventListener('DOMContentLoaded', async () => {
    // -------------------------------------------------------------------------
    // Open the Advanced Options page
    // -------------------------------------------------------------------------
    document.getElementById('open-options')?.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });

    // -------------------------------------------------------------------------
    // Open an empty Mol* workspace in a new tab
    // -------------------------------------------------------------------------
    document.getElementById('open-empty-viewer')?.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL(ViewerConfig.viewerUrl) });
        window.close();
    });

    // -------------------------------------------------------------------------
    // Custom domain detection
    // -------------------------------------------------------------------------
    try {
        const tabs = await new Promise<chrome.tabs.Tab[]>(
            resolve => browser.tabs.query({ active: true, currentWindow: true }, resolve),
        );
        const tab = tabs[0];

        if (tab?.url?.startsWith('http')) {
            const currentDomain = PermissionsManager.cleanDomain(tab.url);
            const isDefault = isDefaultDomain(currentDomain);

            const storage = await new Promise<{ customDomains: string[] }>(
                resolve => browser.storage.sync.get({ customDomains: [] }, resolve),
            );

            if (!isDefault && !storage.customDomains.includes(currentDomain)) {
                const promptDiv = document.getElementById('custom-domain-prompt') as HTMLDivElement | null;
                const enableBtn = document.getElementById('enable-domain-btn') as HTMLButtonElement | null;

                if (promptDiv && enableBtn) {
                    promptDiv.style.display = 'block';

                    enableBtn.addEventListener('click', () => {
                        try {
                            PermissionsManager.requestAndRegister(currentDomain);

                            window.close();
                        } catch (error) {
                            console.error('Failed to authorize domain:', error);
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Mol* Linker: domain detection failed', err);
    }
});
