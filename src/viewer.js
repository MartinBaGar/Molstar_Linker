// viewer.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('fileUrl');
    const format = urlParams.get('format');
    const loadingDiv = document.getElementById('loading');

    if (!rawUrl) {
        loadingDiv.innerText = 'Error: No structure URL provided.';
        return;
    }

    try {
        // 1. Fetch the file in the Shell (CORS is bypassed here!)
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const blob = await response.blob();

        // 2. Convert the file blob into a Base64 Data URI
        const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        // 3. Get the user's settings
        chrome.storage.sync.get(null, (storedSettings) => {
            
            // THE FIX: Merge defaults with whatever is in storage so it is never empty!
            const finalSettings = { ...AppConfig.getDefaults(), ...storedSettings };
            
            // Remove the loading text
            loadingDiv.remove();
            
            // 4. Inject the Sandbox dynamically
            const iframe = document.createElement('iframe');
            iframe.src = 'sandbox.html';
            iframe.allow = 'xr-spatial-tracking';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            
            // 5. Pass the data AND the final merged settings
            iframe.onload = () => {
                iframe.contentWindow.postMessage({
                    action: 'INIT_MOLSTAR',
                    url: dataUri, 
                    format: format,
                    settings: finalSettings // <--- Using the safely merged settings
                }, '*');
            };
            
            document.body.appendChild(iframe);
        });

    } catch (error) {
        console.error("Fetch error:", error);
        loadingDiv.innerText = 'Failed to download file: ' + error.message;
    }
});
