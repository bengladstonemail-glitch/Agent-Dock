/**
 * Agent Dock Copilot - Edge Background Service Worker
 * Manages tabs, opens side panel permanently on the right, and syncs active tab with Agent Dock.
 */

const AGENTDOCK_SERVER_URL = 'http://localhost:3000';

// Enable side panel to open on extension icon click (Edge & Chromium Manifest V3)
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.log('Edge sidePanel behavior config note:', error));
}

// Fallback click handler if setPanelBehavior is not available in specific Edge build
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn('Could not open side panel programmatically:', err);
    }
  }
});

// Sync active tab state to local Agent Dock backend
async function syncActiveTabToAgentDock() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

    // Request text from content script
    chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_DATA' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Fallback to basic tab info
        sendTabPayload({
          url: tab.url,
          title: tab.title || '',
          domain: tab.url ? new URL(tab.url).hostname : '',
          content: '',
          timestamp: Date.now()
        });
        return;
      }
      sendTabPayload(response);
    });
  } catch (err) {
    // Ignore sync errors when browser tab is inaccessible
  }
}

async function sendTabPayload(payload) {
  try {
    await fetch(`${AGENTDOCK_SERVER_URL}/api/edge-extension/active-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Local server might be restarting or offline
  }
}

// Track tab activation and navigation
chrome.tabs.onActivated.addListener(() => {
  syncActiveTabToAgentDock();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    syncActiveTabToAgentDock();
  }
});

// Handle commands from sidepanel or Agent Dock
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_TAB') {
    const url = request.url || 'http://localhost:3000';
    chrome.tabs.create({ url }, (newTab) => {
      sendResponse({ success: true, tabId: newTab.id });
    });
    return true;
  }

  if (request.action === 'SYNC_NOW') {
    syncActiveTabToAgentDock().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'GET_CURRENT_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ tab: tabs[0] });
      } else {
        sendResponse({ tab: null });
      }
    });
    return true;
  }
});
