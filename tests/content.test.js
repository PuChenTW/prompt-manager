import { test, expect } from './fixtures.js';
import { seedPrompts, clearPrompts, openTestPage } from './helpers.js';

const PLAIN_PROMPT = { id: '100', title: 'Plain Prompt', content: 'Hello from plain prompt' };
const VARIABLE_PROMPT = { id: '200', title: 'Variable Prompt', content: 'Greet {{name}} today' };

test.beforeEach(async ({ browserContext, page }) => {
  await clearPrompts(browserContext);
  await seedPrompts(browserContext, [PLAIN_PROMPT, VARIABLE_PROMPT]);
  await openTestPage(page);
});

test('Ctrl+/ on textarea opens the command panel', async ({ page }) => {
  await page.click('#test-textarea');
  await page.keyboard.press('Control+/');

  await expect(page.locator('#prompt-manager-panel')).toBeVisible();
  await expect(page.locator('.pm-search')).toBeFocused();
});

test('selecting first prompt via Enter injects into textarea', async ({ page }) => {
  await page.click('#test-textarea');
  await page.keyboard.press('Control+/');

  await page.waitForSelector('#prompt-manager-panel');
  await page.keyboard.press('Enter');

  const value = await page.inputValue('#test-textarea');
  expect(value).toBe(PLAIN_PROMPT.content);
});

test('typing in search filters the prompt list', async ({ page }) => {
  await page.click('#test-textarea');
  await page.keyboard.press('Control+/');

  await page.waitForSelector('.pm-search');
  await page.type('.pm-search', 'Variable');

  await expect(page.locator('.pm-item', { hasText: 'Variable Prompt' })).toBeVisible();
  await expect(page.locator('.pm-item', { hasText: 'Plain Prompt' })).not.toBeVisible();
});

test('Escape closes the panel', async ({ page }) => {
  await page.click('#test-textarea');
  await page.keyboard.press('Control+/');

  await page.waitForSelector('#prompt-manager-panel');
  await page.keyboard.press('Escape');

  await expect(page.locator('#prompt-manager-panel')).not.toBeVisible();
});

test('Ctrl+/ on contenteditable opens panel and injects content', async ({ page }) => {
  await page.click('#test-contenteditable');
  await page.keyboard.press('Control+/');

  await page.waitForSelector('#prompt-manager-panel');
  await page.keyboard.press('Enter');

  const text = await page.$eval('#test-contenteditable', el => el.innerText);
  expect(text).toContain(PLAIN_PROMPT.content);
});

test('variable prompt injection selects {{name}} in contenteditable', async ({ page }) => {
  await page.click('#test-contenteditable');
  await page.keyboard.press('Control+/');

  await page.waitForSelector('.pm-search');
  await page.type('.pm-search', 'Variable');
  await page.waitForSelector('.pm-item');
  await page.keyboard.press('Enter');

  const selected = await page.evaluate(() => window.getSelection().toString());
  expect(selected).toBe('{{name}}');
});

test('context menu path: inject message from service worker injects into focused textarea', async ({ page, browserContext }) => {
  // Focus the textarea and bring page to front so it's the active tab
  await page.bringToFront();
  await page.click('#test-textarea');
  await page.waitForTimeout(100);

  const sw = browserContext.serviceWorkers()[0];

  // Query active tab (requires no extra permissions beyond what's already granted)
  await sw.evaluate(
    (content) => new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) { reject(new Error('No active tab')); return; }
        chrome.tabs.sendMessage(tabs[0].id, { action: 'inject', content }, resolve);
      });
    }),
    PLAIN_PROMPT.content
  );

  await page.waitForTimeout(200);

  const value = await page.inputValue('#test-textarea');
  expect(value).toContain(PLAIN_PROMPT.content);
});
