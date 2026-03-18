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
    cacheTimestamp: 0,
    listenerController: null  // AbortController to clean up panel listeners on close
};

// 5s balances freshness vs. latency on repeated hotkey presses within a session
const CACHE_DURATION = 5000;
// null until chrome.storage.local.get callback fires; keydown handler guards against this
let TRIGGER_CONFIG = null;
// 80 chars fits two lines in the panel item without overflow
const MAX_PREVIEW_LENGTH = 80;

// Load trigger key settings; TRIGGER_CONFIG stays null until this resolves
chrome.storage.local.get(['triggerConfig'], (result) => {
    TRIGGER_CONFIG = result.triggerConfig || {
        key: '/',
        code: 'Slash',
        display: 'Ctrl+/',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false
    };
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

    chrome.runtime.sendMessage({ action: 'getPrompts' }, (response) => {
        const prompts = response?.prompts || [];
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
        renderPromptList();
        attachPanelListeners();
    });
}

function hidePanel() {
    if (!panelState.isOpen) return;

    // Abort all panel-scoped listeners before removing the DOM node
    panelState.listenerController?.abort();
    panelState.listenerController = null;

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

    // Hide panel first
    hidePanel();

    // Insert prompt content into the stored target element
    injectIntoActiveElement(prompt.content, target);
}

function attachPanelListeners() {
    const panel = panelState.panelElement;
    if (!panel) return;

    const controller = new AbortController();
    panelState.listenerController = controller;
    const { signal } = controller;

    const searchInput = panel.querySelector('.pm-search');
    const listContainer = panel.querySelector('.pm-list');

    searchInput.addEventListener('input', (e) => {
        filterPrompts(e.target.value);
    }, { signal });

    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.pm-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            panelState.selectedIndex = index;
            insertSelectedPrompt();
        }
    }, { signal });

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
                const nextIndex = (panelState.selectedIndex + 1) % (panelState.filteredPrompts.length || 1);
                updateSelection(nextIndex);
                return;

            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                const length = panelState.filteredPrompts.length || 1;
                const prevIndex = (panelState.selectedIndex - 1 + length) % length;
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

    // 2. Handle Hotkey Trigger (skip if config not yet loaded from storage)
    if (!TRIGGER_CONFIG) return;

    const matchKey = e.key.toLowerCase() === TRIGGER_CONFIG.key.toLowerCase();
    const matchMods = !!e.ctrlKey === !!TRIGGER_CONFIG.ctrlKey &&
        !!e.altKey === !!TRIGGER_CONFIG.altKey &&
        !!e.metaKey === !!TRIGGER_CONFIG.metaKey &&
        !!e.shiftKey === !!TRIGGER_CONFIG.shiftKey;

    const isCombination = e.ctrlKey || e.altKey || e.metaKey;

    if (matchKey && matchMods && isCombination && isInput(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        showPanel(e.target, true);
    }
}, true);

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (!panelState.isOpen) return;
    if (panelState.panelElement && !panelState.panelElement.contains(e.target)) {
        hidePanel();
    }
}, true);

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

function resolveTarget(targetElement) {
    let target = targetElement || lastRightClickedElement || document.activeElement;

    if (target && !isInput(target)) {
        const editableParent = target.closest('[contenteditable="true"]');
        target = editableParent || findAIInputField();
    }

    return target || null;
}

function insertIntoContentEditable(target, content) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(content);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: content
    }));
}

function insertIntoInputField(target, content) {
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const newValue = target.value.substring(0, start) + content + target.value.substring(end);

    // Use the native value setter so React's synthetic event system picks up the change
    const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
        nativeSetter.call(target, newValue);
    } else {
        target.value = newValue;
    }

    const newPosition = start + content.length;
    target.selectionStart = newPosition;
    target.selectionEnd = newPosition;

    target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: content
    }));
}

function injectIntoActiveElement(content, targetElement = null) {
    const target = resolveTarget(targetElement);

    if (!target) {
        console.error('Prompt Manager: No active input field found.');
        return;
    }

    target.focus();

    const isContentEditable = target.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
        insertIntoContentEditable(target, content);
    } else {
        insertIntoInputField(target, content);
    }

    focusVariable(target, content, isContentEditable);
}

function isInput(el) {
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.getAttribute('contenteditable') === 'true';
}

function findAIInputField() {
    const host = location.hostname;

    // Perplexity: textarea-based input; prioritise over contenteditable to avoid
    // matching answer/response areas that are also editable divs on the page
    if (host.endsWith('perplexity.ai')) {
        return document.querySelector('textarea') ||
            document.querySelector('[role="textbox"]');
    }

    // Grok (grok.x.com)
    if (host === 'grok.x.com') {
        return document.querySelector('textarea') ||
            document.querySelector('div[contenteditable="true"]');
    }

    // DeepSeek
    if (host === 'chat.deepseek.com') {
        return document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea');
    }

    // Mistral Le Chat
    if (host === 'chat.mistral.ai') {
        return document.querySelector('textarea') ||
            document.querySelector('div[contenteditable="true"]');
    }

    // Microsoft Copilot
    if (host === 'copilot.microsoft.com') {
        return document.querySelector('textarea') ||
            document.querySelector('div[contenteditable="true"]');
    }

    // Generic fallback: ChatGPT, Claude, Gemini, and everything else
    return document.querySelector('#prompt-textarea') || // ChatGPT
        document.querySelector('div[contenteditable="true"]') || // Claude / ChatGPT
        document.querySelector('textarea') || // Gemini / others
        document.querySelector('[role="textbox"]'); // Generic ARIA fallback
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

    // 5000 character limit prevents infinite loops in pathological DOM structures
    const MAX_STEPS = 5000;
    let steps = 0;

    // Initial adjustment
    // If starting on a non-text node, descend to the last text node within it.
    // If offset is 0, the while loop's "move previous" block handles traversal.
    if (node.nodeType !== 3 && offset > 0) {
        node = node.childNodes[offset - 1];
        while (node.lastChild) node = node.lastChild;
        if (node.nodeType === 3) offset = node.length;
        else offset = 0;
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
