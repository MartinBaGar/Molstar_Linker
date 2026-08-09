import { isSafeUrl, resolveUrl, findExtInText } from '~/utils/links.js';
import { ViewerConfig } from "~/core/config.js";
import { ALL_EXTENSIONS } from '~/core/extensions.js';

if (typeof browser !== 'undefined' && !browser.commands) {
    (browser as any).commands = {
        onCommand: { addListener: () => {} }
    };
}

export default defineBackground(() => {
    // ---------------------------------------------------------------------------
    // FEATURE 1: Context menu — "Open in Mol* Workspace"
    // ---------------------------------------------------------------------------

    if (browser.contextMenus) {
        browser.runtime.onInstalled.addListener(() => {
            browser.contextMenus.create({
                id: 'open-molstar',
                title: 'Open in Mol* Workspace',
                contexts: ['link'],
            });
        });

        browser.contextMenus.onClicked.addListener((info: any, _tab: any) => {
            if (info.menuItemId !== 'open-molstar' || !info.linkUrl) return;

            if (!isSafeUrl(info.linkUrl)) {
                console.warn('Mol* Linker: blocked unsafe context-menu URL:', info.linkUrl);
                return;
            }

            const extension = findExtInText(info.linkUrl) || "unknown";
            const url = new URL(info.linkUrl);
            const resolvedUrl = resolveUrl(url);

            const viewerUrl = new URL(browser.runtime.getURL(ViewerConfig.viewerUrl));
            viewerUrl.searchParams.append('fileUrl', resolvedUrl);
            viewerUrl.searchParams.append('format', extension);

            browser.tabs.create({ url: viewerUrl.toString() });
        });
    }


    // ---------------------------------------------------------------------------
    // FEATURE 2: Message router — handles "open_viewer" from content scripts
    // ---------------------------------------------------------------------------
    browser.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender) => {
        if (message.action !== 'open_viewer') return;

        // Must come from a real tab
        if (!sender.tab?.id) return;

        // Validate URL and format before building the viewer URL
        if (!message.url || !isSafeUrl(message.url)) return;
        if (!ALL_EXTENSIONS.has(message.format)) return;

        const viewerUrl = browser.runtime.getURL(
            `${ViewerConfig.viewerUrl}?fileUrl=${encodeURIComponent(message.url)}&format=${encodeURIComponent(message.format)}`,
        );
        browser.tabs.create({ url: viewerUrl });
    });


    // --- HELPER 1: Register script for future page loads ---
    async function registerScriptForDomain(domain: string, pattern: string): Promise<void> {
        const id = `ms-script-${domain.replace(/\./g, '-')}`;
        try {
            if (browser.scripting?.registerContentScripts) {
                // Chrome MV3 Path
                const existing = await browser.scripting.getRegisteredContentScripts({ ids: [id] });
                if (existing.length === 0) {
                    await browser.scripting.registerContentScripts([{
                        id, matches: [pattern], js: ['content-scripts/content.js'], runAt: 'document_end',
                    }]);
                }
            } else if ((browser as any).contentScripts?.register) {
                // Firefox MV2 Path
                await (browser as any).contentScripts.register({
                    matches: [pattern], js: [{ file: 'content-scripts/content.js' }], runAt: 'document_end'
                });
            }
        } catch (err) {
            console.warn(`Mol* Linker — failed to register script for ${domain}:`, err);
        }
    }

    // --- HELPER 2: Inject script into already open tabs (no refresh needed) ---
    async function injectScriptIntoExistingTabs(pattern: string): Promise<void> {
        try {
            const tabs = await browser.tabs.query({ url: pattern });
            for (const tab of tabs) {
                if (!tab.id) continue;
                if (browser.scripting?.executeScript) {
                    await browser.scripting.executeScript({
                        target: { tabId: tab.id }, files: ['content-scripts/content.js']
                    }).catch(() => { });
                } else {
                    await (browser.tabs as any).executeScript(tab.id, { file: 'content-scripts/content.js' }).catch(() => { });
                }
            }
        } catch (err) {
            console.warn(`Mol* Linker — failed to inject into active tabs for ${pattern}:`, err);
        }
    }

    // ===========================================================================
    // SCENARIO 1: Browser Startup / Extension Update
    // ===========================================================================
    browser.runtime.onStartup.addListener(reRegisterCustomDomains);
    browser.runtime.onInstalled.addListener(reRegisterCustomDomains);

    async function reRegisterCustomDomains(): Promise<void> {
        const data = await browser.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };

        for (const domain of data.customDomains) {
            const pattern = `*://${domain}/*`;
            // Just register for future loads (no need to active-inject on browser startup)
            await registerScriptForDomain(domain, pattern);
        }
    }

    // ===========================================================================
    // SCENARIO 2: User Authorizes a New Domain via Popup
    // ===========================================================================
    browser.permissions.onAdded.addListener(async (permissions) => {
        if (!permissions.origins) return;

        for (const origin of permissions.origins) {
            const domain = origin.replace(/^\*:\/\//, '').replace(/\/\*$/, '');
            if (!domain) continue;

            try {
                // 1. Save to storage so the startup script remembers it next time
                const data = await browser.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
                if (!data.customDomains.includes(domain)) {
                    data.customDomains.push(domain);
                    await browser.storage.sync.set({ customDomains: data.customDomains });
                }

                // 2. Register for future loads
                await registerScriptForDomain(domain, origin);

                // 3. Inject NOW so badges appear immediately without refreshing
                await injectScriptIntoExistingTabs(origin);

            } catch (err) {
                console.error('Mol* Linker — Background permission injection failed:', err);
            }
        }
    });
});
