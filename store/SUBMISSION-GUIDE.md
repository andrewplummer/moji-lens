# Moji Lens — Chrome Web Store Submission Guide

## Prerequisites

1. **Developer account**: Register at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
2. **Privacy policy hosting**: Host `privacy-policy.html` somewhere public (GitHub Pages, Netlify, etc.) and note the URL
3. **Screenshots**: You need 1-5 screenshots at 1280x800. Take these yourself by:
   - Navigate to a Japanese site (e.g. manboo.co.jp/stores/net_kabuki.php)
   - Show the extension badge with image count
   - Show the popup mid-scan
   - Show OCR results with Ctrl+F highlighting a Japanese term
   - Use Chrome DevTools device toolbar to get exact 1280x800 viewport

## Assets Checklist

| Asset | File | Size | Required |
|-------|------|------|----------|
| Extension ZIP | (create from extension dir) | - | Yes |
| Store icon | `store-icon-128.png` | 128x128 | Yes |
| Small promo tile | `promo-tile-440x280.png` | 440x280 | Yes |
| Marquee tile | `marquee-tile-1400x560.png` | 1400x560 | Optional |
| Screenshots | (take manually) | 1280x800 | Yes (1-5) |
| Privacy policy | `privacy-policy.html` | hosted URL | Yes |

## Creating the ZIP

From the `japanese-image-search/` directory, ZIP only the extension files (not the `store/` folder):

```bash
cd japanese-image-search
zip -r ../moji-lens.zip . -x "store/*" -x ".*"
```

## Dashboard Fields

### Listing Tab

**Name:** Moji Lens

**Summary (132 chars max):**
Find Japanese text hidden in images. AI-powered OCR makes image text searchable with Ctrl+F.

**Description:** (see `description.txt` — paste the full contents)

**Category:** Search Tools (under Productivity)

**Language:** English

### Graphic Assets Tab

Upload the store icon, promo tile, marquee tile, and screenshots.

### Privacy Tab

**Single purpose description:**
Moji Lens extracts Japanese text from images on web pages using Claude Vision OCR, injecting the text into the DOM so it becomes searchable with the browser's built-in Ctrl+F.

**Permission justifications:**

| Permission | Justification |
|------------|---------------|
| `activeTab` | Required to access the current page's images and DOM when the user clicks "Scan Page" |
| `storage` | Required to store the user's API key and cache OCR results locally to minimize API costs |
| Content script on `<all_urls>` | Required to detect Japanese text and count images on any webpage. The detection phase makes zero network requests — it only inspects the DOM. OCR scanning only occurs when explicitly triggered by the user. |

**Data use disclosure checkboxes:**
- [x] Website content (reading page text and image URLs for OCR)
- [x] User activity (user-initiated scan action)
- Certify that data use complies with Chrome Web Store policies

**Does your extension use remote code?** No

**Privacy policy URL:** [your hosted URL for privacy-policy.html]

### Distribution Tab

**Visibility:** Public
**Distribution:** All regions
