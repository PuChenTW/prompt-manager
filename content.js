// ============================================================================
// Command Panel State Management
// ============================================================================

const panelState = {
    isOpen: false,
    panelElement: null,
    targetInput: null,
    prompts: [],
    filteredPrompts: [],
    selectedIndex: 0,
    triggerPosition: null,
    cachedPrompts: null,
    cacheTimestamp: 0
};

const CACHE_DURATION = 5000; // 5 seconds
let TRIGGER_CONFIG = { key: '/', code: 'Slash', display: '/' };
const MAX_PREVIEW_LENGTH = 80;

// Load trigger key settings
chrome.storage.local.get(['triggerConfig'], (result) => {
    if (result.triggerConfig) {
        TRIGGER_CONFIG = result.triggerConfig;
    }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.triggerConfig) {
        TRIGGER_CONFIG = changes.triggerConfig.newValue;
    }
});

// ============================================================================
// Command Panel Core Functions
// ============================================================================

function loadPrompts(callback) {
    const now = Date.now();
    if (panelState.cachedPrompts && (now - panelState.cacheTimestamp) < CACHE_DURATION) {
        callback(panelState.cachedPrompts);
        return;
    }

    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        panelState.cachedPrompts = prompts;
        panelState.cacheTimestamp = now;
        callback(prompts);
    });
}

function showPanel(target, isHotkey = false) {
    if (panelState.isOpen) return;

    loadPrompts((prompts) => {
        panelState.isOpen = true;
        panelState.targetInput = target;
        panelState.prompts = prompts;
        panelState.filteredPrompts = prompts;
        panelState.selectedIndex = 0;
        panelState.isHotkeyTrigger = isHotkey;

        createPanelDOM();
        positionPanel(target);
        renderPromptList();
        attachPanelListeners();
    });
}

function hidePanel() {
    if (!panelState.isOpen) return;

    if (panelState.panelElement) {
        panelState.panelElement.remove();
    }

    panelState.isOpen = false;
    panelState.panelElement = null;
    panelState.targetInput = null;
    panelState.filteredPrompts = [];
    panelState.selectedIndex = 0;
    panelState.isHotkeyTrigger = false;
}

function createPanelDOM() {
    const panel = document.createElement('div');
    panel.id = 'prompt-manager-panel';
    panel.className = 'pm-panel';

    panel.innerHTML = `
        <div class="pm-search-wrapper">
            <input type="text" class="pm-search" placeholder="Search prompts..." autocomplete="off" />
        </div>
        <div class="pm-list"></div>
    `;

    document.body.appendChild(panel);
    panelState.panelElement = panel;
}

function positionPanel(target) {
    if (!panelState.panelElement) return;

    const position = getCaretPosition(target);
    if (!position) return;

    const panel = panelState.panelElement;
    const panelHeight = 300;
    const panelWidth = 400;
    const padding = 8;
    const lineHeight = 24; // Approve approximate line height

    let top = position.top + lineHeight;
    let left = position.left;

    // Check if panel would overflow viewport bottom
    if (top + panelHeight > window.innerHeight + window.scrollY) {
        top = position.top - panelHeight - padding;
    }

    // Check if panel would overflow viewport right
    if (left + panelWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - panelWidth - padding;
    }

    // Ensure panel doesn't go off left edge
    if (left < window.scrollX) {
        left = window.scrollX + padding;
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
}

function getCaretPosition(element) {
    if (element.getAttribute('contenteditable') === 'true') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Handle case where range rect is all zeros (e.g. empty line in some editors)
        if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) {
            let container = range.startContainer;
            if (container.nodeType === 3) container = container.parentNode;
            const containerRect = container.getBoundingClientRect();
            return {
                top: containerRect.bottom + window.scrollY,
                left: containerRect.left + window.scrollX
            };
        }

        return {
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX
        };
    } else {
        return getCaretCoordinates(element, element.selectionEnd);
    }
}

// Helper to calculate coordinates for textarea/input
function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);

    document.body.appendChild(div);

    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.visibility = 'hidden';

    // Copy relevant styles
    const properties = [
        'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
        'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
        'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing'
    ];

    properties.forEach(prop => {
        div.style[prop] = style[prop];
    });

    // Mirror content
    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const { offsetLeft: spanLeft, offsetTop: spanTop } = span;
    const rect = element.getBoundingClientRect();

    document.body.removeChild(div);

    return {
        top: rect.top + spanTop + window.scrollY - element.scrollTop + parseInt(style.borderTopWidth || 0),
        left: rect.left + spanLeft + window.scrollX - element.scrollLeft + parseInt(style.borderLeftWidth || 0)
    };
}

