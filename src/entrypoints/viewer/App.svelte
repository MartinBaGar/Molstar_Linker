<script lang="ts">
    import { onMount } from 'svelte';
    import type { InitMolstarMessage } from '~/types/index.js';
    import { ALL_EXTENSIONS } from '~/core/extensions';
    import { isSafeUrl } from '~/utils/links.js';

    const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

    // ---------------------------------------------------------------------------
    // 1. Svelte State
    // ---------------------------------------------------------------------------
    let isLoading = true;
    let loadingMessage = 'Loading structure...';
    let errorMessage: string | null = null;

    let showFormatSelector = false;
    let selectedFormat = "pdb";
    let pendingUrl = '';

    let currentIframe: HTMLIFrameElement | null = null;

    // ---------------------------------------------------------------------------
    // 2. Iframe Management
    // ---------------------------------------------------------------------------
    function spawnIframe(dataUri: string | null, format: string | null, rawUrl: string | null): void {
        const sandboxReadyListener = (e: MessageEvent): void => {
            if (e.data?.action !== 'SANDBOX_READY' || e.source !== currentIframe?.contentWindow) return;
            window.removeEventListener('message', sandboxReadyListener);

            const payload: InitMolstarMessage = {
                action: 'INIT_MOLSTAR',
                url: dataUri,
                format: format,
                originalUrl: rawUrl,
            };
            currentIframe!.contentWindow!.postMessage(payload, '*');
        };

        const molstarReadyListener = (e: MessageEvent) => {
            if (e.data?.action !== 'MOLSTAR_READY' || e.source !== currentIframe?.contentWindow) return;
            window.removeEventListener('message', molstarReadyListener);
            isLoading = false;
        };

        window.addEventListener('message', sandboxReadyListener);
        window.addEventListener('message', molstarReadyListener);
    }

    // ---------------------------------------------------------------------------
    // 3. Remote Fetch Logic
    // ---------------------------------------------------------------------------
    async function bootWorkspace(rawUrl: string, safeFormat: string): Promise<void> {
        isLoading = true;
        loadingMessage = 'Downloading structure securely…';

        try {
            const response = await fetch(rawUrl);
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

            const contentLength = response.headers.get('Content-Length');
            if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
                throw new Error('File exceeds the 25 MB size limit.');
            }

            const blob = await response.blob();
            if (blob.size > MAX_BYTES) throw new Error('File exceeds the 25 MB size limit.');

            const preview = await blob.slice(0, 150).text();
            if (preview.trim().startsWith('<?xml') || preview.includes('<Error>')) {
                throw new Error(
                    'Download blocked by browser tracking protection. ' +
                    'Please authorize this domain in the Studio settings.',
                );
            }

            const dataUri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });

            spawnIframe(dataUri, safeFormat, rawUrl);

        } catch (error: unknown) {
            errorMessage = error instanceof Error ? error.message : String(error);
            isLoading = false;
        }
    }

    function promptForFormat(rawUrl: string) {
        pendingUrl = rawUrl;
        isLoading = false;
        showFormatSelector = true;
    }

    // ---------------------------------------------------------------------------
    // 4. Initialization
    // ---------------------------------------------------------------------------
    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const rawUrl = urlParams.get('fileUrl');
        const format = urlParams.get('format') ?? '';

        // SCENARIO 1: No URL → open an empty workspace
        if (!rawUrl) {
            loadingMessage = 'Opening empty workspace…';
            spawnIframe(null, null, null);
            return;
        }

        // SCENARIO 2: URL present but unsafe
        if (!isSafeUrl(rawUrl)) {
            errorMessage = 'Error: request to unsafe or restricted URL blocked.';
            isLoading = false;
            return;
        }

        // SCENARIO 3: URL present but format unknown
        if (!ALL_EXTENSIONS.has(format)) {
            promptForFormat(rawUrl);
            return;
        }

        // SCENARIO 4: Known format + authorized domain
        bootWorkspace(rawUrl, format);
    });

    // Message listener for live updates from the Options page
    browser.runtime.onMessage.addListener((message) => {
        if (message.action !== 'SETTINGS_UPDATED') return;
        if (!currentIframe?.contentWindow) return;

        currentIframe.contentWindow.postMessage(
            { action: 'APPLY_REPRESENTATION', settings: message.settings },
            '*'
        );
    });
</script>

{#if errorMessage}
    <div id="loading">
        <div style="background:white;padding:20px 30px;border-radius:8px;text-align:center;color:#333;max-width:400px;margin:0 auto">
            <h3 style="margin-top:0;color:#d73a49">Download Blocked</h3>
            <p style="font-size:14px;color:#555;margin-bottom:0;line-height:1.5">{errorMessage}</p>
        </div>
    </div>
{:else if showFormatSelector}
    <div class="format-selector">
        <h3>Unknown File Format</h3>
        <p>Format could not be detected automatically.<br>Please select it below:</p>

        <select bind:value={selectedFormat}>
            {#each ALL_EXTENSIONS as ext}
                <option value={ext}>{ext.toUpperCase()}</option>
            {/each}
        </select>

        <button on:click={() => {
            showFormatSelector = false;
            bootWorkspace(pendingUrl, selectedFormat);
        }}>
            Launch Workspace
        </button>
    </div>
{:else if isLoading}
    <div id="loading">
        <div class="spinner"></div>
        <p>{loadingMessage}</p>
    </div>
{/if}

<iframe src="sandbox.html" bind:this={currentIframe} title="Molstar Viewer"></iframe>
