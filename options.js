const MAX_CONTENT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;

const promptList = document.getElementById('prompt-list');
const addBtn = document.getElementById('add-btn');
const settingsBtn = document.getElementById('settings-btn');
const editor = document.getElementById('editor');
const settingsModal = document.getElementById('settings-modal');
const editorTitle = document.getElementById('editor-title');
const cancelBtn = document.getElementById('cancel-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveBtn = document.getElementById('save-btn');
const titleInput = document.getElementById('title-input');
const contentInput = document.getElementById('content-input');
const triggerKeyInput = document.getElementById('trigger-key-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const charLimitDisplay = document.getElementById('char-limit-display');
const charCount = document.getElementById('char-count');
const backdrop = document.getElementById('backdrop');
const highlights = document.getElementById('highlights');

// Set limits dynamically
titleInput.maxLength = MAX_TITLE_LENGTH;
contentInput.maxLength = MAX_CONTENT_LENGTH;
charLimitDisplay.textContent = MAX_CONTENT_LENGTH.toLocaleString();


let prompts = [];
let editingId = null;

// Load stored data
async function init() {
    // 1. Get trigger config from local storage
    chrome.storage.local.get(['triggerConfig'], async (result) => {
        // Config default: Cmd+/ on Mac, Ctrl+/ on others
        const defaultDisplay = 'Ctrl+/';
        const defaultKey = '/';
        const defaultCode = 'Slash';
        const defaultMods = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };

        const config = result.triggerConfig || {
            key: defaultKey,
            code: defaultCode,
            display: defaultDisplay,
            ctrlKey: true,
            metaKey: false,
            altKey: false,
            shiftKey: false
        };
        triggerKeyInput.value = config.display;
        triggerKeyInput.dataset.config = JSON.stringify(config);
    });

    // 2. Get prompts from IndexedDB
    try {
        prompts = await db.getAllPrompts();
        renderPrompts();
    } catch (e) {
        console.error("Failed to load prompts from DB", e);
    }
}

init();

// Settings Modal Logic
settingsBtn.onclick = () => {
    settingsModal.classList.remove('hidden');
};

closeSettingsBtn.onclick = () => {
    settingsModal.classList.add('hidden');
};

settingsModal.querySelector('.modal-overlay').onclick = () => {
    settingsModal.classList.add('hidden');
};

// Key recorder
triggerKeyInput.onclick = () => {
    triggerKeyInput.value = 'Press keys...';
    triggerKeyInput.classList.add('recording');
    saveSettingsBtn.disabled = true;
};

triggerKeyInput.onkeydown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore standalone modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) {
        return;
    }

    const hasModifier = e.ctrlKey || e.altKey || e.metaKey || e.shiftKey;

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');

    const keyDisplay = modifiers.length > 0 ? modifiers.join('+') + '+' + e.key.toUpperCase() : e.key;

    const config = {
        key: e.key,
        code: e.code,
        ctrlKey: !!e.ctrlKey,
        metaKey: !!e.metaKey,
        altKey: !!e.altKey,
        shiftKey: !!e.shiftKey,
        display: keyDisplay
    };

    triggerKeyInput.value = keyDisplay;
    triggerKeyInput.dataset.config = JSON.stringify(config);

    if (!hasModifier) {
        triggerKeyInput.classList.add('error');
        saveSettingsBtn.disabled = true;
    } else {
        triggerKeyInput.classList.remove('error');
        triggerKeyInput.classList.remove('recording');
        saveSettingsBtn.disabled = false;
        triggerKeyInput.blur(); // Stop recording
    }
};

saveSettingsBtn.onclick = () => {
    let config;
    try {
        config = JSON.parse(triggerKeyInput.dataset.config);
    } catch (e) {
        config = { key: '/', code: 'Slash', display: 'Ctrl+/', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
    }

    // Validate: must have at least one primary modifier (Ctrl/Cmd/Alt)
    // Actually user said "combine key", Shift+/ is a combine key for some,
    // but usually means modifier + key.
    const hasModifier = config.ctrlKey || config.altKey || config.metaKey || config.shiftKey;

    if (!hasModifier) {
        alert('Please use a combination key (e.g., Ctrl + /, Alt + P)');
        triggerKeyInput.classList.add('error');
        triggerKeyInput.focus();
        return;
    }

    chrome.storage.local.set({ triggerConfig: config }, () => {
        const originalText = saveSettingsBtn.textContent;
        saveSettingsBtn.textContent = 'Saved!';
        saveSettingsBtn.disabled = true;
        setTimeout(() => {
            saveSettingsBtn.textContent = originalText;
            saveSettingsBtn.disabled = false;
            settingsModal.classList.add('hidden'); // Close after save
        }, 1000);
    });
};


let draggedItemIndex = null;

function renderPrompts() {
    promptList.innerHTML = '';
    if (prompts.length === 0) {
        promptList.innerHTML = `
      <div class="empty-state">
        <h3>No prompts yet</h3>
        <p>Click "Add Prompt" to create your first template</p>
      </div>
    `;
        return;
    }

    prompts.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        // Add draggable attributes
        item.draggable = true;
        item.dataset.index = index;

        item.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </div>
      <div class="prompt-content" title="Click to edit">
        <div class="prompt-title">${escapeHtml(p.title)}</div>
        <div class="prompt-preview">${escapeHtml(p.content)}</div>
      </div>
      <div class="prompt-actions">
        <button class="btn-icon delete" data-id="${p.id}" title="Delete">
          <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;

        // Click card to edit
        item.querySelector('.prompt-content').onclick = () => startEdit(p);

        // Delete button
        const deleteBtn = item.querySelector('.delete');
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering card click
            deletePrompt(p.id);
        };

        // Drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        promptList.appendChild(item);
    });
}

