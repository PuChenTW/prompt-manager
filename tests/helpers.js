import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedPrompts(browserContext, prompts) {
  const sw = browserContext.serviceWorkers()[0];
  await sw.evaluate((prompts) => db.savePrompts(prompts), prompts);
}

export async function clearPrompts(browserContext) {
  const sw = browserContext.serviceWorkers()[0];
  await sw.evaluate(() => db.savePrompts([]));
}

export async function openOptionsPage(page, extensionId) {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector('#prompt-list');
}

export async function openTestPage(page) {
  const testPagePath = path.resolve(__dirname, 'test-page.html');
  await page.goto(`file://${testPagePath}`);
  // Allow content script to initialize
  await page.waitForTimeout(300);
}
