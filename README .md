# 🔍 SEO Auditor Pro

A professional Chrome extension for SEO auditing — built to compete with tools like Ahrefs' Detailed SEO Extension.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-green) ![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ Features

| Tab | What it does |
|-----|-------------|
| **Overview** | SEO score ring, health checks, meta info, readability, duplicate tag detector, quick tools |
| **Headings** | H1–H6 counts + visual indented heading tree |
| **Links** | Internal/external/nofollow count + broken link checker |
| **Images** | Alt text audit, coverage %, skipped images |
| **Schema** | JSON-LD schema detection (all formats including @graph) |
| **Social** | OG + Twitter tags with real Facebook & Twitter preview cards |
| **Hreflang** | Detects all hreflang alternate tags |
| **Speed ⚡** | Core Web Vitals via Google PageSpeed API (Mobile + Desktop) |
| **Keywords** | Top 20 keyword density with search filter |
| **Tips 💡** | Auto SEO recommendations + PDF & CSV export |
| **Compare 🆚** | Compare two pages side by side (persistent across sessions) |
| **Link Map 🕸️** | Visual canvas graph of internal + external links |
| **SERP 🔎** | Google search result preview with character count bars |
| **History 🕓** | Auto-saves last 20 audited pages with favicons |
| **Settings ⚙️** | Custom SEO score weightage sliders |

---

## 🚀 Installation

### From Source (Developer Mode)
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the extension folder
6. Done! The extension icon will appear in your toolbar

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** — no frameworks, no dependencies
- **Google PageSpeed Insights API** — for Core Web Vitals
- **Chrome Storage API** — for persistent history and settings
- **HTML5 Canvas** — for the Link Map visualization

---

## 📁 File Structure

```
seo-auditor-pro/
├── manifest.json       # Extension config
├── popup.html          # UI structure + CSS
├── popup.js            # All logic (~1000 lines)
├── privacy.html        # Privacy policy
├── icon48.png          # Extension icon
└── icon128.png         # Extension icon (large)
```

---

## 🔐 Privacy

This extension does **not** collect or transmit any personal data.
All data is stored locally on your device using `chrome.storage.local`.

The only external requests made are:
- **Google PageSpeed API** — when you click the Speed tab
- **HEAD requests** — when you run the broken link checker

[Full Privacy Policy](./privacy.html)

---

## 👨‍💻 Author

**Viraj Singh**  
BBA Digital Marketing — JECRC University, Jaipur

---

## 📄 License

MIT License — feel free to use, modify and learn from this project.
