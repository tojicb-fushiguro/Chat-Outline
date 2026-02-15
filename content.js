/*!
 * Chat Outline Sidebar (Local)
 * (c) 2026 tojicb-fushiguro
 * SPDX-License-Identifier: MIT
 * Watermark: CO-SIDEBAR-6C1E-2026
 */
(() => {
  const STORAGE_KEY = "co_collapsed_v1";
  const POS_KEY = "co_position_v1"; 
  const GROUPS_KEY = "co_groups_v1";
  const HOST = location.hostname;

  // --- Configuration & Helpers ---
  const SELECTORS = {
    chatgpt: {
      turn: [
        'div[data-testid^="conversation-turn"]',
        'article[data-testid^="conversation-turn"]',
        'main [data-message-author-role]'
      ],
      userInTurn: [
        '[data-message-author-role="user"]',
        'div[data-message-author-role="user"]'
      ],
      title: [
         'title', 
         'div[data-testid="conversation-title"]', 
         'nav a.active', 
         'ol li a.bg-token-sidebar-surface-tertiary', 
      ]
    },
    gemini: {
      turn: [
        'main [data-test-id="chat-turn"]',
        'main [role="article"]',
        'main .conversation-container [class*="turn"]',
        'main div'
      ],
      userInTurn: [
        '[data-author="user"]',
        '[aria-label*="You" i]',
        '[class*="user" i]'
      ],
      title: [
          'title',
          'h1[data-test-id="chat-title"]', 
          'div[role="heading"][aria-level="1"]', 
          'button[aria-expanded="true"] span' 
      ]
    }
  };

  function getConfig() {
    if (HOST.includes("chatgpt.com")) return SELECTORS.chatgpt;
    if (HOST.includes("gemini.google.com")) return SELECTORS.gemini;
    return null;
  }

  function parseRgb(str) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(str || "");
    if (!m) return [255, 255, 255]; 
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }

  function luminance([r, g, b]) {
    const srgb = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function derivePageIsDark() {
    const elementsToCheck = [
      document.querySelector("main"),
      document.body,
      document.documentElement
    ];
    let effectiveBg = "rgb(255, 255, 255)"; 
    for (const el of elementsToCheck) {
      if (!el) continue;
      const style = getComputedStyle(el);
      const bg = style.backgroundColor;
      if (bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent") {
        effectiveBg = bg;
        break;
      }
    }
    return luminance(parseRgb(effectiveBg)) < 0.55; 
  }

  function applyTheme(root) {
    const htmlTheme = document.documentElement.getAttribute("data-theme");
    const isDarkFromAttr = htmlTheme ? htmlTheme.toLowerCase().includes("dark") : null;
    let isDarkFromClass = null;
    if (document.documentElement.classList.contains("dark")) isDarkFromClass = true;
    else if (document.documentElement.classList.contains("light")) isDarkFromClass = false;
    const pageIsDark = derivePageIsDark();
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const isDark = isDarkFromAttr ?? isDarkFromClass ?? pageIsDark ?? prefersDark ?? false;

    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(isDark ? "theme-dark" : "theme-light");
  }

  const uniq = (arr) => [...new Set(arr)];
  function qsaAny(selectors, root = document) {
    for (const sel of selectors) {
      const nodes = Array.from(root.querySelectorAll(sel));
      if (nodes.length) return nodes;
    }
    return [];
  }
  function findUserNodeInTurn(turn, cfg) {
    for (const sel of cfg.userInTurn) {
      const n = turn.querySelector(sel);
      if (n) return n;
    }
    return null;
  }
  function extractText(el) {
    if (!el) return "";
    
    // For Gemini, try to find the actual text content element, excluding file attachments
    if (HOST.includes("gemini.google.com")) {
      // Clone the element to avoid modifying DOM
      const clone = el.cloneNode(true);
      
      // Remove file attachment containers (usually have specific classes or contain PDF/Unknown text)
      const fileElements = clone.querySelectorAll('[class*="file"], [class*="attachment"]');
      fileElements.forEach(fileEl => fileEl.remove());
      
      // Also remove any elements that contain "PDF", "Unknown", file extensions
      const allDivs = Array.from(clone.querySelectorAll('div'));
      allDivs.forEach(div => {
        const text = div.textContent || '';
        // If this div ONLY contains file-related text and nothing else meaningful
        if (/^(.*\.(ahk|txt|pdf|doc|docx|csv|json|xml|py|js|ts|java|cpp|c|h|css|html|md|log|bat|sh|zip|rar|7z)\s*(PDF|Unknown|Document)?|Adobe Cloud Services|PDF|Unknown)$/i.test(text.trim()) && text.length < 100) {
          div.remove();
        }
      });
      
      let t = (clone.innerText || clone.textContent || "").trim();
      
      // Strip "You said" prefix
      t = t.replace(/^You said\s*/i, "");
      t = t.replace(/^Gemini said\s*/i, "");
      
      // Remove any remaining file patterns
      t = t.replace(/[\w\-_.]+\.(ahk|txt|pdf|doc|docx|csv|json|xml|py|js|ts|java|cpp|c|h|css|html|md|log|bat|sh|zip|rar|7z)\s+(PDF|Unknown|Document)/gi, "");
      t = t.replace(/Adobe Cloud Services\s+PDF/gi, "");
      
      return t.replace(/\s+/g, " ").trim();
    }
    
    // For ChatGPT, use simple extraction
    let t = (el.innerText || el.textContent || "").trim();
    return t.replace(/\s+/g, " ");
  }
  const shorten = (text, max = 70) =>
    text.length <= max ? text : text.slice(0, max - 1) + "…";

  // --- State Variables ---
  let viewMode = 'outline'; // 'outline' | 'groups'
  let outlineItems = [];
  let savedGroups = []; 
  let activeId = null;
  let isDragging = false;
  let hasUserMoved = false;
  let userDragPos = null;
  let isManualScroll = false;
  let manualScrollTimer = null;

  // --- UI injection ---
  function ensureUI() {
    let root = document.getElementById("co-root");
    if (root) return root;

    root = document.createElement("div");
    root.id = "co-root";
    root.style.transition = "opacity 120ms ease-out, top 300ms cubic-bezier(0.2, 0, 0, 1), left 300ms cubic-bezier(0.2, 0, 0, 1)";

    root.innerHTML = `
      <div id="co-collapsed" title="Drag to move • Click to open">☰ Outline</div>
      <div id="co-panel">
        <div id="co-header">
          <div id="co-title">Outline</div>
          <div id="co-actions">
            <button class="co-btn" id="co-groups-toggle" title="Toggle Groups/Outline">📂</button>
            <button class="co-btn" id="co-move" title="Drag to move • Click to reset">✥</button>
            <button class="co-btn" id="co-refresh" title="Refresh">↻</button>
            <button class="co-btn co-close-btn" id="co-close" title="Close">✕</button>
          </div>
        </div>
        <div id="co-sub-header"></div>
        <div id="co-list"></div>
      </div>
    `;
    document.documentElement.appendChild(root);

    applyTheme(root);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => applyTheme(root));
    const themeObs = new MutationObserver(() => applyTheme(root));
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });

    const collapsedBtn = root.querySelector("#co-collapsed");
    const refreshBtn = root.querySelector("#co-refresh");
    const closeBtn = root.querySelector("#co-close");
    const moveBtn = root.querySelector("#co-move");
    const groupsBtn = root.querySelector("#co-groups-toggle");

    refreshBtn.addEventListener("click", rebuild);
    closeBtn.addEventListener("click", () => setCollapsed(true));
    
    groupsBtn.addEventListener("click", () => {
        viewMode = viewMode === 'outline' ? 'groups' : 'outline';
        root.querySelector("#co-title").textContent = viewMode === 'outline' ? 'Outline' : 'Saved Chats';
        groupsBtn.textContent = viewMode === 'outline' ? '📂' : '☰';
        renderList();
    });

    makeDraggable(root, collapsedBtn, () => setCollapsed(false));
    makeDraggable(root, moveBtn, () => {
        hasUserMoved = false;
        userDragPos = null;
        chrome.storage?.local.remove(POS_KEY);
    });

    chrome.storage?.local.get([STORAGE_KEY, POS_KEY, GROUPS_KEY], (res) => {
      if (res?.[POS_KEY]) {
        userDragPos = res[POS_KEY]; 
        hasUserMoved = true;
      }
      if (res?.[GROUPS_KEY]) {
        savedGroups = res[GROUPS_KEY];
      }
      applyCollapsed(Boolean(res?.[STORAGE_KEY]));
    });

    return root;
  }

  // --- Dragging Logic ---
  function makeDraggable(el, handle, onClick) {
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
    
    handle.addEventListener("mousedown", dragStart);

    function dragStart(e) {
      e.preventDefault(); 
      const rect = el.getBoundingClientRect();
      el.style.right = 'auto'; 
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.transition = 'none';

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", dragEnd);
    }

    function drag(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${initialLeft + dx}px`;
      el.style.top = `${initialTop + dy}px`;
    }

    function dragEnd(e) {
      isDragging = false;
      el.style.transition = "opacity 120ms ease-out, top 300ms ease, left 300ms ease";
      document.removeEventListener("mousemove", drag);
      document.removeEventListener("mouseup", dragEnd);

      const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
      if (dist < 5) {
          if (onClick) onClick();
          return; 
      }
      hasUserMoved = true;
      userDragPos = { top: el.style.top, left: el.style.left };
      chrome.storage?.local.set({ [POS_KEY]: userDragPos });
    }
  }

  function applyCollapsed(collapsed) {
    const root = document.getElementById("co-root");
    if (!root) return;
    root.classList.toggle("collapsed", collapsed);
    if (hasUserMoved && userDragPos) {
        root.style.top = userDragPos.top;
        root.style.left = userDragPos.left;
        root.style.right = 'auto';
    } else {
        updatePosition();
    }
  }

  function setCollapsed(collapsed) {
    applyCollapsed(collapsed);
    chrome.storage?.local.set({ [STORAGE_KEY]: collapsed });
  }

  // --- GROUPS LOGIC ---
  function saveGroups() {
    chrome.storage?.local.set({ [GROUPS_KEY]: savedGroups });
    // Don't re-render entire list here to prevent input loss during rename
  }

  function createGroup(name) {
    if (!name.trim()) return;
    const newGroup = {
      id: "g_" + Date.now(),
      name: name.trim(),
      items: []
    };
    savedGroups.unshift(newGroup); 
    saveGroups();
    renderList(); // Render after creation
  }

  function deleteGroup(groupId) {
    if (!confirm("Delete this group and all saved chats inside it?")) return;
    savedGroups = savedGroups.filter(g => g.id !== groupId);
    saveGroups();
    renderList();
  }

  function getSmartTitle() {
      let docTitle = document.title || "";
      docTitle = docTitle.replace(/ - (ChatGPT|Gemini|Google).*/, "").trim();
      
      if (docTitle && docTitle !== "ChatGPT" && docTitle !== "Gemini") {
          return docTitle;
      }

      const cfg = getConfig();
      if (cfg && cfg.title) {
          const selectors = [
              'h1',
              'div[class*="title"]',
              'div[data-testid="conversation-title"]',
              'nav a[class*="active"]',
          ];
          
          for(const sel of selectors) {
              const el = document.querySelector(sel);
              if(el && el.innerText.length > 2) {
                  return el.innerText.trim();
              }
          }
      }

      if (outlineItems && outlineItems.length > 0) {
          return "Chat: " + outlineItems[0].label;
      }

      return "Untitled Chat";
  }

  function saveCurrentChat(groupId) {
    const group = savedGroups.find(g => g.id === groupId);
    if (!group) return;

    const title = getSmartTitle();

    group.items.unshift({
      id: "i_" + Date.now(),
      title: title,
      url: window.location.href,
      date: new Date().toLocaleDateString()
    });
    saveGroups();
    renderList();
  }

  function deleteChat(groupId, itemId) {
    const group = savedGroups.find(g => g.id === groupId);
    if (!group) return;
    group.items = group.items.filter(i => i.id !== itemId);
    saveGroups();
    renderList();
  }

  // NEW: Rename Chat Function
  function renameChat(groupId, itemId, newName) {
    const group = savedGroups.find(g => g.id === groupId);
    if (!group) return;
    const item = group.items.find(i => i.id === itemId);
    if (!item) return;
    item.title = newName.trim() || item.title; // Fallback to old name if empty
    saveGroups();
    renderList();
  }

  // --- RENDERERS ---
  function renderOutline(root, list) {
    document.getElementById("co-sub-header").innerHTML = ""; 
    
    if (!outlineItems.length) {
      list.innerHTML = `<div class="co-item" style="opacity:0.7">No user messages found.</div>`;
      return;
    }

    for (const it of outlineItems) {
      const row = document.createElement("div");
      row.className = "co-item" + (it.id === activeId ? " active" : "");

      if (it.thumb) {
        const img = document.createElement("img");
        img.src = it.thumb;
        row.appendChild(img);
      }

      const txt = document.createElement("span");
      txt.textContent = it.label;
      row.appendChild(txt);

      row.addEventListener("click", () => {
        isManualScroll = true;
        if (manualScrollTimer) clearTimeout(manualScrollTimer);
        manualScrollTimer = setTimeout(() => { isManualScroll = false; }, 2000);

        activeId = it.id;
        Array.from(root.querySelectorAll(".co-item")).forEach(n => n.classList.remove("active"));
        row.classList.add("active");
        
        if (it.targetEl && it.targetEl.isConnected) {
            // For Gemini, find the actual user message element within the turn
            let scrollTarget = it.targetEl;
            if (HOST.includes("gemini.google.com")) {
              const userNode = findUserNodeInTurn(it.targetEl, getConfig());
              if (userNode) scrollTarget = userNode;
            }
            scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            const freshEl = document.getElementById(it.id);
            if (freshEl) freshEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      list.appendChild(row);
    }
  }

  function renderGroups(root, list) {
    const subHeader = document.getElementById("co-sub-header");
    subHeader.innerHTML = `
      <div style="display:flex; gap:6px; padding:8px; border-bottom:1px solid var(--co-border);">
        <input type="text" id="co-new-group-name" placeholder="New Group Name..." style="flex:1; padding:4px 8px; border-radius:6px; border:1px solid var(--co-border); background:var(--co-fill); color:var(--co-text); font-size:12px;">
        <button id="co-add-group-btn" class="co-btn" style="padding:4px 10px;">+</button>
      </div>
    `;
    
    subHeader.querySelector("#co-add-group-btn").addEventListener("click", () => {
        const input = subHeader.querySelector("#co-new-group-name");
        createGroup(input.value);
    });
    subHeader.querySelector("#co-new-group-name").addEventListener("keypress", (e) => {
        if (e.key === "Enter") createGroup(e.target.value);
    });

    if (!savedGroups.length) {
        list.innerHTML = `<div class="co-item" style="opacity:0.7; justify-content:center;">No groups created yet.</div>`;
        return;
    }

    savedGroups.forEach(group => {
        const groupEl = document.createElement("div");
        groupEl.className = "co-group";
        
        const header = document.createElement("div");
        header.className = "co-group-header";
        header.innerHTML = `
            <span class="co-group-title">📁 ${group.name}</span>
            <div class="co-group-actions">
                <button class="co-btn-mini co-save-curr" title="Save current chat here">Save This</button>
                <button class="co-btn-mini co-del-group" title="Delete Group">✕</button>
            </div>
        `;

        header.querySelector(".co-save-curr").addEventListener("click", (e) => {
            e.stopPropagation();
            saveCurrentChat(group.id);
        });
        header.querySelector(".co-del-group").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteGroup(group.id);
        });

        header.addEventListener("click", () => {
            groupEl.classList.toggle("open");
        });

        groupEl.appendChild(header);

        const itemsContainer = document.createElement("div");
        itemsContainer.className = "co-group-items";
        
        if (group.items.length === 0) {
            itemsContainer.innerHTML = `<div class="co-group-item empty">Empty</div>`;
        } else {
            group.items.forEach(item => {
                const itemEl = document.createElement("div");
                itemEl.className = "co-group-item";
                
                // Create link element
                const link = document.createElement("a");
                link.href = item.url;
                link.className = "co-link";
                link.target = "_self";
                link.textContent = item.title;
                link.title = "Double-click to rename"; 

                // FIX: Add click handler to prevent navigation ONLY on double click
                // We do this by preventing default temporarily
                link.addEventListener("click", (e) => {
                    // Logic: If a double click happens, we want to cancel the navigation
                    // But 'dblclick' fires AFTER two 'click' events.
                    // This is tricky. A common pattern is to delay the click action slightly.
                    // However, preventing default on 'dblclick' is usually enough if the browser handles it,
                    // but since the first click navigates immediately, we need a slight delay or a distinct UI.
                    
                    // IMPROVED APPROACH: Use a "View" button for navigation and let the text be purely for renaming?
                    // OR: Delay navigation by 250ms to wait for potential second click.
                });

                // Let's implement the delay strategy for smoother UX
                let clickTimer = null;
                link.addEventListener("click", (e) => {
                    e.preventDefault(); // Stop immediate navigation
                    
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        // It was a double click, handled by dblclick listener
                    } else {
                        clickTimer = setTimeout(() => {
                            window.location.href = item.url; // Navigate after delay if no second click
                            clickTimer = null;
                        }, 250); 
                    }
                });

                const delBtn = document.createElement("button");
                delBtn.className = "co-del-item";
                delBtn.title = "Remove";
                delBtn.textContent = "✕";

                // Double click to rename
                link.addEventListener("dblclick", (e) => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    if (clickTimer) clearTimeout(clickTimer); // Ensure navigation doesn't fire

                    // Create input replacement
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = item.title;
                    input.style.flex = "1";
                    input.style.minWidth = "0"; 
                    input.style.fontSize = "12px";
                    input.style.border = "1px solid var(--co-accent)";
                    input.style.borderRadius = "4px";
                    input.style.padding = "2px 4px";
                    input.style.marginRight = "6px";
                    input.style.background = "var(--co-bg)";
                    input.style.color = "var(--co-text)";
                    
                    // Replace link with input
                    itemEl.replaceChild(input, link);
                    input.focus();
                    input.select();

                    // Save on Blur or Enter
                    const finishRename = () => {
                       renameChat(group.id, item.id, input.value);
                    };

                    input.addEventListener("blur", finishRename);
                    input.addEventListener("keypress", (ev) => {
                        if (ev.key === "Enter") {
                            input.removeEventListener("blur", finishRename); 
                            finishRename();
                        }
                    });
                    
                    input.addEventListener("click", (ev) => ev.stopPropagation());
                });

                delBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteChat(group.id, item.id);
                });

                itemEl.appendChild(link);
                itemEl.appendChild(delBtn);
                itemsContainer.appendChild(itemEl);
            });
        }
        groupEl.appendChild(itemsContainer);
        list.appendChild(groupEl);
    });
  }

  function renderList() {
    const root = ensureUI();
    const list = root.querySelector("#co-list");
    list.innerHTML = "";

    if (viewMode === 'groups') {
        renderGroups(root, list);
    } else {
        renderOutline(root, list);
    }
  }

  // --- Outline Analysis Logic ---
  const unlockManualScroll = () => {
    if (isManualScroll) {
      isManualScroll = false;
      if (manualScrollTimer) clearTimeout(manualScrollTimer);
    }
  };
  window.addEventListener("wheel", unlockManualScroll, { passive: true });
  window.addEventListener("touchmove", unlockManualScroll, { passive: true });
  window.addEventListener("keydown", unlockManualScroll, { passive: true });

  function isStrictlyVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const pStyle = window.getComputedStyle(parent);
      if (pStyle.display === "none" || pStyle.visibility === "hidden") return false;
      if (parent.getAttribute("aria-hidden") === "true") return false;
      parent = parent.parentElement;
    }
    return true;
  }

  function getTurns(cfg) {
    return uniq(qsaAny(cfg.turn)).filter(el => isStrictlyVisible(el));
  }

  function isGeminiNoise(text) {
    if (!text) return true;
    // Filter out common Gemini UI noise
    return /^(sources|view other drafts|show drafts|related content|view more|you said|gemini said|\+\d+|👍|👎|unknown|pdf|document)$/i.test(text.trim());
  }

  function isPaginationPattern(text) {
    return /^\d+(\s+\d+)+$/.test(text.trim());
  }

  function isPurelyNumericOrSymbols(text) {
    return /^[\d\s.,…+\-👍👎]+$/.test(text.trim());
  }

  function buildItems(cfg) {
    const turns = getTurns(cfg);
    const result = [];
    const userMap = new Map();

    for (const turn of turns) {
      const userNode = findUserNodeInTurn(turn, cfg);
      if (!userNode) continue;
      userMap.set(userNode, turn);
    }

    let idx = 0;
    let lastLabel = null;

    for (const [userNode, turn] of userMap.entries()) {
      let text = extractText(userNode);
      const imgs = Array.from(userNode.querySelectorAll('img')).filter(img => (img.naturalWidth || img.width) > 40);
      const thumb = imgs.length ? imgs[0].src : null;

      if (!text && thumb) text = "Image";
      if ((!text || text.length < 2) && !thumb) continue;
      if (isGeminiNoise(text) || isPaginationPattern(text)) continue;

      const label = shorten(text, 90);
      if (result.length > 0) {
        const prev = result[result.length - 1];
        if (prev.label === "Image" && label !== "Image") {
           prev.label = label;
           prev.id = turn.id || prev.id; 
           prev.targetEl = turn;
           continue; 
        }
      }

      if (label === lastLabel) continue;
      lastLabel = label;

      const id = `co-${idx++}`;
      if (!turn.id || turn.id.startsWith('co-')) turn.id = id;

      result.push({ id: turn.id, label, thumb, targetEl: turn });
    }
    
    while (result.length > 0) {
      const lastItem = result[result.length - 1];
      if (isGeminiNoise(lastItem.label) || isPurelyNumericOrSymbols(lastItem.label) || lastItem.label.length < 2) {
        result.pop();
      } else {
        break; 
      }
    }
    return result.length > 300 ? result.slice(0, 300) : result;
  }

  // --- Core Lifecycle ---
  let io = null;
  function setupIntersectionObserver() {
    if (io) io.disconnect();
    io = new IntersectionObserver((entries) => {
      if (isManualScroll || viewMode !== 'outline') return;
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target?.id;
      if (id && id !== activeId) {
        activeId = id;
        const root = document.getElementById("co-root");
        if(root) {
            Array.from(root.querySelectorAll(".co-item")).forEach(n => n.classList.remove("active"));
            const idx = outlineItems.findIndex(i => i.id === activeId);
            const nodes = root.querySelectorAll(".co-item");
            if (idx >= 0 && nodes[idx]) nodes[idx].classList.add("active");
        }
      }
    }, { root: null, threshold: [0.2, 0.4, 0.6] });

    for (const it of outlineItems) {
      if (it.targetEl) io.observe(it.targetEl);
    }
  }

  let rebuildTimer = null;
  function rebuild() {
    const cfg = getConfig();
    if (!cfg) return;
    const root = ensureUI();
    applyTheme(root);
    
    outlineItems = buildItems(cfg);
    if (!activeId && outlineItems.length) activeId = outlineItems[outlineItems.length - 1].id;
    
    renderList();
    if (viewMode === 'outline') setupIntersectionObserver();
  }
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 250);
  }

  function observeChanges() {
    const target = document.querySelector("main") || document.body;
    const mo = new MutationObserver(() => scheduleRebuild());
    mo.observe(target, { childList: true, subtree: true });
  }
  function hookHistory() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    history.pushState = function (...args) { _pushState.apply(this, args); scheduleRebuild(); };
    history.replaceState = function (...args) { _replaceState.apply(this, args); scheduleRebuild(); };
    window.addEventListener("popstate", () => scheduleRebuild());
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function isChatGPTGenerating() {
    return Boolean(
      document.querySelector('button[aria-label="Stop generating"]') ||
      document.querySelector('button[aria-label*="Stop" i]') ||
      document.querySelector('[data-testid*="stop"]')
    );
  }
  function isAnyDialogOpen() {
    return [...document.querySelectorAll('[role="dialog"]')].some(isVisible);
  }
  function getRightSidebarGapPx() {
    const main = document.querySelector("main");
    if (!main) return 0;
    const r = main.getBoundingClientRect();
    const gap = window.innerWidth - (r.left + r.width);
    return Math.max(0, Math.min(gap, 640));
  }
  function isGeminiCanvasOpen() {
    if (!HOST.includes("gemini.google.com")) return false;
    const closeBtn = document.querySelector('button[aria-label="Close file"], button[aria-label="Close preview"], button[aria-label="Close code"]');
    if (closeBtn && isVisible(closeBtn)) return true;
    const sideNav = document.querySelector('mat-sidenav[opened]');
    if (sideNav && isVisible(sideNav)) {
       const rect = sideNav.getBoundingClientRect();
       if (rect.left > window.innerWidth / 2) return true; 
    }
    const main = document.querySelector("main");
    if (main) {
        const mainRect = main.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        if (windowWidth > 1000 && (windowWidth - mainRect.right) > (windowWidth * 0.25)) return true;
    }
    return false;
  }

  function updatePosition() {
    const root = document.getElementById("co-root");
    if (!root || isDragging || hasUserMoved) return;

    if (HOST.includes("chatgpt.com")) {
      const baseRight = 16;
      const targetGap = getRightSidebarGapPx();
      root.style.right = `${baseRight + targetGap}px`;
      root.style.top = "76px";
      root.style.left = "auto"; 
    } else if (HOST.includes("gemini.google.com")) {
      const canvasOpen = isGeminiCanvasOpen();
      root.style.top = canvasOpen ? "150px" : "76px";
      root.style.right = "16px"; 
      root.style.left = "auto";
    }
  }

  function updateVisibility() {
    const root = ensureUI();
    applyTheme(root);
    if (!root) return;
    const hide = isChatGPTGenerating() || isAnyDialogOpen();
    root.style.opacity = hide ? "0" : "1";
    root.style.pointerEvents = hide ? "none" : "auto";
    root.classList.remove("behind");
  }
  function animationLoop() {
    updatePosition();
    requestAnimationFrame(animationLoop);
  }

  hookHistory();
  observeChanges();
  rebuild();
  animationLoop();
  setInterval(updateVisibility, 200);

})();
