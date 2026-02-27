const scanBtn = document.getElementById("scanBtn");
const rescanBtn = document.getElementById("rescanBtn");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const apiKeyInput = document.getElementById("apiKey");
const saveMsg = document.getElementById("saveMsg");

let scanning = false;

// --- Render scan state (shared by init, message listener, and polling) ---

function renderScanState(state) {
  if (!state) return false;

  progressEl.style.display = "block";
  rescanBtn.style.display = "none";

  if (state.status === "scanning") {
    scanning = true;
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning...";
    const pct = Math.round((state.completed / state.total) * 100);
    progressFill.style.width = `${pct}%`;
    progressFill.style.background = "#2563EB";
    let info = `${state.completed} / ${state.total}`;
    if (state.errors > 0) info += ` (${state.errors} failed)`;
    progressText.textContent = info;
    return true;
  }

  if (state.status === "error") {
    scanning = false;
    scanBtn.textContent = "Scan stopped";
    scanBtn.disabled = true;
    rescanBtn.style.display = "block";
    progressFill.style.width = "100%";
    progressFill.style.background = "#ef4444";
    let msg = state.lastError || "Unknown error";
    if (/credit balance/i.test(msg)) {
      msg = "Insufficient API credits. Add credits at console.anthropic.com";
    } else if (/No API key configured/i.test(msg)) {
      msg = "No API key. Add your Anthropic key below.";
    } else if (/api key|unauthorized|authentication/i.test(msg)) {
      msg = "Invalid API key. Check your key below.";
    }
    progressText.innerHTML = `<span style="color:#dc2626">${msg}</span>`;
    return true;
  }

  if (state.status === "done") {
    scanning = false;
    scanBtn.disabled = true;
    rescanBtn.style.display = "block";
    progressFill.style.width = "100%";
    progressFill.style.background = "#16a34a";
    let summary = `Done — found text in ${state.found} image${state.found !== 1 ? "s" : ""}`;
    if (state.errors > 0) summary += ` (${state.errors} failed)`;
    scanBtn.textContent = summary;
    let hint = "Use Ctrl+F to search";
    if (state.cacheHits > 0) hint += ` · ${state.cacheHits} cached`;
    progressText.textContent = hint;
    return true;
  }

  return false;
}

// --- Init ---

async function init() {
  const { anthropicApiKey } = await chrome.storage.local.get("anthropicApiKey");
  if (anthropicApiKey) apiKeyInput.value = anthropicApiKey;

  const { scanState } = await chrome.storage.session.get("scanState");
  if (renderScanState(scanState)) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = "No active tab";
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
    if (response.hasJapanese) {
      statusEl.innerHTML = `<strong>Japanese detected</strong> · ${response.imageCount} image${response.imageCount !== 1 ? "s" : ""} found`;
      if (response.imageCount > 0) {
        scanBtn.disabled = false;
      }
    } else {
      statusEl.textContent = "No Japanese text detected on this page";
    }
  } catch {
    statusEl.textContent = "Cannot access this page (reload may help)";
  }
}

// --- Scan ---

async function startScan() {
  if (scanning) return;
  scanning = true;
  scanBtn.disabled = true;
  rescanBtn.style.display = "none";
  scanBtn.textContent = "Scanning...";
  progressEl.style.display = "block";
  progressFill.style.width = "0%";
  progressFill.style.background = "#2563EB";
  progressText.textContent = "Starting...";

  await chrome.storage.session.remove("scanState");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.runtime.sendMessage({
    type: "START_SCAN_REQUEST",
    tabId: tab.id,
  });
  startPolling();
}

scanBtn.addEventListener("click", startScan);
rescanBtn.addEventListener("click", startScan);

// --- Progress ---

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SCAN_PROGRESS" || msg.type === "SCAN_COMPLETE") {
    chrome.storage.session.get("scanState").then(({ scanState }) => {
      renderScanState(scanState);
    });
  }
});

let pollInterval;
function startPolling() {
  pollInterval = setInterval(async () => {
    const { scanState } = await chrome.storage.session.get("scanState");
    if (!scanState) return;
    renderScanState(scanState);
    if (scanState.status !== "scanning") clearInterval(pollInterval);
  }, 500);
}

// --- API Key ---

let saveTimeout;
apiKeyInput.addEventListener("input", () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({ anthropicApiKey: apiKeyInput.value });
    saveMsg.style.display = "inline";
    setTimeout(() => (saveMsg.style.display = "none"), 1500);
  }, 500);
});

init().then(() => {
  if (scanning) startPolling();
});