function handleDragStart(e) {
    draggedItemIndex = Number(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = this.getBoundingClientRect();
    const offset = e.clientY - rect.top;

    if (offset < rect.height / 2) {
        this.classList.remove('drag-over-bottom');
        this.classList.add('drag-over-top');
    } else {
        this.classList.remove('drag-over-top');
        this.classList.add('drag-over-bottom');
    }
}

function handleDragEnter(e) {
    // Clear highlights from other items to ensure clean state
    document.querySelectorAll('.prompt-item').forEach(el => {
        if (el !== this) el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

function handleDragLeave(e) {
    // Only remove if leaving the element entirely (not entering a child)
    if (this.contains(e.relatedTarget)) return;
    this.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const isAfter = this.classList.contains('drag-over-bottom');
    this.classList.remove('drag-over-top', 'drag-over-bottom');

    const targetIndex = Number(this.dataset.index);
    let finalIndex = isAfter ? targetIndex + 1 : targetIndex;

    if (draggedItemIndex === null) return;

    if (draggedItemIndex < finalIndex) {
        finalIndex--;
    }

    if (draggedItemIndex !== finalIndex) {
        const item = prompts[draggedItemIndex];
        prompts.splice(draggedItemIndex, 1);
        prompts.splice(finalIndex, 0, item);

        db.savePrompts(prompts)
            .then(() => {
                renderPrompts();
                chrome.runtime.sendMessage({ action: 'updateMenus' });
            })
            .catch(e => console.error("Failed to save reordered prompts", e));
    }
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.prompt-item').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedItemIndex = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyHighlights(text) {
    // Escape HTML first
    let escaped = escapeHtml(text);

    // Replace {{variable}} with <mark>{{variable}}</mark>
    // Using a regex to find {{...}}
    return escaped.replace(/\{\{[^}]*\}\}/g, '<mark>$&</mark>');
}

function updateHighlights() {
    const text = contentInput.value;
    const highlightedText = applyHighlights(text);
    // Add a trailing newline to fix scrolling issues with pre-wrap
    highlights.innerHTML = highlightedText + '\n';
}

function syncScroll() {
    backdrop.scrollTop = contentInput.scrollTop;
}

function updateCharCount() {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const length = contentInput.value.length;

    charCount.textContent = length.toLocaleString();

    const isContentTooLong = length > MAX_CONTENT_LENGTH;
    const isTitleTooLong = titleInput.value.length > MAX_TITLE_LENGTH;
    const isEmpty = !title || !content;

    if (isContentTooLong) {
        charCount.parentElement.classList.add('limit-reached');
    } else {
        charCount.parentElement.classList.remove('limit-reached');
    }

    saveBtn.disabled = isContentTooLong || isTitleTooLong || isEmpty;
}

contentInput.oninput = () => {
    updateCharCount();
    updateHighlights();
};
contentInput.onscroll = syncScroll;
titleInput.oninput = updateCharCount;

addBtn.onclick = () => {
    editingId = null;
    titleInput.value = '';
    contentInput.value = '';
    updateCharCount();
    updateHighlights();
    editorTitle.textContent = 'New Prompt';
    editor.classList.remove('hidden');
    titleInput.focus();
};

cancelBtn.onclick = () => {
    editor.classList.add('hidden');
};

editor.querySelector('.modal-overlay').onclick = () => {
    editor.classList.add('hidden');
};

saveBtn.onclick = () => {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (editingId) {
        const index = prompts.findIndex(p => p.id === editingId);
        prompts[index] = { ...prompts[index], title, content };
    } else {
        prompts.push({ id: Date.now().toString(), title, content });
    }

    db.savePrompts(prompts)
        .then(() => {
            renderPrompts();
            editor.classList.add('hidden');
            chrome.runtime.sendMessage({ action: 'updateMenus' });
        })
        .catch(e => console.error("Failed to save prompt", e));
};

function startEdit(prompt) {
    editingId = prompt.id;
    titleInput.value = prompt.title;
    contentInput.value = prompt.content;
    updateCharCount();
    updateHighlights();
    editorTitle.textContent = 'Edit Prompt';
    editor.classList.remove('hidden');
    titleInput.focus();
}

function deletePrompt(id) {
    if (!confirm('Are you sure you want to delete this prompt?')) {
        return;
    }

    prompts = prompts.filter(p => p.id !== id);
    db.savePrompts(prompts)
        .then(() => {
            renderPrompts();
            chrome.runtime.sendMessage({ action: 'updateMenus' });
        })
        .catch(e => console.error("Failed to delete prompt", e));
}
