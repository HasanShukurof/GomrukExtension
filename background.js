// Simple background service worker - no CDN imports allowed in Manifest V3

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Gömrük Extension yükləndi');
});

// Keep service worker alive
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Just acknowledge messages
    if (request.action === 'ping') {
        sendResponse({ success: true });
    }
    return true;
});

