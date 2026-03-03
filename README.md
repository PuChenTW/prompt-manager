# Prompt Manager

A lightweight Chrome extension for managing and quickly inserting AI prompt templates with automatic variable detection and cursor positioning.

## Core Features

### 1. Prompt Management

**Create & Store Prompts**
- Build reusable prompt templates with titles and content
- Support for variable placeholders using `{{variable}}` syntax
- Character limits: 200 chars for titles, 100,000 chars for content
- Persistent storage using IndexedDB for massively large templates

**Edit & Delete**
- Click any prompt card to edit
- Real-time character counter with visual feedback
- Syntax highlighting for `{{variable}}` placeholders in the editor
- Drag-and-drop reordering of prompts

**Visual Management**
- Modern card-based UI with glassmorphism effects
- Hover animations and smooth transitions
- Content preview with automatic truncation (3 lines max)
- Scrollable list for large prompt collections

### 2. Prompt Insertion

#### Method A: Context Menu (Right-Click)
1. Right-click on any editable field (textarea, input, contenteditable)
2. Select **Prompt Manager** from the context menu
3. Choose your prompt from the submenu
4. Prompt is inserted instantly

#### Method B: Keyboard Shortcut (Command Palette)
1. Focus on any editable field
2. Press the trigger key (default: `Ctrl+/`)
3. Search panel appears with fuzzy search
4. Type to filter prompts by title or content
5. Use `↑`/`↓` arrows to navigate, `Enter` to insert, `Esc` to close

**Fuzzy Search Features:**
- Case-insensitive matching
- Searches both title and content
- Highlights matching text in results
- Keyboard-first navigation

### 3. Automatic Variable Handling

**Smart Cursor Positioning**
- After insertion, automatically detects the first `{{variable}}` placeholder
- Moves cursor to the variable and selects it
- Ready for immediate typing to replace the variable
- Works in both standard inputs and contenteditable elements

**Supported Input Types:**
- `<textarea>` elements
- `<input>` text fields
- `contenteditable` elements (ChatGPT, Claude, Notion, etc.)

### 4. Customizable Hotkey

**Configuration:**
- Click the gear icon (⚙️) in the options page
- Click the input field to start recording
- Press your desired key combination
- Only combination keys are allowed (e.g., `Ctrl+K`, `Cmd+Shift+P`)
- Single-key triggers are blocked for safety

**Default Hotkey:** `Ctrl+/`

**Validation:**
- Prevents single-key triggers to avoid accidental activation
- Requires at least one modifier key (Ctrl, Alt, Cmd, Shift)
- Visual feedback for invalid key combinations

## Technical Implementation

### Architecture

**Manifest V3 Compliance**
- Service worker background script
- Content script injection on all URLs
- Minimal permissions (storage, contextMenus)

**Components:**
- `background.js` - Service worker for context menu management
- `content.js` - Content script for hotkey detection and prompt injection
- `options.js` - Options page logic for prompt CRUD operations
- `options.html/css` - Modern UI for prompt management
- `panel.css` - Styling for the command palette overlay

### Injection Mechanism

**Text Insertion Strategy:**
1. Detects the active input element (last focused or right-clicked)
2. For standard inputs/textareas:
   - Uses direct value manipulation and selection positioning
3. For contenteditable elements:
   - Uses modern Selection API and `insertNode()` for precise insertion
   - Handles complex DOM structures (ChatGPT, Claude, etc.)
   - Triggers `input` events for React/Vue compatibility

**Variable Detection:**
- Regex pattern: `/\{\{[^}]+\}\}/g`
- Backward text search in contenteditable elements
- Forward walking algorithm to calculate exact cursor position
- Automatic selection for immediate replacement

### Storage Architecture

- **Prompts:** Stored in **IndexedDB** (`PromptManagerDB`) to bypass the typical 5MB Chrome storage limits, allowing for theoretically unlimited, massive prompt templates.
- **Settings:** Hotkey configurations (`triggerConfig`) remain in `chrome.storage.local` for quick lightweight access.

**IndexedDB Format:**
```json
{
  "id": "1705392847123",
  "title": "Code Review Prompt",
  "content": "Review this {{language}} code:\n\n{{code}}\n\nFocus on:\n1. Performance\n2. Security\n3. Best practices"
}
```

## Usage Examples

