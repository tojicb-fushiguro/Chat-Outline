# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-02-27

### Fixed
- **Gemini Canvas line-number pollution** — when Gemini Canvas (code editor) was open, the outline was incorrectly picking up editor line numbers (`1 2 3 4 5 6 7...`) and code content as user message turns
  - Added `isInsideGeminiCanvas(el)` — walks the DOM upward from any candidate turn element and excludes it if a Canvas/editor wrapper is found (`code-editor`, `mat-drawer`, `mat-sidenav`, `monaco-editor`, `cm-content`, `cm-gutters`, or any element with a canvas-related class, id, or aria-label)
  - Added `isLineNumberNoise(text)` — secondary defence that rejects sequential number strings (e.g. `123456789101112...`) even if an element escapes the DOM walk check
  - `extractText()` Gemini branch now strips `pre`, `code`, and `[class*="code"]` elements from the clone before reading text, preventing code content from leaking into outline labels

---

## [0.2.0] - 2026-02-27

### Added
- **Perplexity AI support** (`www.perplexity.ai`)
  - New `perplexity` selector config in `SELECTORS` using confirmed `.group\/query` Tailwind class
  - `getConfig()` now recognises `perplexity.ai` host
  - `findUserNodeInTurn()` returns the turn element directly for Perplexity (the turn IS the user node)
  - `extractText()` strips Perplexity citation markers (`[1]`, `[2]`, …) and source blocks
  - `updatePosition()` handles Perplexity's layout (`right: 16px`, `top: 76px`)
  - `getSmartTitle()` strips "Perplexity" from document title fallback
  - `isActivePage()` guard added — sidebar only activates on `/search/` and `/thread/` paths, not the Perplexity home screen
  - `qsaAny()` and `findUserNodeInTurn()` wrapped in `try/catch` to silently skip invalid selectors
  - `buildItems()` deduplication upgraded from `Map` to `Set` to correctly handle Perplexity's turn structure
  - `manifest.json` host permissions and content script matches updated

---

## [0.1.0] - 2026-02-03

### Added
- Initial release
- Draggable outline sidebar for ChatGPT and Gemini
- Light/Dark theme auto-detection
- Saved chat groups feature
- Collapsible UI
- Position persistence using Chrome storage
- Intersection observer for active item tracking
- Support for both ChatGPT and Gemini platforms

### Watermark
- **CO-SIDEBAR-6C1E-2026**
- **© 2026 tojicb-fushiguro**

---

## [Unreleased]

### Planned
- Firefox support
- Custom keyboard shortcuts
- Export saved groups
- Search within outline
- Claude.ai support

---
