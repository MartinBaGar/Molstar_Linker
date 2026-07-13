<script lang="ts">
    import { onMount } from "svelte";
    import { PermissionsManager } from "~/core/permissions.js";
    import { isDefaultDomain } from "~/utils/domains.js";
    import { ViewerConfig } from "~/core/config.js";

    let showDomainPrompt = false;
    let currentDomain = "";

    onMount(async () => {
        try {
            const tabs = await browser.tabs.query({
                active: true,
                currentWindow: true,
            });
            const tab = tabs[0];

            if (tab?.url?.startsWith("http")) {
                currentDomain = PermissionsManager.cleanDomain(tab.url);
                const isDefault = isDefaultDomain(currentDomain);

                const storage = await browser.storage.sync.get({
                    customDomains: [],
                });

                if (
                    !isDefault &&
                    !storage.customDomains.includes(currentDomain)
                ) {
                    showDomainPrompt = true;
                }
            }
        } catch (err) {
            console.error("Mol* Linker: domain detection failed", err);
        }
    });

    // 3. Helper functions for clean HTML
    function openViewer() {
        browser.tabs.create({
            url: browser.runtime.getURL(ViewerConfig.viewerUrl),
        });
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

<div class="popup-wrapper">
    <div class="header">
        <h2>Mol* Linker</h2>
    </div>

    <button id="open-empty-viewer" on:click={openViewer}
        >Open Local Viewer</button
    >
    <button id="open-options" on:click={openOptions}>Open Linker Options</button
    >

    {#if showDomainPrompt}
        <div id="custom-domain-prompt">
            <span> Want to use Mol* Linker here? </span>
            <button
                id="enable-domain-btn"
                class="primary"
                on:click={authorizeDomain}
            >
                Authorize This Domain
            </button>
        </div>
    {/if}
</div>

<style>
    .popup-wrapper {
        width: 250px;
        padding: 16px;
        font-size: 16px;
    }

    .header h2 {
        padding-bottom: 0px;
        border-bottom: 1px solid var(--border);
        margin: 0;
        font-weight: 1000;
        font-variant: small-caps;
    }

    button {
        margin-top: 16px;
        font-size: 16px;
    }

    #open-empty-viewer {
        background-color: var(--viewer);
    }

    #custom-domain-prompt {
        display: block;
        margin-top: 20px;
        padding: 10px 10px;
        background-color: #efffef;
        border-top: 1px solid #009f00;
        border-radius: 6px;
        text-align: center;
    }

    #enable-domain-btn {
        margin-top: 10px;
    }

    #enable-domain-btn:hover {
        border-color: green;
        color: green;
    }
</style>
