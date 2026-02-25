import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..');

// worker-scoped: one browser per worker (one worker total)
const extensionFixture = base.extend({
  // Rename to avoid conflict with built-in 'context' (test-scoped)
  browserContext: [async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--headless=new',
      ],
    });

    // Wait for service worker
    let sw = ctx.serviceWorkers()[0];
    if (!sw) {
      sw = await ctx.waitForEvent('serviceworker');
    }

    ctx._extensionId = new URL(sw.url()).hostname;
    ctx._sw = sw;

    await use(ctx);
    await ctx.close();
  }, { scope: 'worker' }],

  extensionId: [async ({ browserContext }, use) => {
    await use(browserContext._extensionId);
  }, { scope: 'worker' }],

  page: async ({ browserContext }, use) => {
    const page = await browserContext.newPage();
    await use(page);
    await page.close();
  },
});

export const test = extensionFixture;
export const expect = base.expect;
