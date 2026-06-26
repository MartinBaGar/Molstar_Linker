// utils/browser.ts
declare global {
    var browser: typeof chrome | undefined;
}

if (!globalThis.browser) {
    globalThis.browser = chrome;
}

export const browser = globalThis.browser as typeof chrome;
