// Allow content scripts to access session storage
chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
});

// --- Badge Management ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === "SET_BADGE" && tabId) {
    chrome.action.setBadgeText({ text: String(msg.count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#666", tabId });
    return;
  }

  if (msg.type === "SCAN_PROGRESS" && tabId) {
    const text = `${msg.completed}/${msg.total}`;
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3", tabId });
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  if (msg.type === "SCAN_COMPLETE" && tabId) {
    chrome.action.setBadgeText({ text: "✓", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId });
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  // --- Start Scan (relay from popup to content script) ---

  if (msg.type === "START_SCAN_REQUEST") {
    chrome.tabs.sendMessage(msg.tabId, { type: "START_SCAN" });
    return;
  }

  // --- Claude Vision API Relay ---

  if (msg.type === "CLAUDE_OCR") {
    handleClaudeOcr(msg.dataUrl)
      .then((text) => sendResponse({ text }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleClaudeOcr(dataUrl) {
  const { anthropicApiKey } = await chrome.storage.local.get("anthropicApiKey");
  if (!anthropicApiKey) {
    throw new Error("No API key configured. Open Moji Lens settings to add your Anthropic API key.");
  }

  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL");
  }
  const mediaType = match[1];
  const base64Data = match[2];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Extract all Japanese text visible in this image. Return only the text, nothing else.",
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.content[0].text;
}
