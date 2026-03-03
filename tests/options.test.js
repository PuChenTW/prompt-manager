import { test, expect } from './fixtures.js';
import { clearPrompts, seedPrompts, openOptionsPage } from './helpers.js';

test.beforeEach(async ({ browserContext, page, extensionId }) => {
  await clearPrompts(browserContext);
  await openOptionsPage(page, extensionId);
});

test('shows empty state when no prompts', async ({ page }) => {
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('creates a prompt and shows it in the list', async ({ page }) => {
  await page.click('#add-btn');
  await page.fill('#title-input', 'My Test Prompt');
  await page.fill('#content-input', 'Hello world content');
  await page.click('#save-btn');

  await expect(page.locator('.prompt-title', { hasText: 'My Test Prompt' })).toBeVisible();
});

test('edits a seeded prompt and shows updated title', async ({ browserContext, page, extensionId }) => {
  await seedPrompts(browserContext, [{ id: '1000', title: 'Original Title', content: 'Original content' }]);
  await openOptionsPage(page, extensionId);

  await page.click('.prompt-content');
  await page.fill('#title-input', 'Updated Title');
  await page.click('#save-btn');

  await expect(page.locator('.prompt-title', { hasText: 'Updated Title' })).toBeVisible();
  await expect(page.locator('.prompt-title', { hasText: 'Original Title' })).not.toBeVisible();
});

test('deletes a prompt via confirmation dialog', async ({ browserContext, page, extensionId }) => {
  await seedPrompts(browserContext, [{ id: '2000', title: 'To Delete', content: 'content' }]);
  await openOptionsPage(page, extensionId);

  await expect(page.locator('.prompt-title', { hasText: 'To Delete' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.click('.btn-icon.delete');

  await expect(page.locator('.empty-state')).toBeVisible();
});

test('save button is disabled when title is empty', async ({ page }) => {
  await page.click('#add-btn');
  await page.fill('#content-input', 'Some content');

  await expect(page.locator('#save-btn')).toBeDisabled();
});

test('accepts content up to 100,000 characters and saves successfully', async ({ page }) => {
  await page.click('#add-btn');
  await page.fill('#title-input', 'Long Prompt');
  await page.fill('#content-input', 'x'.repeat(100000));
  await page.click('#save-btn');

  await expect(page.locator('.prompt-title', { hasText: 'Long Prompt' })).toBeVisible();
});

test('textarea does not accept input beyond 100,000 characters', async ({ page }) => {
  await page.click('#add-btn');
  await page.fill('#content-input', 'x'.repeat(100001));

  await page.locator('#content-input').pressSequentially('y');

  const length = await page.locator('#content-input').evaluate(el => el.value.length);
  expect(length).toBe(100000);
});

test('save button is disabled when content exceeds 100,000 characters', async ({ page }) => {
  await page.click('#add-btn');
  await page.fill('#title-input', 'Too Long');
  // Bypass maxLength to simulate pasting over-limit content programmatically
  await page.evaluate(() => {
    const el = document.querySelector('#content-input');
    el.value = 'x'.repeat(100001);
    el.dispatchEvent(new Event('input'));
  });

  await expect(page.locator('#save-btn')).toBeDisabled();
});
