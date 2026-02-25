import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 1,
  workers: 1,
  projects: [{ name: 'chromium-extension', use: { channel: 'chromium' } }],
});
