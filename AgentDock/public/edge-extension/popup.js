const AGENTDOCK_URL = 'http://localhost:3000';

let activePageData = {
  url: '',
  title: '',
  content: '',
  selectedText: '',
};

document.addEventListener('DOMContentLoaded', async () => {
  const pageTitleEl = document.getElementById('page-title');
  const pageUrlEl = document.getElementById('page-url');
  const chatOutputEl = document.getElementById('chat-output');
  const chatInputEl = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const btnSync = document.getElementById('btn-sync-page');
  const btnSummarize = document.getElementById('btn-summarize');
  const btnOpenIde = document.getElementById('btn-open-ide');
  const btnOpenTabs = document.getElementById('btn-open-tabs');
  const linkLocalhost = document.getElementById('link-localhost');

  // 1. Get Active Tab Data
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageTitleEl.textContent = tab.title || 'Untitled Tab';
      pageUrlEl.textContent = tab.url || 'about:blank';
      activePageData.url = tab.url || '';
      activePageData.title = tab.title || '';

      // Try communicating with content script
      chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_DATA' }, (response) => {
        if (!chrome.runtime.lastError && response) {
          activePageData = response;
          pageTitleEl.textContent = response.title;
          pageUrlEl.textContent = response.url;
        }
      });
    }
  } catch (err) {
    pageTitleEl.textContent = 'Could not read tab';
  }

  // 2. Check Local Agent Dock IDE Connection
  try {
    const res = await fetch(`${AGENTDOCK_URL}/api/status`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      document.getElementById('status-text').textContent = 'Local IDE Online';
      document.getElementById('status-pill').style.color = '#7ee787';
    } else {
      document.getElementById('status-text').textContent = 'IDE Offline';
    }
  } catch {
    document.getElementById('status-text').textContent = 'IDE Offline';
    document.getElementById('status-pill').style.color = '#f85149';
  }

  // 3. Send Page to Agent Dock
  btnSync.addEventListener('click', async () => {
    btnSync.textContent = '⏳ Sending to Agent Dock...';
    try {
      const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/active-tab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activePageData),
      });

      if (res.ok) {
        btnSync.textContent = '✅ Synced with Agent Dock!';
        chatOutputEl.innerHTML = `<strong>Page synced successfully!</strong><br/>You can now ask your Cursor assistant or Gemini mobile view: <em>"Explain this Edge page"</em> or <em>"Extract code from active tab"</em>.`;
      } else {
        btnSync.textContent = '⚠️ Could not sync';
      }
    } catch (e) {
      btnSync.textContent = '⚠️ Server offline';
    }
    setTimeout(() => { btnSync.textContent = '🚀 Send Page to Agent Dock'; }, 3000);
  });

  // Open Side Panel directly if user opened popup
  const btnDockSide = document.getElementById('btn-dock-side');
  if (btnDockSide) {
    btnDockSide.addEventListener('click', async () => {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.sidePanel.open({ windowId: tab.windowId });
          window.close();
        }
      }
    });
  }

  // 4. Summarize Page
  btnSummarize.addEventListener('click', async () => {
    chatOutputEl.textContent = 'Generating 3-bullet summary with local AI...';
    try {
      const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Please provide a clear 3-bullet summary of this webpage.',
          pageContext: activePageData
        })
      });

      if (res.ok) {
        const data = await res.json();
        chatOutputEl.textContent = data.reply || data.content || data.response || 'Summary generated.';
      } else {
        chatOutputEl.textContent = `Summary: This page (${activePageData.title}) is loaded in Edge.`;
      }
    } catch {
      chatOutputEl.textContent = `Page Summary: ${activePageData.title} (${activePageData.url}). Connect to local Agent Dock on port 3000 for AI streaming.`;
    }
  });

  // 5. Open Agent Dock IDE
  const openAgentDock = () => {
    chrome.tabs.create({ url: AGENTDOCK_URL });
  };
  btnOpenIde.addEventListener('click', openAgentDock);
  linkLocalhost.addEventListener('click', openAgentDock);

  // 6. Open New Tab
  btnOpenTabs.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.bing.com' });
  });

  // 7. Interactive Chat with Page Context
  const handleChat = async () => {
    const q = chatInputEl.value.trim();
    if (!q) return;
    chatInputEl.value = '';
    chatOutputEl.textContent = `Thinking about "${q}"...`;

    try {
      const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          pageContext: activePageData
        })
      });

      if (res.ok) {
        const data = await res.json();
        chatOutputEl.textContent = data.reply || data.content || data.response || 'Answer generated.';
      } else {
        chatOutputEl.textContent = `Answer from local AI: Viewing ${activePageData.title}.`;
      }
    } catch {
      chatOutputEl.textContent = `Viewing: ${activePageData.title}. (Ensure npm run dev is running on http://localhost:3000)`;
    }
  };

  btnSend.addEventListener('click', handleChat);
  chatInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChat();
  });
});

