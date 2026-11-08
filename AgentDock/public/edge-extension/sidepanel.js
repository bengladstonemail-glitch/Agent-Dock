/**
 * Agent Dock Copilot - Edge Side Panel Script
 * Connects directly to the running Agent Dock application (http://localhost:3000).
 * Stays permanently docked on the right side of Microsoft Edge.
 */

const AGENTDOCK_URL = 'http://localhost:3000';

let activeTabContext = {
  url: '',
  title: '',
  domain: '',
  content: '',
  selectedText: '',
};

let includePageContext = true;
let isConnected = false;
let messageHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const modelSelect = document.getElementById('model-select');
  const tabTitleEl = document.getElementById('tab-title');
  const tabDomainEl = document.getElementById('tab-domain');
  const btnToggleContext = document.getElementById('btn-toggle-context');
  const btnOpenIde = document.getElementById('btn-open-ide');
  const linkLocalhost = document.getElementById('link-localhost');
  const messagesContainer = document.getElementById('messages-container');
  const chatTextarea = document.getElementById('chat-textarea');
  const btnSend = document.getElementById('btn-send');

  // Quick Chips
  const chipSummarize = document.getElementById('chip-summarize');
  const chipExplain = document.getElementById('chip-explain');
  const chipExtractCode = document.getElementById('chip-extract-code');
  const chipSyncAgentdock = document.getElementById('chip-sync-agentdock');
  const chipSearchWeb = document.getElementById('chip-search-web');

  // 1. Check Agent Dock Health & Fetch Ollama Models
  async function checkAgentDockConnection() {
    try {
      const res = await fetch(`${AGENTDOCK_URL}/api/status`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        isConnected = true;
        statusBadge.classList.remove('offline');
        statusText.textContent = 'Connected';
        
        // Populate model dropdown if models returned
        if (Array.isArray(data.models) && data.models.length > 0) {
          const currentVal = modelSelect.value;
          modelSelect.innerHTML = '';
          data.models.forEach((modelName) => {
            const opt = document.createElement('option');
            opt.value = modelName;
            opt.textContent = `${modelName} (Local PC)`;
            modelSelect.appendChild(opt);
          });
          if (data.models.includes(currentVal)) {
            modelSelect.value = currentVal;
          }
        }
      } else {
        throw new Error('Not OK');
      }
    } catch (err) {
      isConnected = false;
      statusBadge.classList.add('offline');
      statusText.textContent = 'Offline (Retry)';
    }
  }

  statusBadge.addEventListener('click', checkAgentDockConnection);

  // 2. Refresh and inspect active Edge tab
  async function updateActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      activeTabContext.url = tab.url || '';
      activeTabContext.title = tab.title || 'Untitled Tab';
      try {
        activeTabContext.domain = tab.url ? new URL(tab.url).hostname : '';
      } catch {
        activeTabContext.domain = 'local';
      }

      tabTitleEl.textContent = activeTabContext.title;
      tabDomainEl.textContent = activeTabContext.domain || 'active page';

      // Request live extracted text from content script
      if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_DATA' }, (response) => {
          if (!chrome.runtime.lastError && response) {
            activeTabContext = { ...activeTabContext, ...response };
            tabTitleEl.textContent = activeTabContext.title;
            tabDomainEl.textContent = activeTabContext.domain;
            // Also notify Agent Dock background server
            fetch(`${AGENTDOCK_URL}/api/edge-extension/active-tab`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(activeTabContext),
            }).catch(() => {});
          }
        });
      }
    } catch (err) {
      tabTitleEl.textContent = 'Edge Tab';
    }
  }

  // Listen to tab events so side panel updates instantly as user switches tabs
  if (chrome.tabs) {
    chrome.tabs.onActivated.addListener(updateActiveTab);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        updateActiveTab();
      }
    });
  }

  // 3. Context Toggle
  btnToggleContext.addEventListener('click', () => {
    includePageContext = !includePageContext;
    if (includePageContext) {
      btnToggleContext.classList.remove('disabled');
      btnToggleContext.innerHTML = '<span>Context: ON</span>';
      btnToggleContext.title = 'Active page content is included in prompts';
    } else {
      btnToggleContext.classList.add('disabled');
      btnToggleContext.innerHTML = '<span>Context: OFF</span>';
      btnToggleContext.title = 'Active page content is excluded from prompts';
    }
  });

  // 4. Open Agent Dock IDE in new tab
  const openAgentDockIde = () => {
    chrome.tabs.create({ url: AGENTDOCK_URL });
  };
  btnOpenIde.addEventListener('click', openAgentDockIde);
  linkLocalhost.addEventListener('click', (e) => {
    e.preventDefault();
    openAgentDockIde();
  });

  // 5. Append Messages
  function appendMessage(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const senderTag = document.createElement('span');
    senderTag.className = 'message-sender-tag';
    senderTag.textContent = role === 'user' ? 'You' : `Agent Dock (${modelSelect.value || 'AI'})`;
    row.appendChild(senderTag);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'assistant') {
      renderFormattedContent(bubble, text);
    } else {
      bubble.textContent = text;
    }

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Formatter for code blocks and links
  function renderFormattedContent(container, rawText) {
    // Regex for code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      // Append text before code block
      const preceding = rawText.slice(lastIndex, match.index);
      if (preceding.trim()) {
        const textNode = document.createElement('div');
        textNode.innerHTML = formatInlineMarkdown(preceding);
        container.appendChild(textNode);
      }

      const lang = match[1] || 'code';
      const code = match[2];

      const codeBox = document.createElement('div');
      codeBox.className = 'code-box';

      const boxHeader = document.createElement('div');
      boxHeader.className = 'code-box-header';
      boxHeader.innerHTML = `<span>${lang}</span>`;

      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'code-box-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-action-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1800);
      };
      actionsGroup.appendChild(copyBtn);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'code-action-btn';
      saveBtn.textContent = '💾 Save to Agent Dock';
      saveBtn.title = 'Save this file directly to ~/AgentDock';
      saveBtn.onclick = async () => {
        saveBtn.textContent = 'Saving...';
        const defaultName = lang === 'python' ? 'script.py' : lang === 'json' ? 'data.json' : lang === 'javascript' || lang === 'js' ? 'index.js' : 'code.txt';
        const filename = prompt('Enter filename to save in ~/AgentDock:', defaultName);
        if (!filename) {
          saveBtn.textContent = '💾 Save to Agent Dock';
          return;
        }

        try {
          const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/create-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content: code }),
          });
          if (res.ok) {
            saveBtn.textContent = '✅ Saved!';
          } else {
            saveBtn.textContent = '⚠️ Save failed';
          }
        } catch {
          saveBtn.textContent = '⚠️ Server offline';
        }
        setTimeout(() => { saveBtn.textContent = '💾 Save to Agent Dock'; }, 2500);
      };
      actionsGroup.appendChild(saveBtn);

      boxHeader.appendChild(actionsGroup);
      codeBox.appendChild(boxHeader);

      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      codeBox.appendChild(pre);

      container.appendChild(codeBox);
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    const remaining = rawText.slice(lastIndex);
    if (remaining.trim()) {
      const remainingDiv = document.createElement('div');
      remainingDiv.innerHTML = formatInlineMarkdown(remaining);
      container.appendChild(remainingDiv);
    }
  }

  function formatInlineMarkdown(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:#20232f;padding:2px 5px;border-radius:4px;color:#79b8ff;font-family:monospace;font-size:11px;">$1</code>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  // 6. Send Chat Query to Agent Dock Backend
  async function sendMessage(customPrompt) {
    const message = customPrompt || chatTextarea.value.trim();
    if (!message) return;

    if (!customPrompt) {
      chatTextarea.value = '';
      chatTextarea.style.height = 'auto';
    }

    appendMessage('user', message);
    messageHistory.push({ role: 'user', content: message });

    btnSend.disabled = true;
    btnSend.innerHTML = '<span>Thinking...</span>';

    // Show temporary thinking indicator
    const thinkingRow = document.createElement('div');
    thinkingRow.className = 'message-row assistant';
    thinkingRow.id = 'temp-thinking';
    thinkingRow.innerHTML = `
      <span class="message-sender-tag">Agent Dock Assistant</span>
      <div class="message-bubble" style="color: #8b90a0; font-style: italic;">
        Connecting to Agent Dock & ${modelSelect.value || 'local model'}...
      </div>
    `;
    messagesContainer.appendChild(thinkingRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const payload = {
        message,
        model: modelSelect.value,
        history: messageHistory.slice(-8),
        pageContext: includePageContext ? activeTabContext : null,
      };

      const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const tempEl = document.getElementById('temp-thinking');
      if (tempEl) tempEl.remove();

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || data.content || data.response || 'No response returned.';
        appendMessage('assistant', reply);
        messageHistory.push({ role: 'assistant', content: reply });
      } else {
        appendMessage('assistant', `⚠️ Could not get response from Agent Dock server (Status: ${res.status}). Make sure \`npm run dev\` is running on port 3000.`);
      }
    } catch (err) {
      const tempEl = document.getElementById('temp-thinking');
      if (tempEl) tempEl.remove();

      appendMessage('assistant', `⚠️ Connection error: Agent Dock server is unreachable at http://localhost:3000. Start it in terminal with \`npm run dev\`.`);
    } finally {
      btnSend.disabled = false;
      btnSend.innerHTML = '<span>Send</span> ➔';
    }
  }

  btnSend.addEventListener('click', () => sendMessage());

  chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatTextarea.addEventListener('input', () => {
    chatTextarea.style.height = 'auto';
    chatTextarea.style.height = `${Math.min(chatTextarea.scrollHeight, 120)}px`;
  });

  // 7. Quick Chips Handlers
  chipSummarize.addEventListener('click', () => {
    sendMessage(`Please provide a concise 3 to 5 bullet point executive summary of this webpage. Highlight the main topic, key insights, and actionable takeaways.`);
  });

  chipExplain.addEventListener('click', () => {
    sendMessage(`Explain the core concept and details of this page as if explaining to a software engineer. Highlight key terminology and architecture.`);
  });

  chipExtractCode.addEventListener('click', () => {
    sendMessage(`Extract all code examples, shell commands, or configuration snippets found on this webpage. Format them cleanly with explanations and ready-to-use snippets.`);
  });

  chipSyncAgentdock.addEventListener('click', async () => {
    chipSyncAgentdock.textContent = '⏳ Syncing...';
    try {
      const res = await fetch(`${AGENTDOCK_URL}/api/edge-extension/active-tab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTabContext),
      });
      if (res.ok) {
        chipSyncAgentdock.textContent = '✅ Synced to IDE';
        appendMessage('assistant', `✅ **Active Tab Synced to Agent Dock!**\n\nPage: **${activeTabContext.title}**\nURL: \`${activeTabContext.url}\`\n\nInside Agent Dock IDE, you can now click **"Ask AI About This Tab"** or ask any coding assistant questions with this full webpage context.`);
      } else {
        chipSyncAgentdock.textContent = '⚠️ Sync error';
      }
    } catch {
      chipSyncAgentdock.textContent = '⚠️ Offline';
    }
    setTimeout(() => { chipSyncAgentdock.textContent = '🚀 Send to Agent Dock'; }, 2500);
  });

  chipSearchWeb.addEventListener('click', () => {
    const q = prompt('What would you like to search on the web?');
    if (q) {
      sendMessage(`@web ${q}`);
    }
  });

  // Initialize
  checkAgentDockConnection();
  updateActiveTab();
  setInterval(checkAgentDockConnection, 10000);
  setInterval(updateActiveTab, 4000);
});