### Example 1: Financial Analysis Prompt
```
Title: Financial Analyst
Content: Act as a financial analyst. Analyze the following data: {{data}}

Provide insights on:
1. Key trends
2. Risk factors
3. Investment recommendations
```

**Workflow:**
1. Right-click in ChatGPT input → Select "Financial Analyst"
2. Cursor auto-selects `{{data}}`
3. Paste your financial data
4. Submit to AI

### Example 2: Code Review Template
```
Title: Code Reviewer
Content: Review this {{language}} code for:
- Code quality
- Performance issues
- Security vulnerabilities
- Best practices

Code:
{{code}}
```

**Workflow:**
1. Press `Ctrl+/` in any text field
2. Type "code" to filter
3. Press `Enter` to insert
4. Type language name (e.g., "Python")
5. Tab/click to next variable, paste code

### Example 3: Email Template
```
Title: Professional Email
Content: Subject: {{subject}}

Dear {{recipient}},

{{body}}

Best regards,
{{sender}}
```

## Installation

### From Source
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the project directory
6. Extension icon appears in toolbar

### First-Time Setup
1. Click the extension icon to open the options page
2. Click "Add Prompt" to create your first template
3. (Optional) Click the gear icon to customize the hotkey
4. Start using prompts via right-click or hotkey

## Browser Compatibility

- **Chrome:** Full support (Manifest V3)
- **Edge:** Full support (Chromium-based)
- **Brave:** Full support
- **Opera:** Full support
- **Firefox:** Not supported (requires Manifest V2 adaptation)

## Limitations

1. **Variable Navigation:** Only the first `{{variable}}` is auto-selected. Navigate to subsequent variables manually.
2. **iframe Support:** Complex nested iframes may require additional handling.
3. **Storage Limit:** Thanks to IndexedDB migration, storage is virtually unlimited (subject to browser's quota).
4. **Contenteditable Complexity:** Some heavily customized editors may have edge cases.

## Privacy & Security

- **No Network Requests:** All data stored locally
- **No Analytics:** Zero tracking or telemetry
- **No External Dependencies:** Pure vanilla JavaScript
- **Minimal Permissions:** Only storage and context menu access
- **Open Source:** Full code transparency

## Development

### File Structure
```
prompt-manager/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (context menus, db migration)
├── content.js             # Content script (injection logic, messaging)
├── db.js                  # IndexedDB wrapper operations
├── options.html           # Options page UI
├── options.js             # Options page logic
├── options.css            # Options page styling
├── panel.css              # Command palette styling
└── icons/                 # Extension icons (16, 32, 48, 128)
```

### Key Functions

**content.js:**
- `showPanel()` - Display command palette
- `injectIntoActiveElement()` - Insert prompt into active field
- `focusVariable()` - Auto-select first variable
- `fuzzyMatch()` - Search algorithm for filtering

**options.js:**
- `renderPrompts()` - Render prompt list with drag-drop
- `startEdit()` - Open edit modal
- `deletePrompt()` - Remove prompt with confirmation
- `applyHighlights()` - Syntax highlighting for variables

**background.js:**
- Message listener for `getPrompts` (Content Script) and `updateMenus`
- Automatic initial migration from local storage to IndexedDB
- `createMenus()` - Build context menu structure
- Context menu click handler for prompt injection

## Performance

- **Lightweight:** ~30KB total size
- **Fast Injection:** <10ms for most prompts
- **Efficient Search:** Fuzzy matching optimized for <100ms
- **Minimal Memory:** <5MB RAM usage
- **No Background Processing:** Only active when needed

## Troubleshooting

**Hotkey not working:**
- Check if another extension uses the same hotkey
- Verify the hotkey is a combination key (not a single character)
- Reload the extension after changing settings

**Prompt not inserting:**
- Ensure the target field is focused or right-clicked
- Try clicking the field before using the hotkey
- Check browser console for errors (F12)

**Variables not auto-selecting:**
- Verify the variable uses `{{variable}}` syntax (double braces)
- Some contenteditable elements may not support selection
- Try using Tab to navigate to the variable manually

## License

MIT License - Free to use, modify, and distribute.

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style (vanilla JS, no frameworks)
- Test on multiple websites (ChatGPT, Claude, Google Docs, etc.)
- Update README for new features
- Keep bundle size minimal

---

**Version:** 1.0.0
**Manifest:** V3
**Last Updated:** 2026-02-23
