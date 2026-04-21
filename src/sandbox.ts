// src/sandbox.ts
import { MvsBuilder } from './mvs-builder.js';
import { ExtensionSettings } from './types.js';

declare const molstar: any;

window.addEventListener('message', async (event: MessageEvent) => {
    const { type, dataUri, format, sourceUrl, settings } = event.data;

    if (type === 'load-structure') {
        try {
            // FIXED: Changed 'viewer-root' to 'app' to match your HTML exactly!
            const viewer = await molstar.Viewer.create('app', {
                layoutIsExpanded: false,
                layoutShowControls: false,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: false,
                viewportShowExpand: true,
                viewportShowSelectionMode: false,
                viewportShowAnimation: false,
            });

            const mvsData = MvsBuilder._buildBaseTemplate(
                dataUri, 
                format === 'cif' ? 'mmcif' : format, 
                settings as ExtensionSettings
            );

            await molstar.PluginExtensions.mvs.loadMvs(viewer.plugin, mvsData, {
                sourceUrl: sourceUrl
            });

        } catch (err) {
            console.error('Sandbox Render Error:', err);
        }
    }
});

window.parent.postMessage({ type: 'sandbox-ready' }, '*');
