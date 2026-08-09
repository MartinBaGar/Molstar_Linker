<script lang="ts">
    import { onMount } from "svelte";
    import { AppConfig } from "~/core/config.js";
    import { PermissionsManager } from "~/core/permissions.js";
    import type { CustomRule } from "~/types/index.js";
    import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";

    // --- 1. STATE VARIABLES ---
    let appVersion = "";
    let customRules: CustomRule[] = [];
    let customDomains: string[] = [];
    let newDomainInput = "";

    let hasUnsavedChanges = false;
    let showSavedMessage = false;

    const SCRIPT_LANGUAGES = ["mol-script", "pymol", "vmd", "jmol"];
    const REP_TYPES = Object.keys(StructureRepresentationRegistry.BuiltIn);

    // --- 2. LIFECYCLE (Runs when page opens) ---
    onMount(async () => {
        appVersion =
            typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "Dev";
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
            newDomainInput = "";
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
            meta: { id: Date.now().toString(), name: "New Rule" },
            repprop: { type: "cartoon" as any },
            selection: { script: { expression: "", language: "mol-script" } },
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

        browser.runtime
            .sendMessage({
                action: "SETTINGS_UPDATED",
                settings: settings,
            })
            .catch(() => {});

        hasUnsavedChanges = false;
        showSavedMessage = true;
        setTimeout(() => (showSavedMessage = false), 2000);
    }
</script>

<main class="container" on:input={triggerUnsaved}>
    <header class="doc-header">
        <div class="brand">
            <h1>
                Mol* Linker Studio <span class="version">v{appVersion}</span>
            </h1>
            <p>
                Enhance your Mol* experience with custom rules and domain
                management.
            </p>
        </div>
        <nav class="links">
            <a href="https://molstar.org/" target="_blank">Mol*</a>
            <a
                href="https://github.com/MartinBaGar/molstar_linker"
                target="_blank">GitHub</a
            >
            <a
                href="https://github.com/MartinBaGar/molstar_linker/issues"
                target="_blank">Report Bug</a
            >
            <a class="donate" href="https://ko-fi.com/mabagar" target="_blank"
                >☕ Donate</a
            >
        </nav>
    </header>

    <section class="panel">
        <h2>Custom Component Rules</h2>
        <p class="desc">
            Create dynamic rules to color specific chains, residues, or atomic
            selections.
        </p>

        <div id="custom-rules-container">
            {#each customRules as rule, i (rule.meta?.id)}
                <details class="rule-card" open>
                    <summary>
                        <span class="rule-title-display">{rule.meta?.name}</span
                        >
                        <button
                            class="remove-btn"
                            on:click|preventDefault|stopPropagation={() =>
                                removeRule(i)}>Remove</button
                        >
                    </summary>
                    <div class="card-content form-grid">
                        <div class="form-group">
                            <label for="rule-name">Rule Name</label>
                            <input type="text" bind:value={rule.meta!.name} />
                        </div>
                        <div class="form-group">
                            <label for="representation">Representation</label>
                            <select bind:value={rule.repprop.type}>
                                {#each REP_TYPES as rep}
                                    <option value={rep}
                                        >{rep.charAt(0).toUpperCase() +
                                            rep.slice(1)}</option
                                    >
                                {/each}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="language">Language</label>
                            <select
                                bind:value={rule.selection!.script!.language}
                            >
                                {#each SCRIPT_LANGUAGES as lang}
                                    <option value={lang}
                                        >{lang.charAt(0).toUpperCase() +
                                            lang.slice(1)}</option
                                    >
                                {/each}
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label for="expression">Selection Expression</label>
                            <input
                                type="text"
                                bind:value={rule.selection!.script!.expression}
                                placeholder="e.g., chain A and resi 10-20"
                            />
                        </div>
                    </div>
                </details>
            {/each}
        </div>
        <button id="add-rule-btn" on:click={addRule}>+ Add New Rule</button>
    </section>

    <section class="panel">
        <h2>Managed Custom Domains</h2>
        <p class="desc">
            Private GitLab or institutional domains you have authorized.
        </p>

        <div class="domain-list">
            {#if customDomains.length === 0}
                <p class="empty-state">No custom domains authorized yet.</p>
            {:else}
                {#each customDomains as domain}
                    <div class="domain-row">
                        <span><strong>{domain}</strong></span>
                        <button
                            class="remove-btn"
                            on:click={() => removeDomain(domain)}>Remove</button
                        >
                    </div>
                {/each}
            {/if}
        </div>

        <div class="domain-input-group">
            <input
                type="text"
                bind:value={newDomainInput}
                placeholder="e.g., gitlab.my-lab.org"
            />
            <button on:click={addDomain} id="enable-domain-btn"
                >+ Add Domain</button
            >
        </div>
    </section>
</main>

<div
    class="bottom-action-bar"
    class:visible={hasUnsavedChanges || showSavedMessage}
>
    {#if showSavedMessage}
        <span id="status">✓ Applied to Mol* !</span>
    {:else}
        <span id="status">Unsaved changes</span>
        <button on:click={saveSettings} class="btn-primary pill-btn"
            >Apply Settings to Mol*</button
        >
    {/if}
</div>

<style>
    section {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    /* Main Container */
    .container {
        max-width: 800px;
        margin: 40px auto;
        padding: 0 20px;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    /* Document Header */
    .doc-header {
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 2px solid var(--border-color);
    }

    .doc-header h1 {
        margin: 0 0 4px 0;
        font-size: 28px;
        letter-spacing: -0.5px;
    }

    .doc-header p {
        margin: 0 0 16px 0;
        color: var(--text-muted);
        font-size: 15px;
    }

    .version {
        font-size: 14px;
        color: var(--text-muted);
        background: #e1e4e8;
        padding: 2px 8px;
        border-radius: calc(var(--border-radius) / 2);
        vertical-align: middle;
        font-weight: 500;
    }

    .links {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
    }

    .links a {
        color: var(--text-muted);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: color 0.2s;
    }

    .links a.donate {
        color: #d73a49;
    }

    .panel {
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: calc(var(--border-radius) / 1);
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    .panel h2 {
        margin: 0;
        font-size: 18px;
    }

    .panel .desc {
        margin: 0 0 20px 0;
        font-size: 14px;
        color: var(--text-muted);
    }

    /* Forms */
    input,
    select {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: calc(var(--border-radius) / 3);
        box-sizing: border-box;
        font-size: 14px;
    }

    select:hover {
        cursor: pointer;
        border-color: var(--btn-hover-color);
    }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
    }

    .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
    }

    .rule-card {
        border: 1px solid var(--border-color);
        border-radius: calc(var(--border-radius) / 3);
        margin-bottom: 16px;
    }

    .rule-card summary {
        padding: 12px 16px;
        background: var(--bg-muted);
        cursor: pointer;
        display: flex;
        border-radius: calc(var(--border-radius) / 3);
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
    }
    .rule-card .card-content {
        padding: 16px;
        border-top: 1px solid var(--border-color);
    }

    #add-rule-btn {
        width: auto;
        padding: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .domain-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    .domain-row:last-child {
        border-bottom: none;
    }
    .domain-input-group {
        display: flex;
        gap: 10px;
        margin-top: 16px;
    }

    /* --- THE MAGIC SLIDE-UP BOTTOM BAR --- */
    .bottom-action-bar {
        display: none;
        position: fixed;
        bottom: 30px;
        right: 1%;
        color: var(--text-main);
        background-color: #ffffffaa;
        padding: 12px 12px;
        border-radius: 50px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        align-items: center;
        z-index: 1000;
    }

    .bottom-action-bar.visible {
        display: flex;
    }

    #status {
        font-size: 14px;
        font-weight: 500;
        opacity: 0.9;
        text-align: center;
    }

    .pill-btn {
        border-radius: 30px;
    }
</style>
