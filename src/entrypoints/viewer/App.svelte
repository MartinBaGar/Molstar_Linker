<script lang="ts">
  import { onMount } from "svelte";
  import type { InitMolstarMessage } from "~/types/index.js";
  import { ALL_EXTENSIONS } from "~/core/extensions";
  import { isSafeUrl, MAX_BYTES } from "~/utils/links.js";

  // ---------------------------------------------------------------------------
  // 1. Svelte State
  // ---------------------------------------------------------------------------
  let isLoading = true;
  let loadingMessage = "Loading structure...";
  let errorMessage: string | null = null;

  let showFormatSelector = false;
  let selectedFormat = "pdb";
  let pendingUrl = "";

  let currentIframe: HTMLIFrameElement | null = null;

  // ---------------------------------------------------------------------------
  // 2. Iframe Management
  // ---------------------------------------------------------------------------
  let sandboxReadyResolve: (() => void) | null = null;
  const sandboxReady = new Promise<void>((resolve) => {
    sandboxReadyResolve = resolve;
  });

    function spawnIframe(
      buffer: ArrayBuffer | null,
      mimeType: string | null,
      format: string | null,
      rawUrl: string | null,
    ): void {
      const molstarReadyListener = (e: MessageEvent) => {
        if (e.data?.action !== "MOLSTAR_READY" || e.source !== currentIframe?.contentWindow) return;
        window.removeEventListener("message", molstarReadyListener);
        window.removeEventListener("message", molstarErrorListener);
        isLoading = false;
      };

      const molstarErrorListener = (e: MessageEvent) => {
        if (e.data?.action !== "MOLSTAR_ERROR" || e.source !== currentIframe?.contentWindow) return;
        window.removeEventListener("message", molstarReadyListener);
        window.removeEventListener("message", molstarErrorListener);
        errorMessage = e.data.error
          ? `Mol* failed to load the structure: ${e.data.error}`
          : "Mol* failed to load the structure.";
        isLoading = false;
      };

      window.addEventListener("message", molstarReadyListener);
      window.addEventListener("message", molstarErrorListener);

      sandboxReady.then(() => {
        loadingMessage = "Loading structure into viewer…";
        const payload: InitMolstarMessage = { action: "INIT_MOLSTAR", buffer, mimeType, format, originalUrl: rawUrl };
        if (buffer) {
          currentIframe!.contentWindow!.postMessage(payload, "*", [buffer]);
        } else {
          currentIframe!.contentWindow!.postMessage(payload, "*");
        }
      });
    }

  // ---------------------------------------------------------------------------
  // 3. Remote Fetch Logic
  // ---------------------------------------------------------------------------
  async function bootWorkspace(rawUrl: string, safeFormat: string): Promise<void> {
    isLoading = true;
    loadingMessage = "Downloading structure securely…";

    const controller = new AbortController();
    const INACTIVITY_TIMEOUT_MS = 30_000; // no new bytes for 30s = treat as stalled
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => controller.abort(), INACTIVITY_TIMEOUT_MS);
    };

    try {
      resetInactivityTimer();
      const response = await fetch(rawUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : null;
      if (total && total > MAX_BYTES) throw new Error("File exceeds the size limit.");

      const mimeType = response.headers.get("Content-Type") ?? undefined;
      let finalBuffer: ArrayBuffer;

      if (!response.body) {
        // Fallback if streaming isn't available
        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error("File exceeds the size limit.");
        finalBuffer = await blob.arrayBuffer();
      } else if (total) {
        // Known size — write directly into a pre-allocated buffer, no intermediate copies
        finalBuffer = new ArrayBuffer(total);
        const view = new Uint8Array(finalBuffer);
        const reader = response.body.getReader();
        let offset = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetInactivityTimer();
          if (offset + value.length > total) throw new Error("Response exceeded declared size.");
          view.set(value, offset);
          offset += value.length;
          loadingMessage = `Downloading structure… ${Math.round((offset / total) * 100)}%`;
        }
      } else {
        // No Content-Length — must accumulate in chunks, but skip the Blob step
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetInactivityTimer();
          chunks.push(value);
          received += value.length;
          if (received > MAX_BYTES) throw new Error("File exceeds the size limit.");
          loadingMessage = `Downloading structure… ${(received / (1024 * 1024)).toFixed(1)} MB`;
        }

        const combined = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        finalBuffer = combined.buffer;
      }

      loadingMessage = "Preparing viewer…";
      spawnIframe(finalBuffer, mimeType ?? null, safeFormat, rawUrl);

    } catch (error: unknown) {
      errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "Download stalled — no data received for 30 seconds."
          : error instanceof Error ? error.message : String(error);
      isLoading = false;
    } finally {
      clearTimeout(inactivityTimer);
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
    const onSandboxReady = (e: MessageEvent) => {
      if (e.data?.action !== "SANDBOX_READY") return;
      window.removeEventListener("message", onSandboxReady);
      sandboxReadyResolve?.();
    };
    window.addEventListener("message", onSandboxReady);

    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get("fileUrl");
    const format = urlParams.get("format") ?? "";

    // SCENARIO 1: No URL → open an empty workspace
    if (!rawUrl) {
      loadingMessage = "Opening empty workspace…";
      spawnIframe(null, null, null, null);
      return;
    }

    // SCENARIO 2: URL present but unsafe
    if (!isSafeUrl(rawUrl)) {
      errorMessage = "Error: request to unsafe or restricted URL blocked.";
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
    if (message.action !== "SETTINGS_UPDATED") return;
    if (!currentIframe?.contentWindow) return;

    currentIframe.contentWindow.postMessage(
      { action: "APPLY_REPRESENTATION", settings: message.settings },
      "*",
    );
  });
