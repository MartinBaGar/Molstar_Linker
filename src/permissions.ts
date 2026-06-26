import { browser } from './utils/browser.js';

export const PermissionsManager = {

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    cleanDomain(url: string): string {
        try {
            const parsed = new URL(url.includes('://') ? url : `https://${url}`);
            return parsed.hostname;
        } catch {
            return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        }
    },

    getMatchPattern(domain: string): string {
        return `*://${this.cleanDomain(domain)}/*`;
    },

    getScriptId(domain: string): string {
        return `ms-script-${this.cleanDomain(domain).replace(/\./g, '-')}`;
    },

    // ------------------------------------------------------------------
    // requestAndRegister
    // ------------------------------------------------------------------
    async requestAndRegister(url: string): Promise<boolean> {
        const domain = this.cleanDomain(url);
        const pattern = this.getMatchPattern(domain);
        const id = this.getScriptId(domain);

        try {
            // Request permission synchronously within the user gesture
            const granted = await new Promise<boolean>(resolve => {
                browser.permissions.request({ origins: [pattern] }, resolve);
            });

            if (!granted) return false;

            // Chrome Path (MV3)
            if (browser.scripting?.registerContentScripts) {
                const existing = await browser.scripting.getRegisteredContentScripts({ ids: [id] });
                if (existing.length === 0) {
                    // Register for future page loads
                    await browser.scripting.registerContentScripts([{
                        id, matches: [pattern], js: ['content.js'], runAt: 'document_end',
                    }]);

                    // Instantly inject into currently open tabs
                    const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => browser.tabs.query({ url: pattern }, resolve));
                    for (const tab of tabs) {
                        if (tab.id) {
                            await browser.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content.js']
                            }).catch((err) => console.warn('Could not inject into open tab:', err));
                        }
                    }
                }
            }
            // Firefox Path (MV2)
            else {
                const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => browser.tabs.query({ url: pattern }, resolve));
                for (const tab of tabs) {
                    if (tab.id) {
                        await new Promise<void>(resolve => browser.tabs.executeScript(tab.id!, { file: 'content.js' }, () => resolve()));
                    }
                }
            }

            // Persist domain in storage
            const data = await new Promise<{ customDomains: string[] }>(resolve =>
                browser.storage.sync.get({ customDomains: [] }, resolve)
            );
            if (!data.customDomains.includes(domain)) {
                data.customDomains.push(domain);
                await new Promise<void>(resolve => browser.storage.sync.set({ customDomains: data.customDomains }, resolve));
            }

            return true;
        } catch (err) {
            console.error('Molstar Linker — permission error:', err);
            return false;
        }
    },

    // ------------------------------------------------------------------
    // revokeAndUnregister
    // ------------------------------------------------------------------
    async revokeAndUnregister(url: string): Promise<boolean> {
        const domain = this.cleanDomain(url);
        const pattern = this.getMatchPattern(domain);
        const id = this.getScriptId(domain);

        try {
            // 1. Unregister script (Chrome only, safely ignored in Firefox)
            if (browser.scripting?.unregisterContentScripts) {
                await browser.scripting.unregisterContentScripts({ ids: [id] }).catch(() => { });
            }

            // 2. Remove the actual browser permission (Both browsers)
            await new Promise<boolean>(resolve => browser.permissions.remove({ origins: [pattern] }, resolve));

            // 3. Remove from local storage (Both browsers)
            const data = await new Promise<{ customDomains: string[] }>(resolve =>
                browser.storage.sync.get({ customDomains: [] }, resolve)
            );
            await new Promise<void>(resolve => browser.storage.sync.set({
                customDomains: data.customDomains.filter(d => d !== domain),
            }, resolve));

            return true;
        } catch (err) {
            console.error('Molstar Linker — revoke error:', err);
            return false;
        }
    },
};
