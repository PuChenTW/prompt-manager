const promptList = document.getElementById('prompt-list');
const addBtn = document.getElementById('add-btn');
const editor = document.getElementById('editor');
const editorTitle = document.getElementById('editor-title');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const titleInput = document.getElementById('title-input');
const contentInput = document.getElementById('content-input');

let prompts = [];
let editingId = null;

// Load prompts
chrome.storage.local.get(['prompts'], (result) => {
    prompts = result.prompts || [];
    renderPrompts();
});

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

addBtn.onclick = () => {
    editingId = null;
    titleInput.value = '';
    contentInput.value = '';
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

    if (!title || !content) {
        alert('Please fill in both title and content');
        return;
    }

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
