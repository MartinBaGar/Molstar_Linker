// src/permissions.ts
/// <reference types="chrome" />
export const PermissionsManager = {
    // Pick the right API object at runtime (Firefox uses `browser`, Chrome uses `chrome`)
    core: (typeof browser !== 'undefined' ? browser : chrome),
    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    cleanDomain(url) {
        try {
            const parsed = new URL(url.includes('://') ? url : `https://${url}`);
            return parsed.hostname;
        }
        catch {
            return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        }
    },
    getMatchPattern(domain) {
        return `*://${this.cleanDomain(domain)}/*`;
    },
    getScriptId(domain) {
        return `ms-script-${this.cleanDomain(domain).replace(/\./g, '-')}`;
    },
    // ------------------------------------------------------------------
    // requestAndRegister
    //
    // IMPORTANT (Firefox): We must call permissions.request() IMMEDIATELY
    // inside a user-gesture handler. Any `await` before this call kills the
    // user-gesture context and the permission dialog will be silently blocked.
    // ------------------------------------------------------------------
    async requestAndRegister(url) {
        const domain = this.cleanDomain(url);
        const pattern = this.getMatchPattern(domain);
        const id = this.getScriptId(domain);
        try {
            // ① Request permission synchronously within the user gesture
            const granted = await new Promise(resolve => {
                this.core.permissions.request({ origins: [pattern] }, resolve);
            });
            if (!granted)
                return false;
            // ② Register the content script if not already registered
            const existing = await this.core.scripting.getRegisteredContentScripts({ ids: [id] });
            if (existing.length === 0) {
                await this.core.scripting.registerContentScripts([{
                        id,
                        matches: [pattern],
                        js: ['config.js', 'mvs-builder.js', 'content.js'],
                        runAt: 'document_end',
                    }]);
            }
            // ③ Persist the domain in storage so the UI can show it
            const data = await this.core.storage.sync.get({ customDomains: [] });
            if (!data.customDomains.includes(domain)) {
                data.customDomains.push(domain);
                await this.core.storage.sync.set({ customDomains: data.customDomains });
            }
            return true;
        }
        catch (err) {
            console.error('Molstar Linker — permission error:', err);
            return false;
        }
    },
    // ------------------------------------------------------------------
    // revokeAndUnregister
    // ------------------------------------------------------------------
    async revokeAndUnregister(url) {
        const domain = this.cleanDomain(url);
        const pattern = this.getMatchPattern(domain);
        const id = this.getScriptId(domain);
        try {
            await this.core.scripting.unregisterContentScripts({ ids: [id] }).catch(() => { });
            await new Promise(resolve => this.core.permissions.remove({ origins: [pattern] }, resolve));
            const data = await this.core.storage.sync.get({ customDomains: [] });
            await this.core.storage.sync.set({
                customDomains: data.customDomains.filter(d => d !== domain),
            });
            return true;
        }
        catch {
            return false;
        }
    },
};
