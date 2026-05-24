// src/sandbox.ts
// import { NativeBuilder } from './native-builder.js';
import type { InitMolstarMessage } from './types.js';
import { NativeBuilder, getLastComponent } from './native-builder.js';


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
        layoutShowControls:  true,
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

  } catch (err) {
    console.error('Mol* Sandbox: failed to load structure natively', err);
  }
});

window.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data;
  if (!msg || msg.action !== 'APPLY_REPRESENTATION') return;

  const { plugin, component } = getLastComponent();
  if (!plugin || !component) return;

  const settings = msg.settings;
  const repType = settings.customRules?.[0]?.repprop?.type ?? 'ball-and-stick';

  await plugin.builders.structure.representation.addRepresentation(
    component,
    { type: repType }
  );
});
