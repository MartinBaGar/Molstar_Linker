import type { Viewer } from 'molstar/lib/apps/viewer/app';
import type { InitMolstarMessage } from '~/types/index.js';
import { NativeBuilder, customRuleToRep } from '~/core/native-builder.js';
import { getFileNameFromUrl } from '~/utils/links.js';

declare global {
    const molstar: typeof import('molstar/lib/apps/viewer/app');
}

let viewerInstance: Viewer | null = null;

// 1. Dynamically inject the CSS to bypass Vite's HTML parser
const cssLink = document.createElement('link');
cssLink.rel = 'stylesheet';
cssLink.type = 'text/css';
cssLink.href = '/lib/molstar.css';
document.head.appendChild(cssLink);

// 1. Create the script tag dynamically to bypass Vite's bundler isolation
const script = document.createElement('script');
script.src = '/lib/molstar.js';

// 2. Wait for the physical file to load before setting up listeners
script.onload = () => {
    console.log("✅ Molstar script loaded natively!");

    // Set up the message listener ONLY after Molstar is globally available
    window.addEventListener('message', async (event: MessageEvent<any>) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.action === 'INIT_MOLSTAR') {
            const { blob, format, originalUrl } = msg as InitMolstarMessage;
            try {
                if (!viewerInstance) {
                    viewerInstance = await molstar.Viewer.create('app', {
                        layoutIsExpanded: false,
                        layoutShowControls: false,
                    });
                }

                if (blob === null) {
                        window.parent.postMessage({ action: 'MOLSTAR_READY' }, '*');
                    return
                };

                const { shortBlobUrl, filename } = getFileNameFromBlob(blob, originalUrl ?? undefined);
                await NativeBuilder.buildNativeScene(viewerInstance.plugin, shortBlobUrl, format!, filename!);
                window.parent.postMessage({ action: 'MOLSTAR_READY' }, '*');

            } catch (err) {
                console.error('Mol* Sandbox: failed to load structure natively', err);
                window.parent.postMessage({ action: 'MOLSTAR_ERROR', error: String(err) }, '*');
            }
        }
        // URL.revokeObjectURL(shortBlobUrl.split('#')[0]);
        if (msg.action === 'APPLY_REPRESENTATION') {
            if (!viewerInstance) return;
            const plugin = viewerInstance.plugin;
            const settings = msg.settings;
            customRuleToRep(plugin, settings);
        }
    });

    // 3. NOW tell the parent window we are ready to receive the INIT message
    window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');
};

script.onerror = () => {
    console.error("❌ Failed to load Molstar script");
    window.parent.postMessage({ action: 'MOLSTAR_ERROR', error: 'Failed to load molstar.js' }, '*');
};

// 4. Inject the script into the page to trigger the download
document.head.appendChild(script);
