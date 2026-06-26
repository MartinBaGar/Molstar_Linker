import { ViewerConfig } from "./config.js";
import { isSafeUrl, resolveUrl, findExtInText } from './utils/links.js';
import { browser } from './utils/browser.js';
import { ALL_EXTENSIONS } from './extensions.js';

// ---------------------------------------------------------------------------
// FEATURE 1: Context menu — "Open in Mol* Workspace"
// ---------------------------------------------------------------------------
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


// ---------------------------------------------------------------------------
// Startup Script Registration
// ---------------------------------------------------------------------------
browser.runtime.onStartup.addListener(reRegisterCustomDomains);
browser.runtime.onInstalled.addListener(reRegisterCustomDomains);

async function reRegisterCustomDomains(): Promise<void> {
    const data = await browser.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
    if (data.customDomains.length === 0) return;

    for (const domain of data.customDomains) {
        const pattern = `*://${domain}/*`;
        const id = `ms-script-${domain.replace(/\./g, '-')}`;
        try {
            if (browser.scripting?.registerContentScripts) {
                // Chrome MV3 path
                const existing = await browser.scripting.getRegisteredContentScripts({ ids: [id] });
                if (existing.length === 0) {
                    await browser.scripting.registerContentScripts([{
                        id, matches: [pattern], js: ['content.js'], runAt: 'document_end',
                    }]);
                }
            } else if ((browser as any).contentScripts?.register) {
                // Firefox MV2 path
                await (browser as any).contentScripts.register({
                    matches: [pattern],
                    js: [{ file: 'content.js' }],
                    runAt: 'document_end'
                });
            }
        } catch (err) {
            console.warn(`Mol* Linker — failed to re-register ${domain}:`, err);
        }
    }
}
