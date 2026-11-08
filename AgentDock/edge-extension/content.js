/**
 * Agent Dock Copilot - Microsoft Edge Content Script
 * Extracts readable page content, title, URL, and user selection.
 */

function getCleanPageText() {
  const selection = window.getSelection()?.toString()?.trim() || '';

  // Clone body to strip clutter without modifying the live DOM
  const clone = document.body.cloneNode(true);
  const elementsToRemove = clone.querySelectorAll(
    'script, style, noscript, iframe, svg, nav, footer, header, form, [aria-hidden="true"], .advertisement, .ad-banner'
  );
  elementsToRemove.forEach(el => el.remove());

  let text = clone.innerText || clone.textContent || '';
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

  // Limit to reasonable payload size for local LLMs
  const maxChars = 24000;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n\n... [Content truncated for AI context window]';
  }

  return {
    url: window.location.href,
    title: document.title || window.location.hostname,
    domain: window.location.hostname,
    selectedText: selection,
    content: text,
    timestamp: Date.now()
  };
}

// Listen for requests from popup or background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_DATA') {
    const data = getCleanPageText();
    sendResponse(data);
    return true;
  }

  if (request.action === 'PING') {
    sendResponse({ status: 'alive', url: window.location.href });
    return true;
  }
});
