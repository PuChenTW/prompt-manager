importScripts('db.js');

const PARENT_ID = 'prompt-manager-root';

chrome.runtime.onInstalled.addListener(async () => {
    // 1. Data Migration: Check local storage for old prompts
    chrome.storage.local.get(['prompts'], async (result) => {
        if (result.prompts && Array.isArray(result.prompts)) {
            try {
                // Save old prompts to IndexedDB
                await db.savePrompts(result.prompts);
                console.log('Successfully migrated prompts to IndexedDB');
                // Remove from local storage after successful migration
                chrome.storage.local.remove(['prompts']);
            } catch (error) {
                console.error('Migration failed:', error);
            }
        }
        createMenus(); // Ensure menus are created regardless of migration
    });

    chrome.runtime.openOptionsPage();

    // 2. Initialize default trigger configuration
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

// Message interactions with content/options scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPrompts') {
        db.getAllPrompts().then(prompts => {
            sendResponse({ prompts });
        }).catch(err => {
            console.error(err);
            sendResponse({ prompts: [] });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'updateMenus') {
        createMenus();
    }
});

async function createMenus() {
    chrome.contextMenus.removeAll(async () => {
        chrome.contextMenus.create({
            id: PARENT_ID,
            title: 'Prompt Manager',
            contexts: ['editable']
        });

        try {
            const prompts = await db.getAllPrompts();
            prompts.forEach((p) => {
                chrome.contextMenus.create({
                    id: p.id,
                    parentId: PARENT_ID,
                    title: p.title,
                    contexts: ['editable']
                });
            });
        } catch (error) {
            console.error("Failed to load prompts for menus:", error);
        }
    });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === PARENT_ID) {
        try {
            const prompts = await db.getAllPrompts();
            const prompt = prompts.find(p => p.id === info.menuItemId);
            if (prompt && tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'inject', content: prompt.content });
            }
        } catch (error) {
            console.error("Failed to inject prompt:", error);
        }
    }
});
