// src/sandbox.ts
import { NativeBuilder } from './native-builder.js';
import { CliEngine }     from './cli.js';          // ← NEW
import type { InitMolstarMessage } from './types.js';

declare const molstar: any;

window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');

let viewerInstance: any    = null;
let cliEngine:  CliEngine | null = null;  // ← NEW

(window.history as any).replaceState = () => {};
(window.history as any).pushState    = () => {};

if ('xr' in navigator) {
  Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
}

window.addEventListener('message', async (event: MessageEvent<InitMolstarMessage>) => {
  const msg = event.data;
  if (!msg || msg.action !== 'INIT_MOLSTAR') return;

  const { url, format, settings, originalUrl } = msg;

  try {
    if (!viewerInstance) {
      viewerInstance = await molstar.Viewer.create('app', {
        layoutIsExpanded:      false,
        layoutShowControls:    false,
        layoutShowRemoteState: false,
        layoutShowSequence:    true,
        layoutShowLog:         true,
        layoutShowLeftPanel:   true,
      });

      // ── Mount the CLI immediately after the viewer exists ─────────────────
      // We mount here (not after buildNativeScene) so the CLI is available
      // even on an empty workspace and does not wait for structure loading.
      if (!cliEngine) {
        cliEngine = new CliEngine(viewerInstance.plugin);
        cliEngine.mount(document.body);
      }
      // ──────────────────────────────────────────────────────────────────────
    }

    if (url === null) return; // Empty workspace — CLI is ready, no structure to load

    // Anti-lag fix: convert base64 to blob URL
    const response = await fetch(url);
    const blob     = await response.blob();
    let shortBlobUrl = URL.createObjectURL(blob);

    if (originalUrl) {
      try {
        const filename = new URL(originalUrl).pathname.split('/').pop();
        if (filename) shortBlobUrl += `#${filename}`;
      } catch {}
    }

    await NativeBuilder.buildNativeScene(
      viewerInstance.plugin,
      shortBlobUrl,
      format!,
      settings,
    );

  } catch (err) {
    console.error('Mol* Sandbox: failed to load structure natively', err);
  }
});
