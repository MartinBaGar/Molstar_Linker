// sandbox.js

// Listen for the message from viewer.js
window.addEventListener('message', async (event) => {
    if (event.data && event.data.action === 'INIT_MOLSTAR') {
        const { url, format, settings } = event.data;

        try {
            // 1. Initialize the Mol* Viewer UI instance
            const viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: true,
                layoutShowControls: true,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: true,
                layoutShowLeftPanel: true,
            });

            // 2. Build the MVS Tree using the data passed from the shell
            const mvsTemplate = MvsBuilder._buildBaseTemplate(url, format, settings);
            const mvsDataString = JSON.stringify(mvsTemplate);

            // 3. Load the structure!
            // We use the correct Mol* API methods for MVS JSON data
            if (typeof viewerInstance.loadMvsData === 'function') {
                await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
            } else {
                // Failsafe fallback just in case you are using an older molstar.js build
                const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
                await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
            }
            
        } catch (err) {
            console.error("Failed to load MVS data into Mol*", err);
        }
    }
});
