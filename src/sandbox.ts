// src/sandbox.ts
import { NativeBuilder } from './native-builder.js';
import type { InitMolstarMessage } from './types.js';

// Import the tools you want to use in the console
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Color } from 'molstar/lib/mol-util/color';

declare const molstar: any; // Using any for simplicity during rewrite

window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');

let viewerInstance: any = null;

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
        layoutIsExpanded:    false,
        layoutShowControls:  false,
        layoutShowRemoteState: false,
        layoutShowSequence:  true,
        layoutShowLog:       true,
        layoutShowLeftPanel: true,
      });

      // =======================================================================
      // REPL / CONSOLE SETUP
      // Expose globally exactly ONCE when the viewer is instantiated
      // =======================================================================
      (window as any).molPlugin = viewerInstance.plugin;
      (window as any).viewerInstance = viewerInstance;
      (window as any).MS = MS;
      (window as any).StateTransforms = StateTransforms;
      (window as any).Color = Color;
      // =======================================================================
    }

    if (url === null) return; // Empty workspace

    // Anti-lag fix: convert base64 to blob URL
    const response = await fetch(url);
    const blob = await response.blob();
    let shortBlobUrl = URL.createObjectURL(blob);

    if (originalUrl) {
      try {
        const filename = new URL(originalUrl).pathname.split('/').pop();
        if (filename) shortBlobUrl += `#${filename}`;
      } catch {}
    }

    // --- Call the Native Builder ---
    await NativeBuilder.buildNativeScene(
      viewerInstance.plugin,
      shortBlobUrl,
      format!,
      settings
    );

    // Optional: If you want to grab the current structure for the console
    // after the builder finishes, you can do this:
    const structures = viewerInstance.plugin.managers.structure.hierarchy.current.structures;
    if (structures.length > 0) {
        (window as any).molStructure = structures[0].cell;
    }

  } catch (err) {
    console.error('Mol* Sandbox: failed to load structure natively', err);
  }
});
