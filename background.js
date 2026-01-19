const PARENT_ID = 'prompt-manager-root';

chrome.runtime.onInstalled.addListener(() => {
    createMenus();

    // Initialize default trigger configuration
    chrome.storage.local.get(['triggerConfig'], (result) => {
        if (!result.triggerConfig) {
            const defaultConfig = {
                key: '/',
                code: 'Slash',
                display: 'Ctrl+/',
                ctrlKey: true,
                metaKey: false,
                altKey: false,
                shiftKey: false
            };
            chrome.storage.local.set({ triggerConfig: defaultConfig });
        }
    });
});

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// Update menus when storage changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.prompts) {
        createMenus();
    }
});

function createMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: PARENT_ID,
            title: 'Prompt Manager',
            contexts: ['editable']
        });

        chrome.storage.local.get(['prompts'], (result) => {
            const prompts = result.prompts || [];
            prompts.forEach((p) => {
                chrome.contextMenus.create({
                    id: p.id,
                    parentId: PARENT_ID,
                    title: p.title,
                    contexts: ['editable']
                });
            });
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.parentMenuItemId === PARENT_ID) {
        chrome.storage.local.get(['prompts'], (result) => {
            const prompts = result.prompts || [];
            const prompt = prompts.find(p => p.id === info.menuItemId);
            if (prompt && tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'inject', content: prompt.content });
            }
        });
    }
});
