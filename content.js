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

    const start = match.index;
    const end = start + match[0].length;

    if (isContentEditable) {
        const range = document.createRange();
        const sel = window.getSelection();

        // Find text node
        let textNode = target.firstChild;
        while (textNode && textNode.nodeType !== 3) {
            textNode = textNode.firstChild;
        }

        if (textNode) {
            range.setStart(textNode, start);
            range.setEnd(textNode, end);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        target.focus();
    } else {
        target.focus();
        target.setSelectionRange(start, end);
    }
}