function renderPromptList() {
    const listContainer = panelState.panelElement.querySelector('.pm-list');

    if (panelState.filteredPrompts.length === 0) {
        listContainer.innerHTML = '<div class="pm-empty">No prompts found</div>';
        return;
    }

    listContainer.innerHTML = panelState.filteredPrompts.map((prompt, index) => {
        const preview = prompt.content.length > MAX_PREVIEW_LENGTH
            ? prompt.content.substring(0, MAX_PREVIEW_LENGTH) + '...'
            : prompt.content;

        const selectedClass = index === panelState.selectedIndex ? ' pm-item-selected' : '';

        return `
            <div class="pm-item${selectedClass}" data-index="${index}">
                <div class="pm-title">${escapeHtml(prompt.title)}</div>
                <div class="pm-preview">${escapeHtml(preview)}</div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSelection(newIndex) {
    if (panelState.filteredPrompts.length === 0) return;

    panelState.selectedIndex = newIndex;
    renderPromptList();

    // Scroll selected item into view
    const listContainer = panelState.panelElement.querySelector('.pm-list');
    const selectedItem = listContainer.querySelector('.pm-item-selected');
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function filterPrompts(query) {
    if (!query.trim()) {
        panelState.filteredPrompts = panelState.prompts;
    } else {
        panelState.filteredPrompts = panelState.prompts.filter(p =>
            fuzzyMatch(p, query)
        );
    }

    panelState.selectedIndex = 0;
    renderPromptList();
}

function fuzzyMatch(prompt, query) {
    const title = prompt.title.toLowerCase();
    const content = prompt.content.toLowerCase();
    const q = query.toLowerCase();

    // Simple contains match
    if (title.includes(q) || content.includes(q)) {
        return true;
    }

    // Character sequence match
    let qIndex = 0;
    for (let i = 0; i < title.length && qIndex < q.length; i++) {
        if (title[i] === q[qIndex]) qIndex++;
    }

    return qIndex === q.length;
}

function insertSelectedPrompt() {
    if (panelState.filteredPrompts.length === 0) return;

    const prompt = panelState.filteredPrompts[panelState.selectedIndex];
    if (!prompt) return;

    const target = panelState.targetInput;

    // Only remove trigger char if NOT hotkey mode
    if (!panelState.isHotkeyTrigger) {
        removeTriggerChar(target);
    }

    // Hide panel first
    hidePanel();

    // Insert prompt content
    injectIntoActiveElement(prompt.content);
}

function removeTriggerChar(target) {
    if (!target) return;
    const triggerKey = TRIGGER_CONFIG.key;

    target.focus();

    if (target.getAttribute('contenteditable') === 'true') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;

        if (textNode.nodeType === 3) { // Text node
            const text = textNode.textContent;
            const cursorPos = range.startOffset;

            // Find and remove the last trigger key
            for (let i = cursorPos - 1; i >= 0; i--) {
                if (text[i] === triggerKey) {
                    const newText = text.substring(0, i) + text.substring(i + 1);
                    textNode.textContent = newText;
                    range.setStart(textNode, i);
                    range.collapse(true);
                    break;
                }
            }
        }
    } else {
        const start = target.selectionStart;
        const value = target.value;

        // Find and remove the last trigger key
        for (let i = start - 1; i >= 0; i--) {
            if (value[i] === triggerKey) {
                target.value = value.substring(0, i) + value.substring(i + 1);
                target.selectionStart = target.selectionEnd = i;
                break;
            }
        }
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

function attachPanelListeners() {
    const panel = panelState.panelElement;
    const searchInput = panel.querySelector('.pm-search');
    const listContainer = panel.querySelector('.pm-list');

    // Search input
    searchInput.addEventListener('input', (e) => {
        filterPrompts(e.target.value);
    });

    // Click on items
    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.pm-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            panelState.selectedIndex = index;
            insertSelectedPrompt();
        }
    });

    // Focus search input
    searchInput.focus();
}

// Global keyboard listener for panel
document.addEventListener('keydown', (e) => {
    // 1. Handle Panel Navigation (if open)
    if (panelState.isOpen) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                const nextIndex = (panelState.selectedIndex + 1) % panelState.filteredPrompts.length;
                updateSelection(nextIndex);
                return;

            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                const prevIndex = (panelState.selectedIndex - 1 + panelState.filteredPrompts.length) % panelState.filteredPrompts.length;
                updateSelection(prevIndex);
                return;

            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                insertSelectedPrompt();
                return;

            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                hidePanel();
                return;
        }
    }

    // 2. Handle Hotkey Trigger
    // Check if current config is a Hotkey (has modifiers or special key)
    const isHotkeyConfig = TRIGGER_CONFIG.ctrlKey || TRIGGER_CONFIG.altKey || TRIGGER_CONFIG.metaKey || (TRIGGER_CONFIG.key.length > 1);

    if (isHotkeyConfig) {
        // Check if event matches config
        // Note: e.key for letters matches case (a vs A), but config.key was stored from e.key.
        // Usually safe to compare directly or toLowerCase for letters.
        const matchKey = e.key.toLowerCase() === TRIGGER_CONFIG.key.toLowerCase();
        const matchMods = !!e.ctrlKey === !!TRIGGER_CONFIG.ctrlKey &&
            !!e.altKey === !!TRIGGER_CONFIG.altKey &&
            !!e.metaKey === !!TRIGGER_CONFIG.metaKey &&
            !!e.shiftKey === !!TRIGGER_CONFIG.shiftKey;

        if (matchKey && matchMods && isInput(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            showPanel(e.target, true); // isHotkey = true
        }
    }
}, true);

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (!panelState.isOpen) return;

    if (!panelState.panelElement.contains(e.target)) {
        hidePanel();
    }
}, true);

// Trigger detection for TEXT triggers (input event)
document.addEventListener('input', (e) => {
    const target = e.target;

    if (!isInput(target)) return;
    if (panelState.isOpen) return;

    // Only process if config is TEXT trigger (no modifiers, single char)
    const isHotkeyConfig = TRIGGER_CONFIG.ctrlKey || TRIGGER_CONFIG.altKey || TRIGGER_CONFIG.metaKey || (TRIGGER_CONFIG.key.length > 1);

    if (!isHotkeyConfig) {
        if (shouldTriggerText(target)) {
            showPanel(target, false); // isHotkey = false
        }
    }
}, true);

function shouldTriggerText(target) {
    const triggerKey = TRIGGER_CONFIG.key;

    if (target.getAttribute('contenteditable') === 'true') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;

        if (textNode.nodeType !== 3) return false; // Not a text node

        const text = textNode.textContent;
        const cursorPos = range.startOffset;

        // Check if cursor is right after trigger key
        if (cursorPos > 0 && text[cursorPos - 1] === triggerKey) {
            // Check if trigger is at start or preceded by whitespace
            if (cursorPos === 1 || /\s/.test(text[cursorPos - 2])) {
                return true;
            }
        }
    } else {
        const cursorPos = target.selectionStart;
        const value = target.value;

        // Check if cursor is right after trigger key
        if (cursorPos > 0 && value[cursorPos - 1] === triggerKey) {
            // Check if trigger is at start or preceded by whitespace
            if (cursorPos === 1 || /\s/.test(value[cursorPos - 2])) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// Original Content Script Code
// ============================================================================

let lastRightClickedElement = null;

// Track the element that was right-clicked
document.addEventListener('contextmenu', (e) => {
    lastRightClickedElement = e.target;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'inject') {
        injectIntoActiveElement(request.content);
    }
});

function injectIntoActiveElement(content) {
    // Try to find the target element (last right-clicked or currently focused)
    let target = lastRightClickedElement || document.activeElement;

    // If the click was on a sub-element of a contenteditable, find the parent
    if (target && !isInput(target)) {
        const editableParent = target.closest('[contenteditable="true"]');
        if (editableParent) {
            target = editableParent;
        } else {
            target = findAIInputField();
        }
    }

    if (!target) {
        console.error('Prompt Manager: No active input field found.');
        return;
    }

    target.focus();

    // Use execCommand to simulate user input - more reliable for React/Next.js state updates
    const success = document.execCommand('insertText', false, content);

    if (!success) {
        console.warn('Prompt Manager: execCommand failed, falling back to direct value/innerText setting.');
        if (target.getAttribute('contenteditable') === 'true') {
            target.innerText = content;
        } else {
            target.value = content;
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }

    focusVariable(target, content, target.getAttribute('contenteditable') === 'true');
}

function isInput(el) {
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.getAttribute('contenteditable') === 'true';
}

function findAIInputField() {
    // Common selectors for ChatGPT, Claude, Gemini
    return document.querySelector('#prompt-textarea') || // ChatGPT
        document.querySelector('div[contenteditable="true"]') || // ChatGPT/Claude
        document.querySelector('textarea') || // Gemini/Claude fallback
        document.querySelector('[role="textbox"]'); // Generic
}

function focusVariable(target, content, isContentEditable) {
    const variableRegex = /{{.*?}}/;
    const match = content.match(variableRegex);

    if (!match) {
        target.focus();
        return;
    }

    const variableText = match[0];

    if (isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);

        // Search backwards for the variable text
        const startResult = findTextBackwards(range.endContainer, range.endOffset, variableText);

        if (!startResult.found) {
            console.warn('Prompt Manager: Could not locate variable text backwards');
            return;
        }

        const startNode = startResult.node;
        const startOffset = startResult.offset;

        // Find end by walking forward length of variable
        const endResult = walkForward(startNode, startOffset, variableText.length);

        if (!endResult) {
            console.warn('Prompt Manager: Could not calculate variable end');
            return;
        }

        const newRange = document.createRange();
        newRange.setStart(startNode, startOffset);
        newRange.setEnd(endResult.node, endResult.offset);
        sel.removeAllRanges();
        sel.addRange(newRange);

        target.focus();
    }
}

function findTextBackwards(startNode, startOffset, targetText) {
    const reversedTarget = targetText.split('').reverse().join('');
    let buffer = '';
    let node = startNode;
    let offset = startOffset;

    const MAX_STEPS = 5000;
    let steps = 0;

    // Initial adjustment
    if (node.nodeType !== 3) {
        if (offset > 0) {
            node = node.childNodes[offset - 1];
            while (node.lastChild) node = node.lastChild;
            if (node.nodeType === 3) offset = node.length;
            else offset = 0;
        } else {
            // will move previous
        }
    }

    while (steps < MAX_STEPS) {
        if (node.nodeType === 3) {
            const text = node.textContent;
            // Scan backwards
            for (let i = offset - 1; i >= 0; i--) {
                buffer += text[i];
                steps++;

                if (buffer.length >= reversedTarget.length) {
                    // Check match
                    // buffer is built backwards: "d" + "c" + "b" + "a" -> "dcba"
                    // reversedTarget matches the reversed order of characters
                    // If target is "abc", reversed is "cba".
                    // We want to find "abc" in text.
                    // Backwards: "c", "b", "a".
                    // Buffer: "cba".
                    // Buffer Ends With "cba"? Yes.
                    if (buffer.endsWith(reversedTarget)) {
                        // Found start of variable
                        // i is the index of the character added last ("a"), which is the first char of "abc".
                        return { found: true, node: node, offset: i };
                    }
                }
            }
            offset = 0;
        }

        // Move previous
        if (node.previousSibling) {
            node = node.previousSibling;
            while (node.lastChild) node = node.lastChild;
            if (node.nodeType === 3) offset = node.length;
        } else {
            node = node.parentNode;
            if (!node || node === document.body) break;
            offset = 0;
        }
    }
    return { found: false };
}

function walkForward(startNode, startOffset, distance) {
    let node = startNode;
    let offset = startOffset;
    let remaining = distance;

    while (remaining > 0) {
        if (node.nodeType === 3) {
            const available = node.length - offset;
            if (available >= remaining) {
                return { node: node, offset: offset + remaining };
            }
            remaining -= available;
            offset = node.length; // Consumed all
        }

        // Move next
        if (node.nextSibling) {
            node = node.nextSibling;
            while (node.firstChild) node = node.firstChild;
            offset = 0;
        } else {
            // Move up and next
            while (!node.nextSibling && node.parentNode && node.parentNode !== document.body) {
                node = node.parentNode;
            }
            if (node.nextSibling) {
                node = node.nextSibling;
                while (node.firstChild) node = node.firstChild;
                offset = 0;
            } else {
                return null; // EOF
            }
        }
    }
    return { node, offset };
}