</script>

{#if errorMessage}
  <div id="loading">
    <div
      style="background:white;padding:20px 30px;border-radius:8px;text-align:center;color:#333;max-width:400px;margin:0 auto"
    >
      <h3 style="margin-top:0;color:#d73a49">Download Blocked</h3>
      <p style="font-size:14px;color:#555;margin-bottom:0;line-height:1.5">
        {errorMessage}
      </p>
    </div>
  </div>
{:else if showFormatSelector}
  <div class="format-selector">
    <h3>Unknown File Format</h3>
    <p>
      Format could not be detected automatically.<br />Please select it below:
    </p>

    <select bind:value={selectedFormat}>
      {#each ALL_EXTENSIONS as ext}
        <option value={ext}>{ext.toUpperCase()}</option>
      {/each}
    </select>

    <button
      on:click={() => {
        showFormatSelector = false;
        bootWorkspace(pendingUrl, selectedFormat);
      }}
    >
      Launch Workspace
    </button>
  </div>
{:else if isLoading}
  <div id="loading">
    <div class="spinner"></div>
    <p>{loadingMessage}</p>
  </div>
{/if}

<iframe src="sandbox.html" bind:this={currentIframe} title="Molstar Viewer"
></iframe>

<style>
  #loading {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    text-align: center;
    font-family: sans-serif;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 20px 30px;
    border-radius: 10px;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .spinner {
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top: 4px solid white;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    background-color: transparent;
    display: block;
    position: absolute;
    top: 0;
    left: 0;
  }

  /* Format selector styles */
  .format-selector {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;

    background: white;
    padding: 20px 30px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    text-align: center;
    color: #333;
    max-width: 400px;
    margin: 0 auto;
  }

  .format-selector h3 {
    margin-top: 0;
    color: #2c3e50;
  }

  .format-selector p {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
  }

  .format-selector select {
    padding: 8px;
    font-size: 14px;
    border-radius: 4px;
    border: 1px solid #ccc;
    width: 100%;
    margin-bottom: 15px;
  }
</style>
