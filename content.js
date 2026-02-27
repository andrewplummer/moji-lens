(() => {
  const JIS_PREFIX = "__jis-";
  const MIN_IMAGE_SIZE = 20;
  const CONCURRENCY = 3;
  const JAPANESE_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

  // --- Phase 1: Auto-Detection (runs on every page load, zero network requests) ---

  function detectJapanese() {
    return JAPANESE_RE.test(document.body.innerText);
  }

  function collectImageElements() {
    const results = [];
    const seen = new Set();

    // <img> tags
    for (const img of document.querySelectorAll("img[src]")) {
      const rect = img.getBoundingClientRect();
      if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) continue;
      const url = img.src;
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({ el: img, url, type: "img" });
    }

    // Elements with background-image
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg === "none") continue;
      const match = bg.match(/url\(["']?(.+?)["']?\)/);
      if (!match) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < MIN_IMAGE_SIZE || rect.height < MIN_IMAGE_SIZE) continue;
      const url = match[1];
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({ el, url, type: "bg" });
    }

    return results;
  }

  function runDetection() {
    const hasJapanese = detectJapanese();
    const images = collectImageElements();

    if (hasJapanese && images.length > 0) {
      chrome.runtime.sendMessage({
        type: "SET_BADGE",
        count: images.length,
      });
    }
  }

  // --- Phase 2: OCR Scan (triggered by popup) ---

  const MAX_IMAGE_DIM = 1024;

  async function imageUrlToBase64(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob);
      const { width, height } = bmp;

      // Downscale if either dimension exceeds MAX_IMAGE_DIM
      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const scale = MAX_IMAGE_DIM / Math.max(width, height);
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const resizedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(resizedBlob);
        });
      }

      bmp.close();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function injectHighlightStyles() {
    if (document.getElementById(`${JIS_PREFIX}styles`)) return;
    const style = document.createElement("style");
    style.id = `${JIS_PREFIX}styles`;
    style.textContent = `
      .${JIS_PREFIX}ocr-text {
        font: 10px/1.4 -apple-system, sans-serif !important;
        color: #555 !important;
        background: #fffbe6 !important;
        border-left: 2px solid #f0c000 !important;
        padding: 2px 5px !important;
        margin: 2px 0 !important;
        max-width: 100% !important;
        word-break: break-all !important;
        opacity: 0.85 !important;
      }
      .${JIS_PREFIX}ocr-text::before {
        content: "OCR" !important;
        font: bold 8px/1 monospace !important;
        color: #b08800 !important;
        background: #f0e4b0 !important;
        padding: 0 3px !important;
        border-radius: 2px !important;
        margin-right: 4px !important;
        vertical-align: middle !important;
      }
      .${JIS_PREFIX}ocr-inset {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 !important;
        border-left: none !important;
        border-radius: 0 !important;
        opacity: 0.9 !important;
        font-size: 9px !important;
        text-indent: 0 !important;
        padding: 1px 3px !important;
        z-index: 1 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isInFlowLayout(el) {
    const style = getComputedStyle(el);
    if (style.float !== "none") return true;
    const parent = el.parentElement;
    if (!parent) return false;
    const parentDisplay = getComputedStyle(parent).display;
    return parentDisplay === "flex" || parentDisplay === "inline-flex" ||
           parentDisplay === "grid" || parentDisplay === "inline-grid";
  }

  function injectOcrText(el, text, url) {
    injectHighlightStyles();

    const cleanText = text.replace(/\s+/g, "");

    // For floated/flex/grid items, append inside the element so we don't
    // break the layout flow. For normal block elements, insert after.
    if (el.tagName !== "IMG" && isInFlowLayout(el)) {
      const existing = el.querySelector(`.${JIS_PREFIX}ocr-text`);
      if (existing) existing.remove();

      const pos = getComputedStyle(el).position;
      if (pos === "static") el.style.position = "relative";

      const ocrDiv = document.createElement("div");
      ocrDiv.className = `${JIS_PREFIX}ocr-text ${JIS_PREFIX}ocr-inset`;
      ocrDiv.dataset.sourceUrl = url;
      ocrDiv.textContent = cleanText;
      el.appendChild(ocrDiv);
    } else {
      const next = el.nextElementSibling;
      if (next && next.classList.contains(`${JIS_PREFIX}ocr-text`)) {
        next.remove();
      }

      const ocrDiv = document.createElement("div");
      ocrDiv.className = `${JIS_PREFIX}ocr-text`;
      ocrDiv.dataset.sourceUrl = url;
      ocrDiv.textContent = cleanText;
      el.insertAdjacentElement("afterend", ocrDiv);
    }
  }

  async function ocrWithClaude(base64DataUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "CLAUDE_OCR", dataUrl: base64DataUrl },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.text);
        }
      );
    });
  }

  async function runOcrOnImages() {
    const images = collectImageElements();
    const total = images.length;
    let completed = 0;
    let found = 0;

    chrome.storage.session.set({
      scanState: { status: "scanning", completed: 0, total, found: 0 },
    });

    let aborted = false;
    let errors = 0;
    let lastError = "";

    // Load OCR cache
    const { ocrCache = {} } = await chrome.storage.local.get("ocrCache");
    let cacheHits = 0;

    const process = async ({ el, url }) => {
      if (aborted) return;
      try {
        // Check cache first (keyed by image URL without query params)
        const cacheKey = url.split("?")[0];
        if (ocrCache[cacheKey]) {
          const text = ocrCache[cacheKey];
          if (JAPANESE_RE.test(text)) {
            injectOcrText(el, text, url);
            found++;
          }
          cacheHits++;
          return;
        }

        const base64 = await imageUrlToBase64(url);
        if (!base64) return;
        const text = await ocrWithClaude(base64);

        // Cache the result (even empty ones, to avoid re-processing)
        if (text) {
          ocrCache[cacheKey] = text;
          chrome.storage.local.set({ ocrCache });
        }

        if (text && JAPANESE_RE.test(text)) {
          injectOcrText(el, text, url);
          found++;
        }
      } catch (err) {
        console.warn(`[JIS] OCR failed for ${url}:`, err);
        errors++;
        lastError = err.message;

        if (/credit balance|api key|unauthorized|authentication/i.test(err.message)) {
          aborted = true;
        }
      } finally {
        completed++;
        const progress = {
          status: aborted ? "error" : "scanning",
          completed, total, found, errors, lastError, cacheHits,
        };
        chrome.storage.session.set({ scanState: progress });
        chrome.runtime.sendMessage({
          type: "SCAN_PROGRESS",
          completed,
          total,
        });
      }
    };

    // Run with concurrency limit
    const queue = [...images];
    const workers = [];

    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push(
        (async () => {
          while (queue.length > 0 && !aborted) {
            const item = queue.shift();
            await process(item);
          }
        })()
      );
    }

    await Promise.all(workers);

    const finalStatus = aborted ? "error" : "done";
    chrome.storage.session.set({
      scanState: { status: finalStatus, completed, total, found, errors, lastError, cacheHits },
    });
    chrome.runtime.sendMessage({ type: "SCAN_COMPLETE" });
  }

  // --- Message listener for commands from popup/background ---

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_STATUS") {
      const hasJapanese = detectJapanese();
      const images = collectImageElements();
      sendResponse({ hasJapanese, imageCount: images.length });
      return;
    }

    if (msg.type === "START_SCAN") {
      runOcrOnImages().then(() => {
        sendResponse({ done: true });
      });
      return true;
    }
  });

  // --- Run Phase 1 on load ---

  chrome.storage.session.remove("scanState");
  runDetection();
})();
