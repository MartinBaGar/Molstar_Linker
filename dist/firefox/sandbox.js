// sandbox.js

window.addEventListener('message', async (event) => {
    // SECURITY FIX 1 (Kept): Validate the sender's origin before doing anything.
    // We accept only messages that come from our own extension.
    if (!event.origin.startsWith('chrome-extension://') && !event.origin.startsWith('moz-extension://')) {
        console.warn('Mol* Sandbox: Rejected message from untrusted origin:', event.origin);
        return;
    }

    if (event.data && event.data.action === 'INIT_MOLSTAR') {
        const { url, format, settings } = event.data;

        // SECURITY FIX 2 (Kept): Validate the URL scheme before passing it to Mol*.
        // Only data URIs (fetched by viewer.js from https:// sources) are accepted.
        if (typeof url !== 'string' || !url.startsWith('data:')) {
            console.error('Mol* Sandbox: Rejected non-data URL:', typeof url === 'string' ? url.slice(0, 80) : url);
            return;
        }

        // SECURITY FIX 3 (Kept): Validate format is one of the known safe values.
        const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
        if (typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) {
            console.error('Mol* Sandbox: Rejected unknown format:', format);
            return;
        }

        try {
            const viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: true,
                layoutShowControls: true,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: true,
                layoutShowLeftPanel: true,
            });

            const mvsTemplate = MvsBuilder._buildBaseTemplate(url, format, settings);
            const mvsDataString = JSON.stringify(mvsTemplate);

            if (typeof viewerInstance.loadMvsData === 'function') {
                await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
            } else {
                const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
                await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
            }

        } catch (err) {
            console.error("Failed to load MVS data into Mol*", err);
        }
    }
});

window.addEventListener('message', async (event) => {
    if (!event.origin.startsWith('chrome-extension://') && !event.origin.startsWith('moz-extension://')) {
        return;
    }

    if (event.data && event.data.action === 'INIT_MOLSTAR') {
        const { url, format, settings, originalUrl } = event.data;

        if (typeof url !== 'string' || !url.startsWith('data:')) return;

        const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
        if (typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) return;

        // --- THE ANTI-LAG FIX ---
        // 1. Fetch the massive Base64 string locally to turn it back into a binary Blob
        const response = await fetch(url);
        const blob = await response.blob();
        
        // 2. Create a short, local Blob URL (e.g., blob:null/1234-5678)
        let shortBlobUrl = URL.createObjectURL(blob);
        console.log("Hello");
        console.log(shortBlobUrl);

        // 3. Extract the real filename and append it as a hash fragment.
        // Mol* will safely ignore the hash when downloading, but it will display 
        // "blob:null/1234#SITO.pdb" in the UI instead of lagging out!
        if (originalUrl) {
            try {
                const filename = new URL(originalUrl).pathname.split('/').pop();
                if (filename) shortBlobUrl += `#${filename}`;
            } catch (e) {}
        }

        try {
            const viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: true,
                layoutShowControls: true,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: true,
                layoutShowLeftPanel: true,
            });

            // Pass the shortBlobUrl into the builder instead of the Base64 'url'
            const mvsTemplate = MvsBuilder._buildBaseTemplate(shortBlobUrl, format, settings);
            console.log(format);
            const mvsDataString = JSON.stringify(mvsTemplate);

            if (typeof viewerInstance.loadMvsData === 'function') {
                await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
            } else {
                const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
                await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
            }

        } catch (err) {
            console.error("Failed to load MVS data into Mol*", err);
        }
    }
});
