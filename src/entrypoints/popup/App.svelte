<script lang="ts">
    import { onMount } from 'svelte';
    import { PermissionsManager } from '~/permissions.js';
    import { isDefaultDomain } from '~/utils/domains.js';
    import { ViewerConfig } from '~/config.js';

    // 1. Top-level State (HTML can see these!)
    let showDomainPrompt = false;
    let currentDomain = '';

    // 2. Ensure the callback is explicitly 'async'
    onMount(async () => {
        try {
            const tabs = await new Promise<chrome.tabs.Tab[]>(
                resolve => browser.tabs.query({ active: true, currentWindow: true }, resolve),
            );
            const tab = tabs[0];

            if (tab?.url?.startsWith('http')) {
                currentDomain = PermissionsManager.cleanDomain(tab.url);
                const isDefault = isDefaultDomain(currentDomain);

                const storage = await new Promise<{ customDomains: string[] }>(
                    resolve => browser.storage.sync.get({ customDomains: [] }, resolve),
                );

                if (!isDefault && !storage.customDomains.includes(currentDomain)) {
                    showDomainPrompt = true;
                }
            }
        } catch (err) {
            console.error('Mol* Linker: domain detection failed', err);
        }
    });

    // 3. Helper functions for clean HTML
    function openViewer() {
        browser.tabs.create({ url: browser.runtime.getURL(ViewerConfig.viewerUrl) });
        window.close();
    }

    function openOptions() {
        browser.runtime.openOptionsPage();
        window.close();
    }

    async function authorizeDomain() {
        if (currentDomain) {
            await PermissionsManager.requestAndRegister(currentDomain);
            window.close();
        }
    }
</script>

<div class="header">
    <h2>Mol* Linker</h2>
</div>

<button id="open-empty-viewer" on:click={openViewer}>Open Local Viewer</button>
<button id="open-options" on:click={openOptions}>Open Linker Options</button>

{#if showDomainPrompt}
    <div id="custom-domain-prompt">
        <p>
            Want to use Mol* Linker here?
        </p>
        <button id="enable-domain-btn" class="primary" on:click={authorizeDomain}>
            Authorize This Domain
        </button>
    </div>
{/if}
