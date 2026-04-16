// background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "open_viewer" && message.url) {
    const viewerUrl = chrome.runtime.getURL(`viewer.html?fileUrl=${encodeURIComponent(message.url)}&format=${message.format}`);
    chrome.tabs.create({ url: viewerUrl });
  }
});
