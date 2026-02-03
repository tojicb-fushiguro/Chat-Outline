# Chat Outline Sidebar (Local)

A lightweight Chrome Extension that adds a draggable outline sidebar for chat pages, making it easier to navigate messages on:
- ChatGPT (chatgpt.com)
- Gemini (gemini.google.com)

**Watermark:** CO-SIDEBAR-6C1E-2026  
**© 2026 YOUR_NAME**

---

## Features

- 📌 Floating “Outline” panel that lists user turns for quick navigation
- 🎛️ Collapsible UI and draggable positioning
- 🌓 Light/Dark theme awareness
- 📂 “Saved Chats” groups (save current chat URL into named groups)
- 💾 Persists UI state and groups using Chrome storage

---

## Installation (Load Unpacked)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the project folder (the folder containing `manifest.json`).

> Note: `manifest.json` references an icon at `icons/icon128.jpg`.  
> Make sure that file exists or update the manifest icon path.

---

## Usage

1. Open ChatGPT or Gemini in your browser.
2. The sidebar appears on the page.
3. Click outline items to scroll to that message.
4. Use the 📂 button to switch between **Outline** and **Saved Chats**.

---

## Permissions

- `storage` — used to save:
  - collapsed/expanded state
  - draggable position
  - saved groups/chats

Host permissions:
- `https://chatgpt.com/*`
- `https://gemini.google.com/*`

---

## Project Structure

- `manifest.json` — Chrome extension manifest (MV3)
- `content.js` — content script injected into supported pages
- `style.css` — UI styling
- `icons/` — extension icons (recommended)

---

## License

Choose one:
- MIT (open-source)  

See `LICENSE`.

---

## Attribution

If you use or fork this project, keep the watermark and attribution:
**CO-SIDEBAR-6C1E-2026 • © 2026 YOUR_NAME**
