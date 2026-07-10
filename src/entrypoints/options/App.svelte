<script lang="ts">
    import { onMount } from 'svelte';
    import { AppConfig } from '~/core/config.js';
    import { PermissionsManager } from '~/core/permissions.js';
    import type { CustomRule } from '~/types/index.js';
    import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';

    // --- 1. STATE VARIABLES ---
    let appVersion = '';
    let customRules: CustomRule[] = [];
    let customDomains: string[] = [];
    let newDomainInput = '';

    let hasUnsavedChanges = false;
    let showSavedMessage = false;

    // Constants
    const SCRIPT_LANGUAGES = ['mol-script', 'pymol', 'vmd', 'jmol'];
    const REP_TYPES = Object.keys(StructureRepresentationRegistry.BuiltIn);

    // --- 2. LIFECYCLE (Runs when page opens) ---
    onMount(async () => {
        appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev';
        await refreshDomains();
    });

    // --- 3. LOGIC / FUNCTIONS ---
    async function refreshDomains() {
        const data = await browser.storage.sync.get({ customDomains: [] });
        customDomains = data.customDomains as string[];
    }

    async function addDomain() {
        const dom = newDomainInput.trim();
        if (!dom) return;
        if (await PermissionsManager.requestAndRegister(dom)) {
            newDomainInput = '';
            await refreshDomains();
        }
    }

    async function removeDomain(domain: string) {
        if (confirm(`Revoke access for ${domain}?`)) {
            await PermissionsManager.revokeAndUnregister(domain);
            await refreshDomains();
        }
    }

    function addRule() {
        const newRule: CustomRule = {
            meta: { id: Date.now().toString(), name: 'New Rule' },
            repprop: { type: 'cartoon' as any },
            selection: { script: { expression: '', language: 'mol-script' } }
        };
        customRules = [...customRules, newRule];
        hasUnsavedChanges = true;
    }

    function removeRule(index: number) {
        customRules = customRules.filter((_, i) => i !== index);
        hasUnsavedChanges = true;
    }

    function triggerUnsaved() {
        hasUnsavedChanges = true;
    }

    function saveSettings() {
        const settings = { ...AppConfig.getDefaults(), customRules };

        // Send settings to other tabs (matching your Vanilla logic)
        browser.runtime.sendMessage({
            action: 'SETTINGS_UPDATED',
            settings: settings,
        }).catch(() => {});

        hasUnsavedChanges = false;
        showSavedMessage = true;
        setTimeout(() => (showSavedMessage = false), 2000);
    }
</script>

<main class="container" on:input={triggerUnsaved}>
    <header class="doc-header">
        <div class="brand">
            <h1>Mol* Linker Studio <span class="version">v{appVersion}</span></h1>
            <p class="subtitle">Enhance your Mol* experience with custom rules and domain management.</p>
        </div>
        <nav class="links">
            <a href="https://molstar.org/" target="_blank">Mol*</a>
            <a href="https://github.com/MartinBaGar/molstar_linker" target="_blank">GitHub</a>
            <a href="https://github.com/MartinBaGar/molstar_linker/issues" target="_blank">Report Bug</a>
            <a href="https://ko-fi.com/mabagar" target="_blank" class="donate">☕ Donate</a>
        </nav>
    </header>

    <section class="panel">
        <h2>Custom Component Rules</h2>
        <p class="desc">Create dynamic rules to color specific chains, residues, or atomic selections.</p>

        <div id="custom-rules-container">
            {#each customRules as rule, i (rule.meta?.id)}
                <details class="target-card custom-rule-card rule-card" open>
                    <summary>
                        <span class="rule-title-display">{rule.meta?.name || 'Unnamed Rule'}</span>
                        <button class="btn-danger delete-rule-btn" on:click|preventDefault|stopPropagation={() => removeRule(i)}>Delete</button>
                    </summary>
                    <div class="card-content form-grid">
                        <div class="form-group">
                            <label>Rule Name</label>
                            <input type="text" bind:value={rule.meta!.name}>
                        </div>
                        <div class="form-group">
                            <label>Representation</label>
                            <select bind:value={rule.repprop.type}>
                                {#each REP_TYPES as rep}
                                    <option value={rep}>{rep.charAt(0).toUpperCase() + rep.slice(1)}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Language</label>
                            <select bind:value={rule.selection!.script!.language}>
                                {#each SCRIPT_LANGUAGES as lang}
                                    <option value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Selection Expression</label>
                            <input type="text" bind:value={rule.selection!.script!.expression} placeholder="e.g., chain A and resi 10-20">
                        </div>
                    </div>
                </details>
            {/each}
        </div>

        <button on:click={addRule} class="btn-secondary">+ Add New Rule</button>
    </section>

    <section class="panel">
        <h2>Managed Custom Domains</h2>
        <p class="desc">Private GitLab or institutional domains you have authorized.</p>

        <div class="domain-list">
            {#if customDomains.length === 0}
                <p class="empty-state">No custom domains authorized yet.</p>
            {:else}
                {#each customDomains as domain}
                    <div class="domain-row">
                        <span>🌐 <strong>{domain}</strong></span>
                        <button class="btn-danger remove-domain-btn" on:click={() => removeDomain(domain)}>Remove</button>
                    </div>
                {/each}
            {/if}
        </div>

        <div class="domain-input-group">
            <input type="text" bind:value={newDomainInput} placeholder="e.g., gitlab.my-lab.org">
            <button on:click={addDomain} class="btn-secondary">+ Add Domain</button>
        </div>
    </section>
</main>

<div class="bottom-action-bar" class:visible={hasUnsavedChanges || showSavedMessage}>
    {#if showSavedMessage}
        <span id="status">✓ Applied to Mol*!</span>
    {:else}
        <span id="status">Unsaved changes</span>
        <button on:click={saveSettings} class="btn-primary pill-btn">Apply Settings to Mol*</button>
    {/if}
</div>
