# Moji Lens — Privacy Policy

*Last updated: February 27, 2026*

## What Moji Lens Does

Moji Lens is a Chrome extension that extracts Japanese text from images on web pages using optical character recognition (OCR), making the text searchable with your browser's built-in find feature (Ctrl+F).

## Data We Collect

Moji Lens itself does not collect, store, or transmit any personal data to us. We have no servers, no analytics, and no tracking.

## Data Stored Locally in Your Browser

- **Anthropic API key** — stored in `chrome.storage.local` so you don't have to re-enter it. Never sent anywhere except directly to the Anthropic API.
- **OCR cache** — extracted text results keyed by image URL, stored in `chrome.storage.local` to avoid redundant API calls. You can clear this by removing the extension or clearing extension data.
- **Scan progress** — temporary scan state stored in `chrome.storage.session` (cleared when you close your browser).

## Data Sent to Third Parties

When you explicitly click "Scan Page", Moji Lens sends images from the current page to the **Anthropic Messages API** for OCR processing. Specifically:

- Images are converted to base64 and sent to `https://api.anthropic.com/v1/messages`
- Your Anthropic API key is included in the request header for authentication
- No other data (browsing history, page URLs, personal information) is sent
- This only happens when you click "Scan Page" — never automatically

Anthropic's handling of API data is governed by their [Privacy Policy](https://www.anthropic.com/privacy) and [API Terms of Service](https://www.anthropic.com/api-terms). Per Anthropic's API terms, data sent through the API is not used to train their models.

## Page Content Access

Moji Lens reads page content (text and image URLs) to:

- Detect whether the page contains Japanese text (Unicode range check on `document.body.innerText`)
- Identify images that may contain text (`<img>` tags and CSS `background-image` elements)

This detection runs automatically on page load but makes zero network requests. It is purely local DOM inspection.

## Permissions

- **activeTab** — to access the current tab when you interact with the extension
- **storage** — to store your API key and OCR cache locally

## Data Security

All communication with the Anthropic API is over HTTPS. Your API key and cached data are stored in Chrome's built-in extension storage, which is sandboxed per-extension.

## Your Control

- You choose when to scan — the extension never sends data without your explicit action
- You can remove your API key at any time by clearing the field in the extension popup
- You can clear all stored data by removing the extension or going to `chrome://extensions` → Moji Lens → Details → Clear data

## Chrome Web Store User Data Policy Compliance

Moji Lens complies with the [Chrome Web Store Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use). Specifically:

- Data is used solely to provide the extension's stated functionality (Japanese image text extraction)
- Data is not sold to third parties
- Data is not used for advertising or any purpose unrelated to the extension's core functionality
- Data is not transferred to third parties except as necessary to provide the OCR feature (Anthropic API), as explicitly consented to by the user

## Changes to This Policy

If this policy changes, the updated version will be posted at this URL with a new "last updated" date.

## Contact

For questions about this privacy policy, please open an issue on the extension's GitHub repository.
