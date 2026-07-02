import type { Viewer } from 'molstar/lib/apps/viewer/app';
import type { InitMolstarMessage } from './types.js';
import { NativeBuilder, customRuleToRep } from './native-builder.js';
import { getFileNameFromUrl } from './utils/links.js';
declare global {
    const molstar: typeof import('molstar/lib/apps/viewer/app');
}

window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');

let viewerInstance: Viewer | null = null;

window.addEventListener('message', async (event: MessageEvent<InitMolstarMessage>) => {
    const msg = event.data;
    if (!msg || msg.action !== 'INIT_MOLSTAR') return;

    const { url, format, originalUrl } = msg;

    try {
        if (!viewerInstance) {
            viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: false,
                layoutShowControls: false,
            });
        }

        if (url === null) return;

        const { shortBlobUrl, filename } = await getFileNameFromUrl(
            url,
            originalUrl ?? undefined
        );

        await NativeBuilder.buildNativeScene(
            viewerInstance.plugin,
            shortBlobUrl,
            format!,
            filename!
        );

    } catch (err) {
        console.error('Mol* Sandbox: failed to load structure natively', err);
    }
});

window.addEventListener('message', async (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || msg.action !== 'APPLY_REPRESENTATION') return;

    if (!viewerInstance) return;

    const plugin = viewerInstance.plugin
    const settings = msg.settings;

    customRuleToRep(plugin, settings);
});
