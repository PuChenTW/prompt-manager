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
const charCount = document.getElementById('char-count');
const charLimitDisplay = document.getElementById('char-limit-display');

// Set limits dynamically
titleInput.maxLength = MAX_TITLE_LENGTH;
contentInput.maxLength = MAX_CONTENT_LENGTH;
charLimitDisplay.textContent = MAX_CONTENT_LENGTH.toLocaleString();


let prompts = [];
let editingId = null;

// Load stored data
chrome.storage.local.get(['prompts', 'triggerConfig'], (result) => {
    prompts = result.prompts || [];

    // Config default: Cmd+/ on Mac, Ctrl+/ on others
    const defaultDisplay = 'Ctrl+/';
    const defaultKey = '/';
    const defaultCode = 'Slash';
    const defaultMods = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };

    const config = result.triggerConfig || {
        key: defaultKey,
        code: defaultCode,
        display: defaultDisplay,
        ...defaultMods
    };
    triggerKeyInput.value = config.display;
    triggerKeyInput.dataset.config = JSON.stringify(config);

    renderPrompts();
});

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

    prompts.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        item.innerHTML = `
      <div class="prompt-content">
        <div class="prompt-title">${escapeHtml(p.title)}</div>
        <div class="prompt-preview">${escapeHtml(p.content)}</div>
      </div>
      <div class="prompt-actions">
        <button class="btn-icon delete" data-id="${p.id}">Delete</button>
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

        promptList.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

contentInput.oninput = updateCharCount;
titleInput.oninput = updateCharCount;

addBtn.onclick = () => {
    editingId = null;
    titleInput.value = '';
    contentInput.value = '';
    updateCharCount();
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

    chrome.storage.local.set({ prompts }, () => {
        renderPrompts();
        editor.classList.add('hidden');
    });
};

function startEdit(prompt) {
    editingId = prompt.id;
    titleInput.value = prompt.title;
    contentInput.value = prompt.content;
    updateCharCount();
    editorTitle.textContent = 'Edit Prompt';
    editor.classList.remove('hidden');
    titleInput.focus();
}

function deletePrompt(id) {
    if (!confirm('Are you sure you want to delete this prompt?')) {
        return;
    }

    prompts = prompts.filter(p => p.id !== id);
    chrome.storage.local.set({ prompts }, renderPrompts);
}
